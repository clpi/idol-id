const API = "https://api.cloudflare.com/client/v4";
const APPLICATION_NAME = "Idol Repository Observatory";
const POLICY_NAME = "Allow Idol owner email";
const DESTINATIONS = Object.freeze([
  Object.freeze({ type: "public", uri: "platform.idol.id/repo*" }),
  Object.freeze({ type: "public", uri: "platform.idol.id/v1/repository/browser/*" }),
]);

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
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
  try { document = await response.json(); }
  catch { throw new Error(`Cloudflare ${init.method || "GET"} ${path} returned invalid JSON (${response.status})`); }
  if (!response.ok || document.success === false) {
    const detail = (document.errors || []).map((error) => error.message).filter(Boolean).join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare ${init.method || "GET"} ${path} failed: ${detail}`);
  }
  return document.result;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function key(destination) {
  return `${String(destination?.type || "")}:${String(destination?.uri || "")}`;
}

function sameSet(left, right, project = (value) => JSON.stringify(stable(value))) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = new Set(left.map(project));
  const b = new Set(right.map(project));
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function applicationDocument(otp) {
  return {
    name: APPLICATION_NAME,
    type: "self_hosted",
    destinations: DESTINATIONS.map((destination) => ({ ...destination })),
    session_duration: "24h",
    allowed_idps: [otp.id],
    auto_redirect_to_identity: true,
    app_launcher_visible: false,
    skip_interstitial: true,
    custom_deny_message: "This private Idol repository surface requires the admitted owner identity.",
  };
}

function applicationMatches(application, document) {
  return sameSet(application?.destinations, document.destinations, key)
    && sameSet(application?.allowed_idps, document.allowed_idps, String)
    && [
      "name", "type", "session_duration", "auto_redirect_to_identity",
      "app_launcher_visible", "skip_interstitial", "custom_deny_message",
    ].every((field) => application?.[field] === document[field]);
}

function policyDocument(email) {
  return {
    name: POLICY_NAME,
    decision: "allow",
    precedence: 1,
    session_duration: "24h",
    include: [{ email: { email } }],
    require: [],
    exclude: [],
  };
}

function policyMatches(policy, document) {
  return policy?.name === document.name
    && policy?.decision === document.decision
    && Number(policy?.precedence) === document.precedence
    && policy?.session_duration === document.session_duration
    && sameSet(policy?.include, document.include)
    && sameSet(policy?.require, document.require)
    && sameSet(policy?.exclude, document.exclude);
}

function audience(application) {
  return Array.isArray(application?.aud) ? String(application.aud[0] || "") : String(application?.aud || "");
}

export async function provisionRepositoryAccess({ accountId, apiToken, bootstrapEmail, fetcher = fetch } = {}) {
  const context = {
    accountId: required(accountId, "Cloudflare account ID"),
    apiToken: required(apiToken, "Cloudflare API token"),
    fetcher,
  };
  const email = required(bootstrapEmail, "Access bootstrap email").toLowerCase();
  const providers = await cloudflare(context, "/access/identity_providers?per_page=100");
  const otp = (providers || []).find((provider) => provider.type === "onetimepin");
  if (!otp?.id) throw new Error("Cloudflare Access one-time PIN provider is unavailable");

  const applications = await cloudflare(context, "/access/apps?per_page=100");
  let application = (applications || []).find((candidate) => candidate.name === APPLICATION_NAME);
  const desiredApplication = applicationDocument(otp);
  if (!application) {
    application = await cloudflare(context, "/access/apps", { method: "POST", body: JSON.stringify(desiredApplication) });
  } else {
    for (const destination of application.destinations || []) {
      if (!DESTINATIONS.some((expected) => key(expected) === key(destination))) {
        throw new Error(`${APPLICATION_NAME} exists with an unknown destination: ${destination.uri || "<missing>"}`);
      }
    }
    if (!applicationMatches(application, desiredApplication)) {
      application = await cloudflare(context, `/access/apps/${encodeURIComponent(application.id)}`, {
        method: "PUT",
        body: JSON.stringify(desiredApplication),
      });
    }
  }
  if (!application?.id || !audience(application)) throw new Error("repository Access application response is incomplete");

  const policies = await cloudflare(context, `/access/apps/${encodeURIComponent(application.id)}/policies?per_page=100`);
  const unrelatedAllow = (policies || []).filter((policy) => policy.decision === "allow" && policy.name !== POLICY_NAME);
  if (unrelatedAllow.length) {
    throw new Error(`${APPLICATION_NAME} contains an unrelated allow policy: ${unrelatedAllow.map((policy) => policy.name || policy.id).join(", ")}`);
  }

  const desiredPolicy = policyDocument(email);
  let policy = (policies || []).find((candidate) => candidate.name === POLICY_NAME);
  if (!policy) {
    policy = await cloudflare(context, `/access/apps/${encodeURIComponent(application.id)}/policies`, {
      method: "POST",
      body: JSON.stringify(desiredPolicy),
    });
  } else if (!policyMatches(policy, desiredPolicy)) {
    policy = await cloudflare(context, `/access/apps/${encodeURIComponent(application.id)}/policies/${encodeURIComponent(policy.id)}`, {
      method: "PUT",
      body: JSON.stringify(desiredPolicy),
    });
  }
  if (!policyMatches(policy, desiredPolicy)) throw new Error("repository Access owner policy did not reconcile exactly");

  return Object.freeze({
    applicationId: application.id,
    audience: audience(application),
    bootstrapEmail: email,
    destinations: DESTINATIONS,
  });
}

export function attachRepositoryAccess(config, provisioned) {
  const result = structuredClone(config);
  result.vars = {
    ...(result.vars || {}),
    REPOSITORY_ACCESS_AUD: required(provisioned?.audience, "repository Access audience"),
  };
  return result;
}
