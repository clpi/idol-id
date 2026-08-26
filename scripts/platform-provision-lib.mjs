const API = "https://api.cloudflare.com/client/v4";
const DATABASE_NAME = "idol-platform";
const APPLICATION_NAME = "Idol Platform Browser Identity";
const POLICY_NAME = "Allow Idol owner domain";
const DESTINATION = "platform.idol.id/v1/platform/browser/*";

function ensureString(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

async function cloudflare({ accountId, apiToken, fetcher }, path, init = {}, allow404 = false) {
  const response = await fetcher(`${API}/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers || {}),
    },
  });
  if (allow404 && response.status === 404) return null;
  let document;
  try {
    document = await response.json();
  } catch {
    throw new Error(`Cloudflare ${init.method || "GET"} ${path} returned invalid JSON (${response.status})`);
  }
  if (!response.ok || document.success === false) {
    const detail = (document.errors || []).map((error) => error.message).filter(Boolean).join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare ${init.method || "GET"} ${path} failed: ${detail}`);
  }
  return document.result;
}

async function ensureDatabase(context) {
  const listed = await cloudflare(context, `/d1/database?name=${encodeURIComponent(DATABASE_NAME)}&per_page=100`);
  const existing = Array.isArray(listed) ? listed.find((database) => database.name === DATABASE_NAME) : null;
  if (existing?.uuid) return existing;
  return cloudflare(context, "/d1/database", {
    method: "POST",
    body: JSON.stringify({
      name: DATABASE_NAME,
      primary_location_hint: "wnam",
      read_replication: { mode: "disabled" },
    }),
  });
}

async function ensureOrganization(context, teamName) {
  const existing = await cloudflare(context, "/access/organizations", {}, true);
  if (existing?.auth_domain) return existing;
  return cloudflare(context, "/access/organizations", {
    method: "POST",
    body: JSON.stringify({
      name: teamName,
      auth_domain: `${teamName}.cloudflareaccess.com`,
      session_duration: "24h",
      auto_redirect_to_identity: true,
      login_design: {
        background_color: "#050607",
        text_color: "#f4f2ed",
        header_text: "Idol Platform",
        footer_text: "Transport identity only. World authority remains explicit.",
      },
    }),
  });
}

async function ensureOtp(context) {
  const listed = await cloudflare(context, "/access/identity_providers?per_page=100");
  const existing = Array.isArray(listed) ? listed.find((provider) => provider.type === "onetimepin") : null;
  if (existing?.id) return existing;
  return cloudflare(context, "/access/identity_providers", {
    method: "POST",
    body: JSON.stringify({ name: "One-time PIN", type: "onetimepin", config: {} }),
  });
}

function destinationsOf(app) {
  if (Array.isArray(app?.destinations)) return app.destinations;
  if (app?.domain) return [{ type: "public", uri: app.domain }];
  return [];
}

async function ensureApplication(context, otp) {
  const listed = await cloudflare(context, "/access/apps?per_page=100");
  const existing = Array.isArray(listed) ? listed.find((app) => app.name === APPLICATION_NAME) : null;
  if (existing) {
    const matches = destinationsOf(existing).some((destination) => destination.type === "public" && destination.uri === DESTINATION);
    if (!matches) throw new Error(`${APPLICATION_NAME} exists with a different destination`);
    return existing;
  }
  return cloudflare(context, "/access/apps", {
    method: "POST",
    body: JSON.stringify({
      name: APPLICATION_NAME,
      type: "self_hosted",
      destinations: [{ type: "public", uri: DESTINATION }],
      session_duration: "24h",
      allowed_idps: [otp.id],
      auto_redirect_to_identity: true,
      app_launcher_visible: false,
      skip_interstitial: true,
      custom_deny_message: "This private Idol Platform API requires an admitted account identity.",
    }),
  });
}

function policyMatches(policy, emailDomain) {
  return policy?.decision === "allow" && Array.isArray(policy.include) && policy.include.some(
    (rule) => rule?.email_domain?.domain === emailDomain,
  );
}

async function ensurePolicy(context, app, emailDomain) {
  const listed = await cloudflare(context, `/access/apps/${encodeURIComponent(app.id)}/policies?per_page=100`);
  const existing = Array.isArray(listed) ? listed.find((policy) => policy.name === POLICY_NAME) : null;
  if (existing) {
    if (!policyMatches(existing, emailDomain)) throw new Error(`${POLICY_NAME} exists with a different admission rule`);
    return existing;
  }
  return cloudflare(context, `/access/apps/${encodeURIComponent(app.id)}/policies`, {
    method: "POST",
    body: JSON.stringify({
      name: POLICY_NAME,
      decision: "allow",
      precedence: 1,
      session_duration: "24h",
      include: [{ email_domain: { domain: emailDomain } }],
      require: [],
      exclude: [],
    }),
  });
}

function accessAudience(app) {
  if (Array.isArray(app?.aud)) return app.aud[0] || "";
  return String(app?.aud || "");
}

export async function provisionPlatform({
  accountId,
  apiToken,
  emailDomain = "pecunies.com",
  teamName = "idol-clpi",
  fetcher = fetch,
} = {}) {
  const context = {
    accountId: ensureString(accountId, "Cloudflare account ID"),
    apiToken: ensureString(apiToken, "Cloudflare API token"),
    fetcher,
  };
  const admittedDomain = ensureString(emailDomain, "Access email domain").toLowerCase();
  const database = await ensureDatabase(context);
  if (!database?.uuid) throw new Error("Cloudflare D1 database response has no UUID");
  const organization = await ensureOrganization(context, ensureString(teamName, "Access team name"));
  const otp = await ensureOtp(context);
  if (!otp?.id) throw new Error("Cloudflare Access one-time PIN response has no ID");
  const app = await ensureApplication(context, otp);
  if (!app?.id || !accessAudience(app)) throw new Error("Cloudflare Access application response is incomplete");
  await ensurePolicy(context, app, admittedDomain);

  return Object.freeze({
    databaseId: database.uuid,
    databaseName: database.name || DATABASE_NAME,
    teamDomain: organization.auth_domain,
    accessApplicationId: app.id,
    accessAudience: accessAudience(app),
    emailDomain: admittedDomain,
  });
}

export function renderProductionWrangler(baseConfig, provisioned) {
  const config = structuredClone(baseConfig);
  config.d1_databases = [{
    binding: "PLATFORM_DB",
    database_name: provisioned.databaseName,
    database_id: provisioned.databaseId,
    migrations_dir: "migrations",
  }];
  config.vars = {
    ...(config.vars || {}),
    ACCESS_TEAM_DOMAIN: provisioned.teamDomain,
    ACCESS_AUD: provisioned.accessAudience,
    ACCESS_EMAIL_DOMAIN: provisioned.emailDomain,
  };
  return config;
}

export function parseJsonc(source) {
  const withoutBlock = String(source).replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLine = withoutBlock.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(withoutLine);
}
