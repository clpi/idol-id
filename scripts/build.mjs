import { access, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseForeignWorld } from "../shared/foreign.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = join(root, "dist");
const authorityPin = JSON.parse(await readFile(join(root, "runtime", "authority.json"), "utf8"));
const authority = authorityPin.language.commit;
const native = authorityPin.native.commit;
const commit = process.env.GITHUB_SHA || process.env.IDOL_WEB_COMMIT || "development";

async function exists(path) {
  try { await access(path, constants.R_OK); return true; }
  catch { return false; }
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a nonempty string`);
  return value.trim();
}

function requireAuthority(value, label) {
  if (value !== authority) throw new Error(`${label} authority drift: expected ${authority}, received ${value}`);
}

function validateForeignSource(source) {
  if (!source || source.schema !== "idol.web.foreign.source.v1") throw new Error("foreign source schema mismatch");
  const revision = requireText(source.revision, "foreign revision");
  if (!Array.isArray(source.worlds) || !source.worlds.length) throw new Error("foreign source requires worlds[]");
  if (!Array.isArray(source.import_kinds) || !source.import_kinds.length) throw new Error("foreign source requires import_kinds[]");
  const worlds = source.worlds.map((candidate, index) => {
    requireText(candidate?.slug, `foreign world ${index} slug`);
    requireText(candidate?.name, `foreign world ${index} name`);
    requireText(candidate?.version, `foreign world ${index} version`);
    if (candidate.semantic_id !== null) throw new Error(`foreign world ${candidate.slug} must not fabricate semantic_id`);
    if (candidate.identity_status !== "not-published") throw new Error(`foreign world ${candidate.slug} identity_status must be not-published`);
    requireText(candidate?.provenance?.origin?.family, `foreign world ${candidate.slug} origin family`);
    if (!Array.isArray(candidate.uncertainty) || !candidate.uncertainty.length) throw new Error(`foreign world ${candidate.slug} requires uncertainty`);
    if (!Array.isArray(candidate.projections) || !candidate.projections.length) throw new Error(`foreign world ${candidate.slug} requires projections`);
    for (const projection of candidate.projections) {
      requireText(projection.id, `foreign world ${candidate.slug} projection id`);
      requireText(projection.target, `foreign world ${candidate.slug} projection target`);
      requireText(projection.status, `foreign world ${candidate.slug} projection status`);
      if (!projection.obligations || typeof projection.obligations !== "object") throw new Error(`projection ${projection.id} requires obligations`);
      if (!projection.evidence || typeof projection.evidence !== "object") throw new Error(`projection ${projection.id} requires evidence`);
      if (!projection.refusal || typeof projection.refusal !== "object") throw new Error(`projection ${projection.id} requires refusal`);
      if (projection.status === "available") {
        if (!projection.artifact?.sha256 || projection.evidence.status !== "verified") throw new Error(`available projection ${projection.id} requires signed artifact evidence`);
      } else if (Object.hasOwn(projection, "copy_command")) throw new Error(`unavailable projection ${projection.id} cannot publish a copy command`);
    }
    return normaliseForeignWorld(candidate);
  });
  const kinds = source.import_kinds.map((record, index) => {
    const kind = requireText(record?.kind, `import kind ${index}`);
    for (const field of ["stages", "required_grants", "missing_facts", "refusals"]) {
      if (!Array.isArray(record[field]) || !record[field].length) throw new Error(`import kind ${kind} requires ${field}[]`);
    }
    return record;
  });
  return { revision, worlds, import_kinds: kinds };
}

function injectBeforeModule(html, scripts, label) {
  const marker = /<script type="module">/i;
  if (!marker.test(html)) throw new Error(`${label} has no module entrypoint`);
  return html.replace(marker, `${scripts.join("\n")}\n<script type="module">`);
}

function injectBeforeBodyEnd(html, scripts, label) {
  if (!/<\/body>/i.test(html)) throw new Error(`${label} has no body end`);
  return html.replace(/<\/body>/i, `${scripts.join("\n")}\n</body>`);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const directory of ["apps", "shared", "content", "native"]) {
  await cp(join(root, directory), join(dist, directory), { recursive: true });
}

const runtimeScripts = [
  '<script src="/shared/web.js" defer></script>',
  '<script src="/shared/wasm.js" defer></script>',
].join("\n    ");
const apps = ["site", "docs", "lib", "api", "graph", "worlds", "platform", "ide", "repository", "universe", "live", "mcp"];
for (const app of apps) {
  const path = join(dist, "apps", app, "index.html");
  let html = await readFile(path, "utf8");
  if (!html.includes("/shared/web.js")) html = html.replace(/<head([^>]*)>/i, `<head$1>\n    <!-- idol runtime -->\n    ${runtimeScripts}`);
  const tail = [];
  if (!html.includes("/shared/repository-nav.js")) tail.push('<script src="/shared/repository-nav.js"></script>');
  if (app === "platform" && !html.includes("/shared/platform-ide-entry.js")) tail.push('<script src="/shared/platform-ide-entry.js"></script>');
  if (app === "platform" && !html.includes("/shared/platform-repository-entry.js")) tail.push('<script src="/shared/platform-repository-entry.js"></script>');
  if (app === "platform" && !html.includes("/shared/platform-universe-entry.js")) tail.push('<script src="/shared/platform-universe-entry.js"></script>');
  if (app === "site" && !html.includes("/shared/site-install-entry.js")) tail.push('<script src="/shared/site-install-entry.js"></script>');
  if (tail.length) html = injectBeforeBodyEnd(html, tail, app);
  if (app === "ide" && !html.includes("/shared/ide-semantic-layer.js")) {
    html = injectBeforeModule(html, [
      '<script src="/shared/ide-semantic-layer.js"></script>',
      '<script src="/shared/ide-directory.js"></script>',
    ], "IDE");
  }
  await writeFile(path, html);
}

await mkdir(join(dist, "runtime"), { recursive: true });
const runtimeFiles = [
  "authority.json", "source-law.json", "worlds.json", "semantic-graph-contract.json",
  "native-runtime.json", "live.json", "mcp.json",
];
for (const file of runtimeFiles) await cp(join(root, "runtime", file), join(dist, "runtime", file));

const sourceLaw = JSON.parse(await readFile(join(root, "runtime", "source-law.json"), "utf8"));
const sourceExamples = JSON.parse(await readFile(join(root, "content", "source-examples.json"), "utf8"));
const graphContract = JSON.parse(await readFile(join(root, "runtime", "semantic-graph-contract.json"), "utf8"));
const nativeRuntime = JSON.parse(await readFile(join(root, "runtime", "native-runtime.json"), "utf8"));
const liveProjection = JSON.parse(await readFile(join(root, "runtime", "live.json"), "utf8"));
const mcpProjection = JSON.parse(await readFile(join(root, "runtime", "mcp.json"), "utf8"));
requireAuthority(sourceLaw.authority.commit, "source law");
requireAuthority(sourceExamples.authority.commit, "source examples");
requireAuthority(graphContract.authority.commit, "graph contract");
requireAuthority(nativeRuntime.authority.language.commit, "native runtime");
requireAuthority(liveProjection.authority.language, "Live projection");
requireAuthority(mcpProjection.authority.language, "MCP projection");
if (nativeRuntime.authority.native.commit !== native) throw new Error("native runtime native-authority drift");

const languageAuthority = {
  schema: "idol.web.language-authority.v1",
  semantic_authority: false,
  presentation_projection: true,
  authority: authorityPin,
  source_law: "/runtime/source-law.json",
  source_examples: "/content/source-examples.json",
  graph_contract: "/runtime/semantic-graph-contract.json",
  implementation: {
    complete_generated_grammar: false,
    graph_sovereignty_complete: false,
    compiler_b: false,
    compiler_c: false,
    self_hosted: false,
    browser_wasm_admitted: false,
    live_realtime_store: false,
  },
};
await writeFile(join(dist, "runtime", "language-authority.json"), `${JSON.stringify(languageAuthority, null, 2)}\n`);

const foreignSource = validateForeignSource(JSON.parse(await readFile(join(root, "content", "foreign.json"), "utf8")));
const foreignManifest = {
  schema: "idol.web.foreign.v1",
  revision: foreignSource.revision,
  authority: {
    language: { repository: authorityPin.language.repository, commit: authority },
    native: { repository: authorityPin.native.repository, commit: native },
  },
  worlds: foreignSource.worlds,
  import_kinds: foreignSource.import_kinds,
};
await writeFile(join(dist, "runtime", "foreign.json"), `${JSON.stringify(foreignManifest, null, 2)}\n`);

const configured = process.env.IDOL_WASM_PATH ? resolve(process.env.IDOL_WASM_PATH) : join(root, "runtime", "idol-web.wasm");
let wasm = { available: false, admitted: false, file: null, bytes: 0, sha256: null, descriptor: null };
if (await exists(configured)) {
  const descriptorPath = process.env.IDOL_WASM_DESCRIPTOR_PATH ? resolve(process.env.IDOL_WASM_DESCRIPTOR_PATH) : "";
  if (!descriptorPath || !(await exists(descriptorPath))) throw new Error("IDOL_WASM_DESCRIPTOR_PATH is required when IDOL_WASM_PATH is supplied");
  const descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
  const content = await readFile(configured);
  const sha256 = createHash("sha256").update(content).digest("hex");
  if (descriptor.schema !== "idol.wasm.capability.v1") throw new Error("Idol Wasm descriptor schema mismatch");
  if (descriptor.artifact_sha256 !== sha256) throw new Error("Idol Wasm descriptor artifact hash mismatch");
  if (descriptor.authority?.language !== authority || descriptor.authority?.native !== native) throw new Error("Idol Wasm descriptor authority mismatch");
  if (descriptor.correspondence?.status !== "verified") throw new Error("Idol Wasm correspondence witness is not verified");
  const target = join(dist, "runtime", "idol-web.wasm");
  await cp(configured, target);
  await writeFile(join(dist, "runtime", "idol-web.capability.json"), `${JSON.stringify(descriptor, null, 2)}\n`);
  wasm = { available: true, admitted: true, file: "/runtime/idol-web.wasm", bytes: (await stat(target)).size, sha256, descriptor: "/runtime/idol-web.capability.json" };
}

const ide = { route: "https://platform.idol.id/ide", local_storage: "indexeddb", source_upload: "explicit-remote-analysis-only", remote_analysis: "/v1/ide/analyze", browser_wasm: wasm.admitted };
const repository = {
  route: "https://platform.idol.id/repo",
  visibility: "public-repository-metadata-only",
  providers: ["github", "gitlab", "bitbucket"],
  browser_observe: "/v1/repository/browser/observe",
  api_observe: "/v1/repository/api/observe",
  scaffold: "review-only",
  transformation: {
    status: "derived-world-preview-only",
    browser_create: "/v1/repository/browser/scaffolds/:id/transformations",
    api_create: "/v1/repository/api/scaffolds/:id/transformations",
    semantic_identity: "not-published",
    evidence: "unexecuted",
    execution: false,
    source_world_mutation: false,
    repository_write: false,
    world_publication: false,
  },
  mutation: false,
  source_transfer: "provider tree metadata only",
  installer: { unix: "/install", unix_alias: "/install.sh", windows: "/install.ps1", kind: "bootstrap-seed", self_hosted: false },
};
const universe = {
  manager: "https://platform.idol.id/universe",
  public: "https://worlds.idol.id/universe",
  browser_views: "/v1/universe/browser/views",
  api_views: "/v1/universe/api/views",
  public_views: "/v1/universe/public",
  kind: "operational-projection",
  semantic_universes: 1,
  semantic_identity: "not-published",
  composition: "not-proven",
  reachability: "published-facts-only",
  compatibility: "not-proven",
  equivalence: "not-proven",
  injection: "not-proven",
  authority_grant: "none",
  execution: false,
  source_world_mutation: false,
  world_publication: false,
  dispatcher_access: false,
};
const runtimeManifest = {
  schema: "idol.web.runtime.v1",
  authority: { repository: "clpi/idol", commit: authority },
  native: { repository: "clpi/idol-native", commit: native },
  authority_projection: "/runtime/authority.json",
  language_authority: "/runtime/language-authority.json",
  source_law: "/runtime/source-law.json",
  source_examples: "/content/source-examples.json",
  semantic_graph: "/runtime/semantic-graph-contract.json",
  native_runtime: "/runtime/native-runtime.json",
  live: { route: "https://live.idol.id", projection: "/runtime/live.json", mutation: false },
  mcp: { route: "https://mcp.idol.id", endpoint: "https://mcp.idol.id/mcp", projection: "/runtime/mcp.json", mutation: false },
  browser_preview: { kind: "lexical-provenance", semantic_identity: false, exact_span_only: true, shadow_grammar: false },
  bridge: "/shared/web.js",
  worlds: "/runtime/worlds.json",
  foreign: "/runtime/foreign.json",
  wasm,
  ide,
  repository,
  universe,
  note: wasm.admitted ? "An artifact-bound, correspondence-verified Idol Wasm realization is deployed." : "No Idol Wasm realization is admitted; JavaScript remains transport and presentation only.",
};
await writeFile(join(dist, "runtime", "manifest.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);

const surfaces = {
  "idol.id": "site",
  "docs.idol.id": "docs",
  "lib.idol.id": "lib",
  "api.idol.id": "api",
  "graph.idol.id": "graph",
  "worlds.idol.id": "worlds",
  "platform.idol.id": "platform",
  "live.idol.id": "live",
  "mcp.idol.id": "mcp",
  "r8a.idol.id": "graph:r8a",
  "r8b.idol.id": "graph:r8b",
  "r16.idol.id": "graph:r16",
};
const manifest = { schema: "idol.web.deploy.v1", commit, authority, surfaces, runtime: runtimeManifest };
await writeFile(join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`built ${Object.keys(surfaces).length} idol.id surfaces plus protected IDE, repository, derived-preview, and Universe View workbenches at ${commit}`);
console.log(`foreign candidates: ${foreignManifest.worlds.length} · revision ${foreignManifest.revision}`);
console.log(`idol wasm: ${wasm.admitted ? `${wasm.bytes} bytes ${wasm.sha256}` : "not admitted"}`);
