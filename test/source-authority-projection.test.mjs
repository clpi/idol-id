import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");

const CURRENT_LANGUAGE_COMMIT = "cb2199dff026c1b2d3fbd0caa04d6d323370a9e8";
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

async function markdownFiles(directory) {
  const paths = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) paths.push(relative(root, child));
    }
  }
  await visit(resolve(root, directory));
  return paths.sort();
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
  assert.doesNotMatch(source, /^\s*\.\.\.\s*$/m, `${label} contains an invented placeholder body`);
}

test("homepage and Observatory obtain examples from one authority-pinned manifest", async () => {
  const site = await read("apps/site/index.html");
  const graph = await read("apps/graph/index.html");
  const manifest = JSON.parse(await read("content/source-examples.json"));

  for (const surface of [site, graph]) {
    assert.match(surface, /content\/source-examples\.json/);
    assert.doesNotMatch(surface, /\bio\.print\b/);
    assert.doesNotMatch(surface, /\bstr\.from\b/);
    assert.doesNotMatch(surface, /\bmain\s*=/);
    assert.doesNotMatch(surface, /body:weight\(80,\s*9\.8\)/);
  }
  assert.doesNotMatch(graph, /const\s+SAMPLES\s*=/);

  assert.equal(manifest.schema, "idol.web.source-examples.v2");
  assert.equal(manifest.authority.commit, CURRENT_LANGUAGE_COMMIT);
  assert.equal(manifest.authority.source_law, CURRENT_SOURCE_LAW);
  assert.ok(manifest.examples.length >= 4);
  for (const example of manifest.examples) {
    assert.match(example.status, /^(?:current-law|compiler-evidence|lawful-source-implementation-not-claimed)$/);
    assert.match(example.capability, /^(?:compiler-evidence|law-projection)$/);
    assert.equal(example.authority.repository, "clpi/idol");
    assert.equal(example.authority.commit, CURRENT_LANGUAGE_COMMIT);
    assert.ok(Array.isArray(example.actions) && example.actions.includes("analyze"));
    if (example.capability === "law-projection") assert.ok(!example.actions.includes("run"));
    assertCanonicalNative(example.source, `content/source-examples.json#${example.id}`);
  }
});

test("every public native markdown fence is canonical or moved to a non-native text fence", async () => {
  let count = 0;
  for (const path of await markdownFiles("content/docs")) {
    const examples = idolFences(await read(path));
    for (const [index, example] of examples.entries()) {
      count += 1;
      assertCanonicalNative(example, `${path} native fence ${index + 1}`);
    }
  }
  assert.ok(count > 0, "expected public native examples to be scanned");
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
  assert.match(source, /There is no spelling,[\s\S]*fallback/i);
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
  assert.equal(web.web_projection.semantic_authority, false);
  assert.equal(web.web_projection.grammar_authority, false);
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
  assert.match(spec, /compact law[\s\S]{0,160}\bwins\b/i);
  assert.match(spec, /projection algebra/i);
  assert.match(spec, /foreign source law/i);
  assert.match(spec, /semantic law and implementation support are deliberately separate/i);

  assert.match(live, /separate flagship product/i);
  assert.match(live, /collaboration truth/i);
  assert.match(live, /Git.*compatibility projection/i);
  assert.match(live, /implementation is not claimed/i);
  assert.match(live, /History H[\s\S]*Frontier F[\s\S]*State S/);

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
