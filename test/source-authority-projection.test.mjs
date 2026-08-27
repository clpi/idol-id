import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");

const CURRENT_LANGUAGE_COMMIT = "447c708353bf4b27b0b39bdb7890f713078d769b";
const CURRENT_COMPACT_LAW_BLOB = "155edf8e9204d00316dab8363676f0fd7b2fb552";
const CURRENT_SOURCE_LAW = "95e70291b13062881ebc6c96005c5ad02230bf5b5a7e62ced4f6e8787ab4993b";

function gitBlobSha(text) {
  return createHash("sha1")
    .update(`blob ${Buffer.byteLength(text)}\0`)
    .update(text)
    .digest("hex");
}

function idolFences(markdown) {
  return [...markdown.matchAll(/```(?:id|idol)\s*\n([\s\S]*?)```/g)].map((match) => match[1]);
}

const NONCANONICAL_NATIVE = [
  [/--/, "Lua comment spelling"],
  [/->/, "invented arrow body"],
  [/\|>/, "pipeline operator"],
  [/\(:\)/, "anonymous receiver slot"],
  [/@\./, "redundant world projection"],
  [/@:/, "world dispatch spelling"],
  [/\bbreak\s*\(\s*\)/, "call-shaped break"],
  [/\bcontinue\s*\(\s*\)/, "call-shaped continue"],
  [/\bthen\b/, "Lua then"],
  [/\bdo\b/, "Lua do"],
  [/\bend\b/, "Lua end"],
  [/\belseif\b/, "Lua elseif"],
  [/\bfunction\b/, "function keyword"],
  [/\bfun\b/, "fun keyword"],
  [/\blocal\b/, "local keyword"],
];

function assertCanonicalNative(source, label) {
  for (const [pattern, description] of NONCANONICAL_NATIVE) {
    assert.doesNotMatch(source, pattern, `${label} contains ${description}`);
  }
}

test("homepage source is an exact current-law projection rather than invented runnable code", async () => {
  const site = await read("apps/site/index.html");
  assertCanonicalNative(site, "homepage");
  assert.doesNotMatch(site, /\bio\.print\b/, "homepage invents an io home");
  assert.doesNotMatch(site, /\bstr\.from\b/, "homepage invents a static conversion namespace");
  assert.doesNotMatch(site, /\bmain\s*=/, "homepage invents main ceremony");
  assert.match(site, /content\/source-examples\.json/, "homepage must load the authority-pinned example manifest");
});

test("all authored native examples reject compatibility syntax and placeholder bodies", async () => {
  for (const path of ["content/docs/faces.md", "apps/graph/index.html"]) {
    const source = await read(path);
    const examples = path.endsWith(".md") ? idolFences(source) : [source];
    for (const [index, example] of examples.entries()) {
      assertCanonicalNative(example, `${path} example ${index + 1}`);
      assert.doesNotMatch(example, /^\s*\.\.\.\s*$/m, `${path} example ${index + 1} contains an invented placeholder body`);
    }
  }
});

test("browser preview segments source without owning a shadow grammar or inferring semantic identity", async () => {
  const source = await read("shared/idol.js");
  for (const pattern of [
    /Lexer \(closed lexical grammar\)/,
    /const KW\s*=/,
    /const CTX\s*=/,
    /const TYPES\s*=/,
    /FACE_NOTE/,
    /name \+ kind match anywhere/,
    /byNameKind/,
    /tok\(j > i \+ 1 \? "direct"/,
    /long comment --\[\[/,
    /\["=="[^\n]*"->"/,
  ]) assert.doesNotMatch(source, pattern);
  assert.match(source, /semantic identity not published/i);
  assert.match(source, /exact source span/i);
});

test("web authority and source-law projections pin current Idol authority exactly", async () => {
  const web = JSON.parse(await read("runtime/authority.json"));
  const projection = JSON.parse(await read("runtime/source-law.json"));
  const compactLaw = await read("content/docs/law.md");

  assert.equal(web.language.repository, "clpi/idol");
  assert.equal(web.language.commit, CURRENT_LANGUAGE_COMMIT);
  assert.equal(web.language.compact_law_blob, CURRENT_COMPACT_LAW_BLOB);
  assert.equal(web.language.source_law.schema, "idol.source.law.v1");
  assert.equal(web.language.source_law.sha256, CURRENT_SOURCE_LAW);
  assert.equal(gitBlobSha(compactLaw), CURRENT_COMPACT_LAW_BLOB);

  assert.equal(projection.schema, "idol.web.source-law-projection.v1");
  assert.equal(projection.authority.commit, CURRENT_LANGUAGE_COMMIT);
  assert.equal(projection.source_law.sha256, CURRENT_SOURCE_LAW);
  assert.deepEqual(projection.delimiters, {
    application: "()",
    computed_projection: "[]",
    structured_pack: "{}",
    static_projection: ".",
    subject_relation: ":",
    world: "@",
  });
  assert.equal(projection.semantic_identity_from_lexical_preview, false);
  assert.equal(projection.complete_grammar_claimed, false);
});

test("Specification blueprint and Idol Live are public but cannot impersonate language authority or implementation", async () => {
  const spec = await read("content/docs/spec.md");
  const live = await read("content/docs/live.md");
  const docs = await read("apps/docs/index.html");

  assert.match(spec, /non-authoritative architecture blueprint/i);
  assert.match(spec, /compact law wins/i);
  assert.match(spec, /projection algebra/i);
  assert.match(spec, /foreign source law/i);

  assert.match(live, /separate flagship product/i);
  assert.match(live, /collaboration truth/i);
  assert.match(live, /Git.*compatibility projection/i);
  assert.match(live, /implementation is not claimed/i);

  assert.match(docs, /id:\s*"spec"/);
  assert.match(docs, /id:\s*"live"/);
});

test("the public repository makes no fabricated Program P or Program Q completion claim", async () => {
  const files = await Promise.all([
    read("README.md"),
    read("content/docs/platform.md"),
    read("apps/platform/index.html"),
    read("scripts/build.mjs"),
  ]);
  const joined = files.join("\n");
  assert.doesNotMatch(joined, /Program P[^\n]{0,120}\b(?:live|merged|deployed|complete)\b/i);
  assert.doesNotMatch(joined, /Program Q[^\n]{0,120}\b(?:live|merged|deployed|complete)\b/i);
  assert.doesNotMatch(joined, /\/apps\/(?:shell|core)\b/);
});
