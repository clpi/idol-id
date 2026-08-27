import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseJsonc,
  provisionPlatform,
  renderProductionWrangler,
} from "./platform-provision-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const bootstrapEmail = process.env.IDOL_ACCESS_EMAIL || "chris@pecunies.com";
const teamName = process.env.IDOL_ACCESS_TEAM_NAME || "idol-clpi";
const webCommit = process.env.GITHUB_SHA || process.env.IDOL_WEB_COMMIT || "development";

try {
  const authorityProjection = JSON.parse(await readFile(resolve(root, "runtime/authority.json"), "utf8"));
  const authorityCommit = String(authorityProjection?.language?.commit || "").trim();
  if (!/^[0-9a-f]{40}$/.test(authorityCommit)) throw new Error("runtime/authority.json has no exact language commit");

  const provisioned = await provisionPlatform({ accountId, apiToken, bootstrapEmail, teamName });
  const base = parseJsonc(await readFile(resolve(root, "wrangler.jsonc"), "utf8"));
  const production = renderProductionWrangler(base, provisioned, { webCommit });
  production.vars = { ...(production.vars || {}), IDOL_AUTHORITY: authorityCommit };
  await writeFile(resolve(root, ".platform-provision.json"), `${JSON.stringify(provisioned, null, 2)}\n`, { mode: 0o600 });
  await writeFile(resolve(root, ".wrangler.production.jsonc"), `${JSON.stringify(production, null, 2)}\n`);

  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, [
      `database_id=${provisioned.databaseId}`,
      `database_name=${provisioned.databaseName}`,
      `team_domain=${provisioned.teamDomain}`,
      `access_application_id=${provisioned.accessApplicationId}`,
      `access_audience=${provisioned.accessAudience}`,
      `bootstrap_email=${provisioned.bootstrapEmail}`,
      `language_authority=${authorityCommit}`,
      "config=.wrangler.production.jsonc",
      "",
    ].join("\n"), { flag: "a" });
  }

  console.log(JSON.stringify({
    provisioned: true,
    database: provisioned.databaseName,
    database_id: provisioned.databaseId,
    team_domain: provisioned.teamDomain,
    access_application_id: provisioned.accessApplicationId,
    access_audience: provisioned.accessAudience,
    bootstrap_email: provisioned.bootstrapEmail,
    web_commit: webCommit,
    language_authority: authorityCommit,
    config: ".wrangler.production.jsonc",
  }, null, 2));
} catch (error) {
  console.error(`platform provisioning failed: ${error.message}`);
  process.exitCode = 1;
}
