import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

const CURRENT_IDOL = "16ba848af17277b36137fd4ca308ffdb8a2730dd";
const CURRENT_NATIVE = "ad438a856daa8786e77ac9f033d38deb9e8f5c29";
const SPEC_SHA256 = "0653bf7a543cf399c73b14948dd3b2b87f784d09442fdabe653fc865a2e2fd63";
const LIVE_SHA256 = "10dd02a98c160b5be3e87d421138ce67f46635ecebcb94df5973e379b2846e05";

const read = (path) => readFile(path, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function parseJsonc(source) {
  return JSON.parse(source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1"));
}

test("one exact authority producer is current and every active consumer follows it", async () => {
  const authority = JSON.parse(await read("runtime/authority.json"));
  assert.equal(authority.language.commit, CURRENT_IDOL);
  assert.equal(authority.native.commit, CURRENT_NATIVE);

  await access("scripts/check-upstream-authority.mjs");
  const workflow = await read(".github/workflows/deploy.yml");
  assert.match(workflow, /node scripts\/check-upstream-authority\.mjs/);

  const active = await Promise.all([
    read("wrangler.jsonc"),
    read("worker/index.js"),
    read("content/install.sh"),
    read("content/install.ps1"),
    read("scripts/build.mjs"),
    read("README.md"),
  ]);
  const joined = active.join("\n");
  for (const stale of [
    "f33bb3773484e7d954a2975211e683dfa89edab5",
    "e33b0748f6cb8c092fa99368c31ec76c86673aa4",
    "d422ef33c88811b99523ef0cc19a03bd158dd3c0",
    "932a3ade3fa40c0653242559305fb67ffa142e84",
  ]) assert.doesNotMatch(joined, new RegExp(stale));
});

test("the uploaded specification and Idol Live thesis are committed byte-exact with an honest manifest", async () => {
  const manifest = JSON.parse(await read("authority/manifest.json"));
  const spec = await read("authority/Spec.md");
  const live = await read("authority/Idol-live.md");

  assert.equal(sha256(spec), SPEC_SHA256);
  assert.equal(sha256(live), LIVE_SHA256);
  assert.equal(manifest.artifacts["Spec.md"].sha256, SPEC_SHA256);
  assert.equal(manifest.artifacts["Idol-live.md"].sha256, LIVE_SHA256);
  assert.equal(manifest.semantic_authority, false);
  assert.equal(manifest.language_authority.repository, "clpi/idol");
});

test("product UI is sans-first while source and exact identities remain Iosevka", async () => {
  const theme = await read("shared/theme.css");
  assert.match(theme, /body\s*\{[\s\S]*?font-family:\s*var\(--sans\)/);
  assert.match(theme, /code,\s*pre[\s\S]*?font-family:\s*var\(--mono\)/);
  assert.match(theme, /\.mono-note[\s\S]*?font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(theme, /body\s*\{[\s\S]*?font-family:\s*var\(--mono\)/);
});

test("public API examples are selected from the authority-pinned example manifest", async () => {
  const api = await read("apps/api/index.html");
  assert.doesNotMatch(api, /\bstdout\s*:/);
  assert.match(api, /content\/source-examples\.json/);
  assert.match(api, /authority-pinned/i);
});

test("every Worker hostname has an explicit deployment route", async () => {
  const { hostMap } = await import("../worker/index.js");
  const wrangler = parseJsonc(await read("wrangler.jsonc"));
  const routed = new Set((wrangler.routes || []).map((route) => route.pattern.split("/")[0]));
  for (const hostname of Object.keys(hostMap)) {
    assert.ok(routed.has(hostname), `${hostname} is accepted by the Worker but has no Wrangler route`);
  }
});

test("main-branch safety is documented and the recovery gate is part of the normal check", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const policy = await read("docs/RECOVERY_AND_RELEASE_GATES.md");
  assert.match(pkg.scripts.check, /recovery:check/);
  assert.match(pkg.scripts["recovery:check"], /check-upstream-authority/);
  assert.match(policy, /required pull request/i);
  assert.match(policy, /branch protection/i);
  assert.match(policy, /cannot guarantee/i);
});
