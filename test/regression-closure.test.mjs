import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { handle } from "../worker/index.js";
import { renderProductionWrangler } from "../scripts/platform-provision-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const readJson = async (path) => JSON.parse(await read(path));
const exactCommit = /^[0-9a-f]{40}$/;

function parseJsonc(source) {
  return JSON.parse(String(source)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, ""));
}

async function filesBelow(directory, predicate) {
  const found = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if ([".git", "dist", "node_modules", ".wrangler-dry-run"].includes(entry.name)) continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile() && predicate(child)) found.push(relative(root, child));
    }
  }
  await visit(resolve(root, directory));
  return found.sort();
}

function authorityAsset(document) {
  return {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/runtime/authority.json") {
        return Response.json(document, { headers: { "cache-control": "no-store" } });
      }
      return new Response("missing", { status: 404 });
    },
  };
}

const provisioned = Object.freeze({
  databaseName: "idol-platform",
  databaseId: "database",
  teamDomain: "idol-clpi.cloudflareaccess.com",
  accessAudience: "audience",
  bootstrapEmail: "chris@pecunies.com",
});

test("one authority projection owns installers, Worker identity, Cloudflare config, and emitted manifests", async () => {
  const authority = await readJson("runtime/authority.json");
  const sourceLaw = await readJson("runtime/source-law.json");
  const examples = await readJson("content/source-examples.json");
  const wrangler = parseJsonc(await read("wrangler.jsonc"));
  const unix = await read("content/install.sh");
  const windows = await read("content/install.ps1");
  const worker = await read("worker/index.js");
  const spec = await read("content/docs/spec.md");

  assert.match(authority.language.commit, exactCommit);
  assert.match(authority.native.commit, exactCommit);
  assert.equal(sourceLaw.authority.commit, authority.language.commit);
  assert.equal(examples.authority.commit, authority.language.commit);
  assert.match(spec, new RegExp(authority.language.commit));
  assert.match(unix, new RegExp(authority.language.commit));
  assert.match(windows, new RegExp(authority.language.commit));
  assert.equal(wrangler.vars.IDOL_AUTHORITY, authority.language.commit);
  assert.equal(wrangler.vars.IDOL_NATIVE_AUTHORITY, authority.native.commit);
  assert.equal(wrangler.vars.IDOL_SOURCE_LAW, authority.language.source_law.sha256);
  assert.doesNotMatch(worker, /IDOL_AUTHORITY\s*\|\|\s*["'][0-9a-f]{40}["']/);

  const production = renderProductionWrangler({ name: "idol-id", vars: { IDOL_AUTHORITY: "stale" } }, provisioned, {
    webCommit: "web",
    authority,
  });
  assert.equal(production.vars.IDOL_AUTHORITY, authority.language.commit);
  assert.equal(production.vars.IDOL_NATIVE_AUTHORITY, authority.native.commit);
  assert.equal(production.vars.IDOL_SOURCE_LAW, authority.language.source_law.sha256);
});

test("version, health, and browser config read the immutable authority asset instead of an environment fallback", async () => {
  const authority = {
    schema: "idol.web.authority.v1",
    language: { repository: "clpi/idol", commit: "language", source_law: { sha256: "law" } },
    native: { repository: "clpi/idol-native", commit: "native" },
  };
  const env = {
    IDOL_COMMIT: "web",
    IDOL_AUTHORITY: "wrong-environment-value",
    ASSETS: authorityAsset(authority),
  };

  const version = await handle(new Request("https://idol.id/__idol/version"), env);
  assert.equal(version.status, 200);
  assert.deepEqual(await version.json(), {
    service: "idol-id",
    commit: "web",
    authority: "language",
    native_authority: "native",
    source_law: "law",
    app: "site",
    surface: "site",
  });

  const health = await handle(new Request("https://idol.id/__idol/health"), env);
  const healthDocument = await health.json();
  assert.equal(healthDocument.authority, "language");
  assert.equal(healthDocument.native_authority, "native");
  assert.equal(healthDocument.source_law, "law");

  const config = await handle(new Request("https://idol.id/config.js"), env);
  assert.match(await config.text(), /"authority":"language"/);

  const missing = await handle(new Request("https://idol.id/__idol/version"), {
    IDOL_COMMIT: "web",
    ASSETS: authorityAsset(null),
  });
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, "RUNTIME_AUTHORITY_UNAVAILABLE");
});

test("product prose and controls use sans while exact code and semantic identities use Iosevka", async () => {
  const theme = await read("shared/theme.css");
  const editor = await read("shared/idol.js");

  assert.match(theme, /body\s*\{[\s\S]*?font-family:\s*var\(--sans\)/);
  assert.match(theme, /button,\s*\.btn\s*\{[\s\S]*?font-family:\s*var\(--sans\)/);
  assert.match(theme, /input\[type="text"\][\s\S]*?font-family:\s*var\(--sans\)/);
  assert.match(theme, /code,\s*pre\s*\{[\s\S]*?font-family:\s*var\(--mono\)/);
  assert.match(theme, /kbd\s*\{[\s\S]*?font-family:\s*var\(--mono\)/);
  assert.match(editor, /editor-input[\s\S]*?font:var\(--fs-code\)\/var\(--lh-code\) var\(--mono\)/);
});

test("a Wasm file is never admitted from path existence alone", async () => {
  const directory = await mkdtemp(join(tmpdir(), "idol-wasm-refusal-"));
  const artifact = join(directory, "candidate.wasm");
  await writeFile(artifact, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
  try {
    const run = spawnSync(process.execPath, ["scripts/build.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, IDOL_WASM_PATH: artifact, IDOL_WASM_DESCRIPTOR_PATH: "" },
    });
    assert.notEqual(run.status, 0, "an unaccompanied Wasm file was incorrectly admitted");
    assert.match(`${run.stdout}\n${run.stderr}`, /IDOL_WASM_DESCRIPTOR_PATH.*required/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const loader = await read("shared/wasm.js");
  assert.match(loader, /admission[^\n]*admitted/i);
  assert.match(loader, /SHA-256|sha256/i);
  assert.match(loader, /crypto\.subtle\.digest/);
});

test("every authored Idol source carries explicit compiler and source-law provenance", async () => {
  const sources = await filesBelow(".", (path) => /\.(?:id|idol)$/.test(path));
  const manifest = await readJson("runtime/idol-source-manifest.json");
  const authority = await readJson("runtime/authority.json");
  const entries = new Map(manifest.sources.map((entry) => [entry.path, entry]));

  assert.equal(manifest.schema, "idol.web.authored-source.v1");
  for (const source of sources) {
    const entry = entries.get(source);
    assert.ok(entry, `authored Idol source has no provenance record: ${source}`);
    assert.equal(entry.authority.commit, authority.language.commit);
    assert.equal(entry.authority.source_law, authority.language.source_law.sha256);
    assert.match(entry.source_sha256, /^[0-9a-f]{64}$/);
    assert.match(entry.status, /^(?:compile-verified|lawful-source-implementation-not-claimed)$/);
  }
  assert.deepEqual([...entries.keys()].sort(), sources);
});

test("CI detects upstream authority drift and verifies the deployed multi-surface identity after every main push", async () => {
  const deploy = await read(".github/workflows/deploy.yml");
  const sync = await read(".github/workflows/authority-sync.yml");
  const packageDocument = await readJson("package.json");

  assert.match(packageDocument.scripts["authority:check"], /check-authority\.mjs/);
  assert.match(packageDocument.scripts.check, /authority:check/);
  assert.match(deploy, /Verify deployed authority and every configured host/);
  assert.match(deploy, /scripts\/verify-production\.mjs/);
  assert.match(sync, /schedule:/);
  assert.match(sync, /scripts\/sync-authority\.mjs/);
  assert.match(sync, /pull-requests:\s*write/);
});
