const API = "https://api.cloudflare.com/client/v4";
export const LIVE_ACCESS_APPLICATION_NAME = "Idol Live Browser Identity";
export const LIVE_ACCESS_POLICY_NAME = "Allow Idol Live owner email";
export const LIVE_ACCESS_DESTINATION = Object.freeze({ type: "public", uri: "live.idol.id/*" });

function ensureString(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

async function cloudflare({ accountId, apiToken, fetcher }, path, init = {}) {
  const response = await fetcher(`${API}/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers || {}),
    },
  });
  let document;
  try {
    document = await response.json();
  } catch {
    throw new Error(`Cloudflare ${init.method || "GET"} ${path} returned invalid JSON (${response.status})`);
  }
  if (!response.ok || document?.success === false) {
    const detail = (document?.errors || []).map((error) => error.message).filter(Boolean).join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare ${init.method || "GET"} ${path} failed: ${detail}`);
  }
  return document.result;
}

function destinationsOf(app) {
  if (Array.isArray(app?.destinations)) return app.destinations;
  if (app?.domain) return [{ type: "public", uri: app.domain }];
  return [];
}

function destinationKey(destination) {
  return `${String(destination?.type || "")}:${String(destination?.uri || "")}`;
}

function setEquals(left, right, key = (value) => String(value)) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = new Set(left.map(key));
  const b = new Set(right.map(key));
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function applicationDocument(allowedIdps) {
  return {
    name: LIVE_ACCESS_APPLICATION_NAME,
    type: "self_hosted",
    destinations: [{ ...LIVE_ACCESS_DESTINATION }],
    session_duration: "24h",
    allowed_idps: [...allowedIdps],
    auto_redirect_to_identity: true,
    app_launcher_visible: false,
    skip_interstitial: true,
    custom_deny_message: "This private Idol Live surface requires the admitted owner identity.",
  };
}

function requiredDestinationIsSafe(existing) {
  const required = destinationKey(LIVE_ACCESS_DESTINATION);
  for (const destination of destinationsOf(existing)) {
    if (destinationKey(destination) !== required) {
      throw new Error(`${LIVE_ACCESS_APPLICATION_NAME} exists with an unknown destination: ${destination.uri || "<missing>"}`);
    }
  }
}

function applicationMatches(existing, required) {
  if (!setEquals(destinationsOf(existing), required.destinations, destinationKey)) return false;
  if (!setEquals(existing.allowed_idps, required.allowed_idps)) return false;
  for (const field of [
    "name",
    "type",
    "session_duration",
    "auto_redirect_to_identity",
    "app_launcher_visible",
    "skip_interstitial",
    "custom_deny_message",
  ]) {
    if (existing[field] !== required[field]) return false;
  }
  return true;
}

async function ensureApplication(context, allowedIdps) {
  const listed = await cloudflare(context, "/access/apps?per_page=100");
  const existing = Array.isArray(listed) ? listed.find((app) => app.name === LIVE_ACCESS_APPLICATION_NAME) : null;
  const document = applicationDocument(allowedIdps);
  if (!existing) {
    return cloudflare(context, "/access/apps", {
      method: "POST",
      body: JSON.stringify(document),
    });
  }

  requiredDestinationIsSafe(existing);
  if (applicationMatches(existing, document)) return existing;
  return cloudflare(context, `/access/apps/${encodeURIComponent(existing.id)}`, {
    method: "PUT",
    body: JSON.stringify(document),
  });
}

function isExactEmailRule(rule, bootstrapEmail) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
  if (Object.keys(rule).length !== 1 || !rule.email || typeof rule.email !== "object" || Array.isArray(rule.email)) return false;
  if (Object.keys(rule.email).length !== 1) return false;
  return String(rule.email.email || "").trim().toLowerCase() === bootstrapEmail;
}

function emptyRules(value) {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

function policyMatches(policy, bootstrapEmail) {
  return policy?.name === LIVE_ACCESS_POLICY_NAME
    && policy.decision === "allow"
    && Array.isArray(policy.include)
    && policy.include.length === 1
    && isExactEmailRule(policy.include[0], bootstrapEmail)
    && emptyRules(policy.require)
    && emptyRules(policy.exclude)
    && (policy.session_duration === undefined || policy.session_duration === "24h");
}

async function ensurePolicy(context, app, bootstrapEmail) {
  const listed = await cloudflare(context, `/access/apps/${encodeURIComponent(app.id)}/policies?per_page=100`);
  const policies = Array.isArray(listed) ? listed : [];
  for (const policy of policies) {
    if (policy.name === LIVE_ACCESS_POLICY_NAME) continue;
    if (policy.decision === "allow") throw new Error(`${LIVE_ACCESS_APPLICATION_NAME} has an unrelated allow policy: ${policy.name || "<unnamed>"}`);
    throw new Error(`${LIVE_ACCESS_APPLICATION_NAME} has an unrelated Access policy: ${policy.name || "<unnamed>"}`);
  }

  const existing = policies.find((policy) => policy.name === LIVE_ACCESS_POLICY_NAME) || null;
  if (existing) {
    if (!policyMatches(existing, bootstrapEmail)) throw new Error(`${LIVE_ACCESS_POLICY_NAME} exists with a different admission rule`);
    return existing;
  }
  return cloudflare(context, `/access/apps/${encodeURIComponent(app.id)}/policies`, {
    method: "POST",
    body: JSON.stringify({
      name: LIVE_ACCESS_POLICY_NAME,
      decision: "allow",
      precedence: 1,
      session_duration: "24h",
      include: [{ email: { email: bootstrapEmail } }],
      require: [],
      exclude: [],
    }),
  });
}

function accessAudience(app) {
  if (Array.isArray(app?.aud)) return String(app.aud[0] || "");
  return String(app?.aud || "");
}

export async function provisionLiveAccess({
  accountId,
  apiToken,
  bootstrapEmail = "chris@pecunies.com",
  platformApplicationId,
  fetcher = fetch,
} = {}) {
  const context = {
    accountId: ensureString(accountId, "Cloudflare account ID"),
    apiToken: ensureString(apiToken, "Cloudflare API token"),
    fetcher,
  };
  const admittedEmail = ensureString(bootstrapEmail, "Access bootstrap email").toLowerCase();
  const platformId = ensureString(platformApplicationId, "Platform Access application ID");
  const platform = await cloudflare(context, `/access/apps/${encodeURIComponent(platformId)}`);
  const allowedIdps = [...new Set((platform?.allowed_idps || []).map((value) => String(value).trim()).filter(Boolean))];
  if (!allowedIdps.length) throw new Error("Platform Access application has no admitted identity provider to reuse for Live");

  const app = await ensureApplication(context, allowedIdps);
  const audience = accessAudience(app);
  if (!app?.id || !audience) throw new Error("Cloudflare Live Access application response is incomplete");
  await ensurePolicy(context, app, admittedEmail);

  return Object.freeze({
    accessApplicationId: app.id,
    accessAudience: audience,
    bootstrapEmail: admittedEmail,
    destination: LIVE_ACCESS_DESTINATION.uri,
  });
}

export function renderLiveAccessWrangler(baseConfig, provisioned) {
  const config = structuredClone(baseConfig);
  const audience = ensureString(provisioned?.accessAudience, "Live Access audience");
  config.vars = { ...(config.vars || {}), LIVE_ACCESS_AUD: audience };
  return config;
}
