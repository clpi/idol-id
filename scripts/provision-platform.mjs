import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parseJsonc,
  provisionPlatform,
  renderProductionWrangler,
} from "./platform-provision-lib.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const emailDomain = process.env.IDOL_ACCESS_EMAIL_DOMAIN || "pecunies.com";
const teamName = process.env.IDOL_ACCESS_TEAM_NAME || "idol-clpi";

try {
  const provisioned = await provisionPlatform({ accountId, apiToken, emailDomain, teamName });
  const base = parseJsonc(await readFile(resolve(root, "wrangler.jsonc"), "utf8"));
  const production = renderProductionWrangler(base, provisioned);
  await writeFile(resolve(root, ".platform-provision.json"), `${JSON.stringify(provisioned, null, 2)}\n`, { mode: 0o600 });
  await writeFile(resolve(root, ".wrangler.production.jsonc"), `${JSON.stringify(production, null, 2)}\n`);

  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, [
      `database_id=${provisioned.databaseId}`,
      `database_name=${provisioned.databaseName}`,
      `team_domain=${provisioned.teamDomain}`,
      `access_application_id=${provisioned.accessApplicationId}`,
      `access_audience=${provisioned.accessAudience}`,
      `email_domain=${provisioned.emailDomain}`,
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
    email_domain: provisioned.emailDomain,
    config: ".wrangler.production.jsonc",
  }, null, 2));
} catch (error) {
  console.error(`platform provisioning failed: ${error.message}`);
  process.exitCode = 1;
}
