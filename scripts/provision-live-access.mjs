import { readFile } from "node:fs/promises";

const API = "https://api.cloudflare.com/client/v4";
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
if (!accountId || !apiToken) throw new Error("Cloudflare account ID and API token are required for Live Access provisioning");

const provisioned = JSON.parse(await readFile(".platform-provision.json", "utf8"));
const appId = String(provisioned.accessApplicationId || "").trim();
if (!appId) throw new Error("Platform provisioning did not publish an Access application ID");

async function cloudflare(path, init = {}) {
  const response = await fetch(`${API}/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers || {})
    }
  });
  const document = await response.json().catch(() => null);
  if (!response.ok || document?.success === false) {
    const detail = (document?.errors || []).map((error) => error.message).filter(Boolean).join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare ${init.method || "GET"} ${path} failed: ${detail}`);
  }
  return document.result;
}

const app = await cloudflare(`/access/apps/${encodeURIComponent(appId)}`);
const existing = Array.isArray(app.destinations)
  ? app.destinations
  : app.domain ? [{ type: "public", uri: app.domain }] : [];
const liveDestination = { type: "public", uri: "live.idol.id/*" };
const allowed = new Set([
  "public:platform.idol.id/ide*",
  "public:platform.idol.id/v1/ide/*",
  "public:platform.idol.id/v1/platform/browser/*",
  "public:platform.idol.id/universe*",
  "public:platform.idol.id/v1/universe/browser/*",
  "public:live.idol.id/*"
]);
const key = (destination) => `${String(destination?.type || "")}:${String(destination?.uri || "")}`;
for (const destination of existing) {
  if (!allowed.has(key(destination))) throw new Error(`refusing unknown Access destination while adding Live: ${destination.uri || "<missing>"}`);
}
const destinations = [...existing];
if (!destinations.some((destination) => key(destination) === key(liveDestination))) destinations.push(liveDestination);

if (destinations.length !== existing.length) {
  await cloudflare(`/access/apps/${encodeURIComponent(appId)}`, {
    method: "PUT",
    body: JSON.stringify({
      name: app.name,
      type: app.type,
      destinations,
      session_duration: app.session_duration || "24h",
      allowed_idps: app.allowed_idps || [],
      auto_redirect_to_identity: app.auto_redirect_to_identity !== false,
      app_launcher_visible: Boolean(app.app_launcher_visible),
      skip_interstitial: app.skip_interstitial !== false,
      custom_deny_message: app.custom_deny_message || "This private Idol Platform surface requires the admitted owner identity."
    })
  });
}

console.log(JSON.stringify({ live_access_provisioned: true, application_id: appId, destination: liveDestination.uri }, null, 2));
