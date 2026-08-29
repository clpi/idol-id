import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = join(root, "dist");

async function requireFile(path, label) {
  try { await access(path, constants.R_OK); }
  catch { throw new Error(`${label} is missing from the immutable build: ${path}`); }
}
async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`); }
function injectBeforeBodyEnd(html, source, label) {
  if (html.includes(source)) return html;
  if (!/<\/body>/i.test(html)) throw new Error(`${label} has no body end`);
  return html.replace(/<\/body>/i, `<script src="${source}"></script>\n</body>`);
}

for (const [path, label] of [
  [join(dist, "apps", "live", "index.html"), "Live application shell"],
  [join(dist, "apps", "mcp", "index.html"), "MCP application shell"],
  [join(dist, "shared", "live-app.js"), "Live application controller"],
  [join(dist, "shared", "live-app.css"), "Live application styles"],
  [join(root, "runtime", "live-contract.json"), "Live runtime contract"],
  [join(root, "live", "model.id"), "Live lawful source model"],
  [join(root, "live", "projection.id"), "Live lawful projection model"],
]) await requireFile(path, label);

for (const [app, source] of [
  ["platform", "/shared/platform-live-entry.js"],
  ["site", "/shared/site-live-entry.js"],
]) {
  const path = join(dist, "apps", app, "index.html");
  await writeFile(path, injectBeforeBodyEnd(await readFile(path, "utf8"), source, app));
}

await mkdir(join(dist, "live"), { recursive: true });
await cp(join(root, "live"), join(dist, "live"), { recursive: true, force: true });
await cp(join(root, "runtime", "live-contract.json"), join(dist, "runtime", "live-contract.json"));

const runtimePath = join(dist, "runtime", "manifest.json");
const deployPath = join(dist, "manifest.json");
const productPath = join(dist, "runtime", "product-model.json");
const runtime = await readJson(runtimePath);
const deploy = await readJson(deployPath);
const product = await readJson(productPath);
const contract = await readJson(join(dist, "runtime", "live-contract.json"));

runtime.live = "/runtime/live-contract.json";
runtime.mcp = {
  schema: "idol.web.mcp.runtime.v1",
  endpoint: "https://mcp.idol.id/mcp",
  transport: "streamable-http-stateless",
  protocol: "2026-07-28",
  compatibility: ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"],
  authentication: "platform-api-token",
  required_scope: "mcp:connect",
  session_state: false,
  semantic_authority: false,
  delegation: "existing-authority-bound-services"
};

deploy.surfaces["live.idol.id"] = "live";
deploy.surfaces["mcp.idol.id"] = "mcp";
deploy.runtime = runtime;

product.surfaces.live = {
  kind: "collaboration-control-plane-projection",
  canonical: "https://live.idol.id",
  semantic_authority: false,
  semantic_identity: "not-published",
  history: "one-immutable-causal-history-per-project",
  frontier: "one-accepted-frontier-per-project",
  relation_identity_owner: "live-project-application-record",
  structural_edges: "derived-projection",
  world_authority_grant: "none"
};
product.surfaces.mcp = {
  kind: "tool-transport-projection",
  canonical: "https://mcp.idol.id/mcp",
  semantic_authority: false,
  session_state: false
};

await writeJson(join(dist, "runtime", "mcp.json"), runtime.mcp);
await writeJson(productPath, product);
await writeJson(runtimePath, runtime);
await writeJson(deployPath, deploy);

if (contract.semantic_authority !== false || contract.idol_execution_admitted !== false) {
  throw new Error("Live contract overclaims semantic authority or Idol execution");
}
console.log(`extended immutable deployment with Live and MCP at ${deploy.commit}`);
