import { readFile, writeFile } from "node:fs/promises";
import {
  LIVE_ACCESS_APPLICATION_NAME,
  provisionLiveAccess,
  renderLiveAccessWrangler,
} from "./live-access-lib.mjs";

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
if (!accountId || !apiToken) throw new Error("Cloudflare account ID and API token are required for Live Access provisioning");

const platform = JSON.parse(await readFile(".platform-provision.json", "utf8"));
const production = JSON.parse(await readFile(".wrangler.production.jsonc", "utf8"));
const live = await provisionLiveAccess({
  accountId,
  apiToken,
  bootstrapEmail: platform.bootstrapEmail,
  platformApplicationId: platform.accessApplicationId,
});

await writeFile(
  ".wrangler.production.jsonc",
  `${JSON.stringify(renderLiveAccessWrangler(production, live), null, 2)}\n`,
);

if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, [
    `live_access_application_id=${live.accessApplicationId}`,
    `live_access_audience=${live.accessAudience}`,
    "",
  ].join("\n"), { flag: "a" });
}

console.log(JSON.stringify({
  live_access_provisioned: true,
  application: LIVE_ACCESS_APPLICATION_NAME,
  application_id: live.accessApplicationId,
  audience: live.accessAudience,
  destination: live.destination,
  wrangler_variable: "LIVE_ACCESS_AUD",
}, null, 2));
