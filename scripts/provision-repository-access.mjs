import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {attachRepositoryAccess,provisionRepositoryAccess} from "./repository-access-lib.mjs";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
try{const platform=JSON.parse(await readFile(resolve(root,".platform-provision.json"),"utf8"));const provisioned=await provisionRepositoryAccess({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,apiToken:process.env.CLOUDFLARE_API_TOKEN,bootstrapEmail:platform.bootstrapEmail});const config=JSON.parse(await readFile(resolve(root,".wrangler.production.jsonc"),"utf8"));await writeFile(resolve(root,".wrangler.production.jsonc"),`${JSON.stringify(attachRepositoryAccess(config,provisioned),null,2)}\n`);console.log(JSON.stringify({repository_access:true,application_id:provisioned.applicationId,audience:provisioned.audience,destinations:provisioned.destinations},null,2));}catch(error){console.error(`repository Access provisioning failed: ${error.message}`);process.exitCode=1;}
