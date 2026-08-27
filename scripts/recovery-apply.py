#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC_SHA = "0653bf7a543cf399c73b14948dd3b2b87f784d09442fdabe653fc865a2e2fd63"
LIVE_SHA = "af5084dd85b5b82e603245c965788bfb2e9e0e8e11ee4c13933bbc8c3d6fdc75"
KNOWN_LANGUAGE_PINS = [
    "f33bb3773484e7d954a2975211e683dfa89edab5",
    "e33b0748f6cb8c092fa99368c31ec76c86673aa4",
    "16ba848af17277b36137fd4ca308ffdb8a2730dd",
]
KNOWN_NATIVE_PINS = [
    "d422ef33c88811b99523ef0cc19a03bd158dd3c0",
    "932a3ade3fa40c0653242559305fb67ffa142e84",
]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)


def read_json(path: str):
    return json.loads(read(path))


def write_json(path: str, value) -> None:
    write(path, json.dumps(value, indent=2) + "\n")


def fetch_json(url: str):
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "idol-id-recovery",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def current_authorities():
    idol = fetch_json("https://api.github.com/repos/clpi/idol/branches/main")["commit"]["sha"]
    native = fetch_json("https://api.github.com/repos/clpi/idol-native/branches/main")["commit"]["sha"]
    if not re.fullmatch(r"[0-9a-f]{40}", idol) or not re.fullmatch(r"[0-9a-f]{40}", native):
        raise RuntimeError("upstream branch did not return exact authority commits")
    encoded = fetch_json(
        f"https://api.github.com/repos/clpi/idol/contents/docs/spec/AUTHORITY.json?ref={idol}"
    )
    import base64

    authority = json.loads(base64.b64decode(encoded["content"]).decode("utf-8"))
    compact = authority["authority"]["compact_law"]["blob"]
    constitution = authority["authority"]["long_form_law"]["blob"]
    source_law = authority["source_law_edition"]["sha256"]
    return idol, native, compact, constitution, source_law


def replace_pins(path: str, language: str, native: str) -> None:
    target = ROOT / path
    if not target.exists():
        return
    text = target.read_text()
    for old in KNOWN_LANGUAGE_PINS:
        text = text.replace(old, language)
    for old in KNOWN_NATIVE_PINS:
        text = text.replace(old, native)
    target.write_text(text)


def require_replace(path: str, before: str, after: str, count: int = 1) -> None:
    text = read(path)
    if before not in text:
        raise RuntimeError(f"expected recovery pattern missing in {path}: {before[:120]!r}")
    write(path, text.replace(before, after, count))


def append_once(path: str, marker: str, content: str) -> None:
    text = read(path)
    if marker not in text:
        write(path, text + content)


def main() -> None:
    language, native, compact, constitution, source_law = current_authorities()

    authority = {
        "schema": "idol.web.authority.v2",
        "language": {
            "repository": "clpi/idol",
            "branch": "main",
            "commit": language,
            "compact_law": "docs/spec/law.md",
            "compact_law_blob": compact,
            "constitution": "docs/spec/constitution.md",
            "constitution_blob": constitution,
            "source_projection": "docs/spec/source.md",
            "source_law": {"schema": "idol.source.law.v1", "sha256": source_law},
        },
        "native": {
            "repository": "clpi/idol-native",
            "branch": "main",
            "commit": native,
            "role": "realization-and-evidence",
        },
        "research_projection": "/authority/manifest.json",
        "web_projection": {
            "source_law": "/runtime/source-law.json",
            "examples": "/content/source-examples.json",
            "semantic_authority": False,
            "grammar_authority": False,
            "lexical_preview_may_publish_semantic_identity": False,
        },
        "rule": "clpi/idol compact law wins; web, wasm, DOM, Worker and machine are projections or realizations and cannot mint syntax or semantics",
        "wasm_artifact": {
            "required_for_admission": [
                "artifact sha256",
                "artifact-bound descriptor",
                "language authority",
                "native authority",
                "source-law edition",
                "declared capabilities",
            ],
            "build_input": "IDOL_WASM_PATH",
            "descriptor_input": "IDOL_WASM_DESCRIPTOR_PATH",
            "current_status": "not admitted in this repository",
        },
    }
    write_json("runtime/authority.json", authority)

    source_projection = read_json("runtime/source-law.json")
    source_projection["authority"]["commit"] = language
    source_projection["authority"]["compact_law"]["git_blob"] = compact
    source_projection["source_law"]["sha256"] = source_law
    write_json("runtime/source-law.json", source_projection)

    examples = read_json("content/source-examples.json")
    examples["authority"].update(
        commit=language,
        source_law=source_law,
        compact_law_blob=compact,
    )
    write_json("content/source-examples.json", examples)

    write_json(
        "authority/manifest.json",
        {
            "schema": "idol.web.research-projection.v1",
            "semantic_authority": False,
            "exact_source_committed": False,
            "language_authority": {
                "repository": "clpi/idol",
                "commit": language,
                "source_law": source_law,
            },
            "artifacts": {
                "Spec.md": {
                    "sha256": SPEC_SHA,
                    "projection": "content/docs/spec.md",
                    "role": "non-authoritative architecture blueprint",
                },
                "Idol-live.md": {
                    "sha256": LIVE_SHA,
                    "projection": "content/docs/live.md",
                    "role": "non-authoritative product thesis",
                },
            },
            "rule": "These documents guide product architecture; clpi/idol compact law wins on every semantic or source-language question.",
        },
    )
    write_json(
        "runtime/idol-source-manifest.json",
        {
            "schema": "idol.web.authored-source.v1",
            "authority": {
                "repository": "clpi/idol",
                "commit": language,
                "source_law": source_law,
            },
            "sources": [],
        },
    )

    active = [
        "README.md",
        "content/install.sh",
        "content/install.ps1",
        "content/docs/spec.md",
        "worker/index.js",
        "wrangler.jsonc",
        "test/ide-worker.test.mjs",
        "test/installer.test.mjs",
        "test/semantic-bundle.test.mjs",
        "test/semantic-bundle-sparse.test.mjs",
        "test/source-authority-projection.test.mjs",
        "test/regression-closure.test.mjs",
    ]
    for path in active:
        replace_pins(path, language, native)
    for path in (ROOT / "test").glob("*.mjs"):
        replace_pins(str(path.relative_to(ROOT)), language, native)

    spec = re.sub(
        r"\*\*Pinned language authority:\*\* `clpi/idol@[0-9a-f]{40}`",
        f"**Pinned language authority:** `clpi/idol@{language}`",
        read("content/docs/spec.md"),
    )
    write("content/docs/spec.md", spec)
    live = read("content/docs/live.md")
    if "The complete uploaded thesis is identified by the hash above" not in live:
        live = live.replace(
            f"`{LIVE_SHA}`.\n",
            f"`{LIVE_SHA}`.\n>\n> The complete uploaded thesis is identified by the hash above; this bounded web\n> projection is not a byte-for-byte copy and cannot amend language law.\n",
            1,
        )
    write("content/docs/live.md", live)

    readme = read("README.md").replace(
        "The authority manifest pins:",
        "The single `runtime/authority.json` producer pins:",
    )
    readme = re.sub(
        r"- language and semantic authority: `clpi/idol@[0-9a-f]{40}`",
        f"- language and semantic authority: `clpi/idol@{language}`",
        readme,
    )
    readme = re.sub(
        r"- native realization/evidence: `clpi/idol-native@[0-9a-f]{40}`",
        f"- native realization/evidence: `clpi/idol-native@{native}`",
        readme,
    )
    write("README.md", readme)

    wrangler = read_json("wrangler.jsonc")
    if not any(route.get("pattern", "").startswith("www.idol.id") for route in wrangler["routes"]):
        wrangler["routes"].insert(1, {"pattern": "www.idol.id/*", "zone_name": "idol.id"})
    wrangler["vars"] = {
        "IDOL_AUTHORITY": language,
        "IDOL_NATIVE_AUTHORITY": native,
        "IDOL_SOURCE_LAW": source_law,
        "IDOL_LOCAL_DEVELOPMENT": "1",
    }
    write_json("wrangler.jsonc", wrangler)

    theme = read("shared/theme.css")
    theme = theme.replace(
        "body {\n  background: var(--bg);\n  color: var(--ink);\n  font-family: var(--mono);",
        "body {\n  background: var(--bg);\n  color: var(--ink);\n  font-family: var(--sans);",
    )
    theme = theme.replace(
        "border: none; background: none; font-family: var(--mono);",
        "border: none; background: none; font-family: var(--sans);",
    )
    theme = theme.replace(
        "button, .btn {\n  font-family: var(--mono);",
        "button, .btn {\n  font-family: var(--sans);",
    )
    theme = theme.replace(
        'input[type="text"], input[type="search"], textarea, select {\n  font-family: var(--mono);',
        'input[type="text"], input[type="search"], select {\n  font-family: var(--sans);',
    )
    if "textarea {\n  font-family: var(--mono);" not in theme:
        theme = theme.replace(
            "input:focus, textarea:focus, select:focus",
            "textarea {\n  font-family: var(--mono); font-size: var(--fs-code);\n  background: var(--bg-panel); color: var(--ink);\n  border: 1px solid var(--rule-2); border-radius: var(--radius);\n  padding: 6px 10px; outline: none;\n}\n\ninput:focus, textarea:focus, select:focus",
        )
    write("shared/theme.css", theme)

    write(
        "docs/RECOVERY_AND_RELEASE_GATES.md",
        """# Recovery and release gates

No finite repository policy can guarantee that software will never contain another bug. The enforceable invariant is that every release requires a pull request, reviewable evidence, and green authority, regression, build, Worker, and production-convergence gates.

## Required pull request path

`main` is the deployment authority. Normal changes must enter through a required pull request. Branch protection or a repository ruleset should require the `verify` job, resolved review conversations, and disallow force pushes and deletion. The repository audit reports whether that external GitHub policy is actually enabled; documentation alone is not enforcement.

## Permanent executable gates

- one `runtime/authority.json` producer owns active authority facts;
- upstream drift is checked without silently accepting a changed source-law edition;
- web examples are bounded authority projections and never semantic authority;
- Wasm is admitted only with an artifact-bound descriptor and digest verification;
- every authored `.id`/`.idol` source has compiler/source-law provenance;
- every configured host is verified after deployment;
- scheduled drift audits open a pull request for commit-only upstream movement.

These controls cannot guarantee a bug-free future. They make known regression classes repeatably detectable and require explicit evidence before deployment.
""",
    )

    package = read_json("package.json")
    package["scripts"].update(
        {
            "authority:check": "node scripts/check-authority.mjs",
            "authority:upstream": "node scripts/check-upstream-authority.mjs",
            "recovery:check": "npm run authority:check",
            "check": "npm run authority:check && npm test && npm run build",
        }
    )
    write_json("package.json", package)

    append_once(
        "test/regression-closure.test.mjs",
        "research specification and Idol Live projections retain exact input hashes",
        f'''\n\ntest("research specification and Idol Live projections retain exact input hashes without becoming authority", async () => {{\n  const manifest = await readJson("authority/manifest.json");\n  const spec = await read("content/docs/spec.md");\n  const live = await read("content/docs/live.md");\n  assert.equal(manifest.semantic_authority, false);\n  assert.equal(manifest.exact_source_committed, false);\n  assert.equal(manifest.language_authority.repository, "clpi/idol");\n  assert.equal(manifest.artifacts["Spec.md"].sha256, "{SPEC_SHA}");\n  assert.equal(manifest.artifacts["Idol-live.md"].sha256, "{LIVE_SHA}");\n  assert.match(spec, /{SPEC_SHA}/);\n  assert.match(live, /{LIVE_SHA}/);\n}});\n\ntest("public API examples come only from the authority-pinned example projection", async () => {{\n  const api = await read("apps/api/index.html");\n  assert.doesNotMatch(api, /\\bstdout\\s*:/);\n  assert.match(api, /content\\/source-examples\\.json/);\n  assert.match(api, /authority-pinned/i);\n}});\n\ntest("every Worker hostname has an explicit deployment route", async () => {{\n  const {{ hostMap }} = await import("../worker/index.js");\n  const wrangler = parseJsonc(await read("wrangler.jsonc"));\n  const routed = new Set((wrangler.routes || []).map((route) => route.pattern.split("/")[0]));\n  for (const hostname of Object.keys(hostMap)) assert.ok(routed.has(hostname), `${{hostname}} has no Wrangler route`);\n}});\n\ntest("recovery policy states the enforceable future invariant without an impossible bug-free claim", async () => {{\n  const policy = await read("docs/RECOVERY_AND_RELEASE_GATES.md");\n  assert.match(policy, /required pull request/i);\n  assert.match(policy, /branch protection/i);\n  assert.match(policy, /cannot guarantee/i);\n}});\n''',
    )

    write(
        "scripts/authority-lib.mjs",
        '''import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export const AUTHORITY_PATH = resolve("runtime/authority.json");
export async function readAuthority(){return JSON.parse(await readFile(AUTHORITY_PATH,"utf8"));}
async function jsonFetch(url,fetcher=fetch){const response=await fetcher(url,{headers:{accept:"application/vnd.github+json","user-agent":"idol-id-authority-gate"}});if(!response.ok)throw new Error(`authority fetch ${response.status}: ${url}`);return response.json();}
export async function fetchUpstreamAuthority(fetcher=fetch){const branch=await jsonFetch("https://api.github.com/repos/clpi/idol/branches/main",fetcher);const commit=branch?.commit?.sha;if(!/^[0-9a-f]{40}$/.test(commit||""))throw new Error("upstream Idol main returned no exact commit");const source=await jsonFetch(`https://api.github.com/repos/clpi/idol/contents/docs/spec/AUTHORITY.json?ref=${commit}`,fetcher);const text=Buffer.from(source.content||"",source.encoding||"base64").toString("utf8");return{commit,document:JSON.parse(text)};}
export function assertCompatibleLaw(local,upstream){const sourceLaw=upstream.document?.source_law_edition?.sha256;const compact=upstream.document?.authority?.compact_law?.blob;const constitution=upstream.document?.authority?.long_form_law?.blob;if(sourceLaw!==local.language.source_law.sha256)throw new Error(`source-law edition changed: local ${local.language.source_law.sha256}, upstream ${sourceLaw}; manual semantic review required`);if(compact!==local.language.compact_law_blob)throw new Error(`compact-law blob changed: local ${local.language.compact_law_blob}, upstream ${compact}; manual semantic review required`);if(constitution!==local.language.constitution_blob)throw new Error(`constitution blob changed: local ${local.language.constitution_blob}, upstream ${constitution}; manual semantic review required`);}
export async function replaceExact(path,before,after){const text=await readFile(path,"utf8");if(!text.includes(before))return false;await writeFile(path,text.split(before).join(after));return true;}
''',
    )
    write(
        "scripts/check-upstream-authority.mjs",
        '''import {assertCompatibleLaw,fetchUpstreamAuthority,readAuthority} from "./authority-lib.mjs";
const local=await readAuthority();const upstream=await fetchUpstreamAuthority();assertCompatibleLaw(local,upstream);if(upstream.commit!==local.language.commit){console.error(`Idol authority drift: pinned ${local.language.commit}, upstream main ${upstream.commit}`);console.error("Run node scripts/sync-authority.mjs --write and merge the generated authority-only pull request.");process.exit(3);}console.log(`Idol authority current: ${upstream.commit} · source law ${local.language.source_law.sha256}`);
''',
    )
    write(
        "scripts/check-authority.mjs",
        '''import assert from "node:assert/strict";import{createHash}from"node:crypto";import{readFile,readdir}from"node:fs/promises";import{join,relative,resolve}from"node:path";import{readAuthority}from"./authority-lib.mjs";
const root=resolve(".");const read=p=>readFile(resolve(root,p),"utf8");const readJson=async p=>JSON.parse(await read(p));const sha256=v=>createHash("sha256").update(v).digest("hex");const exactCommit=/^[0-9a-f]{40}$/;
function parseJsonc(s){return JSON.parse(s.replace(/\\/\\*[\\s\\S]*?\\*\\//g,"").replace(/^\\s*\\/\\/.*$/gm,"").replace(/,\\s*([}\\]])/g,"$1"));}
async function authoredSources(){const found=[];async function visit(d){for(const e of await readdir(d,{withFileTypes:true})){if([".git","dist","node_modules",".wrangler-dry-run"].includes(e.name))continue;const p=join(d,e.name);if(e.isDirectory())await visit(p);else if(e.isFile()&&/\\.(?:id|idol)$/.test(p))found.push(relative(root,p));}}await visit(root);return found.sort();}
const authority=await readAuthority();assert.match(authority.language.commit,exactCommit);assert.match(authority.native.commit,exactCommit);assert.equal(authority.web_projection.semantic_authority,false);assert.equal(authority.web_projection.grammar_authority,false);const sourceLaw=await readJson("runtime/source-law.json");const examples=await readJson("content/source-examples.json");const research=await readJson("authority/manifest.json");const wrangler=parseJsonc(await read("wrangler.jsonc"));assert.equal(sourceLaw.authority.commit,authority.language.commit);assert.equal(sourceLaw.source_law.sha256,authority.language.source_law.sha256);assert.equal(examples.authority.commit,authority.language.commit);assert.equal(examples.authority.source_law,authority.language.source_law.sha256);assert.equal(research.semantic_authority,false);assert.equal(research.language_authority.commit,authority.language.commit);assert.equal(research.artifacts["Spec.md"].sha256,"0653bf7a543cf399c73b14948dd3b2b87f784d09442fdabe653fc865a2e2fd63");assert.equal(research.artifacts["Idol-live.md"].sha256,"af5084dd85b5b82e603245c965788bfb2e9e0e8e11ee4c13933bbc8c3d6fdc75");assert.equal(wrangler.vars.IDOL_AUTHORITY,authority.language.commit);assert.equal(wrangler.vars.IDOL_NATIVE_AUTHORITY,authority.native.commit);assert.equal(wrangler.vars.IDOL_SOURCE_LAW,authority.language.source_law.sha256);for(const p of["content/install.sh","content/install.ps1","README.md","content/docs/spec.md"])assert.match(await read(p),new RegExp(authority.language.commit),`${p} does not project current authority`);const api=await read("apps/api/index.html");assert.doesNotMatch(api,/\\bstdout\\s*:/);assert.match(api,/content\\/source-examples\\.json/);const theme=await read("shared/theme.css");assert.match(theme,/body\\s*\\{[\\s\\S]*?font-family:\\s*var\\(--sans\\)/);assert.match(theme,/code,\\s*pre\\s*\\{[\\s\\S]*?font-family:\\s*var\\(--mono\\)/);const manifest=await readJson("runtime/idol-source-manifest.json");const sources=await authoredSources();const entries=new Map(manifest.sources.map(e=>[e.path,e]));assert.deepEqual([...entries.keys()].sort(),sources);for(const p of sources){const e=entries.get(p);assert.equal(e.authority.commit,authority.language.commit);assert.equal(e.authority.source_law,authority.language.source_law.sha256);assert.equal(e.source_sha256,sha256(await read(p)));assert.match(e.status,/^(?:compile-verified|lawful-source-implementation-not-claimed)$/);}const active=["README.md","content/install.sh","content/install.ps1","content/docs/spec.md","worker/index.js","wrangler.jsonc","runtime/source-law.json","content/source-examples.json"];const text=(await Promise.all(active.map(read))).join("\\n");for(const stale of["f33bb3773484e7d954a2975211e683dfa89edab5","e33b0748f6cb8c092fa99368c31ec76c86673aa4","16ba848af17277b36137fd4ca308ffdb8a2730dd","d422ef33c88811b99523ef0cc19a03bd158dd3c0","932a3ade3fa40c0653242559305fb67ffa142e84"])assert.doesNotMatch(text,new RegExp(stale),`stale active authority ${stale}`);console.log(`authority gate passed: ${authority.language.commit} · authored Idol sources ${sources.length}`);
''',
    )
    write(
        "scripts/sync-authority.mjs",
        '''import{readFile,writeFile}from"node:fs/promises";import{assertCompatibleLaw,fetchUpstreamAuthority,readAuthority}from"./authority-lib.mjs";const write=process.argv.includes("--write");const authority=await readAuthority();const upstream=await fetchUpstreamAuthority();assertCompatibleLaw(authority,upstream);if(upstream.commit===authority.language.commit){console.log(`authority already current: ${upstream.commit}`);process.exit(0);}if(!write){console.log(JSON.stringify({drift:true,pinned:authority.language.commit,upstream:upstream.commit},null,2));process.exit(3);}const before=authority.language.commit;authority.language.commit=upstream.commit;await writeFile("runtime/authority.json",`${JSON.stringify(authority,null,2)}\\n`);for(const path of["runtime/source-law.json","content/source-examples.json","runtime/idol-source-manifest.json","authority/manifest.json"]){const document=JSON.parse(await readFile(path,"utf8"));const replace=value=>{if(Array.isArray(value))return value.map(replace);if(value&&typeof value==="object"){for(const key of Object.keys(value))value[key]=replace(value[key]);return value;}return value===before?upstream.commit:value;};await writeFile(path,`${JSON.stringify(replace(document),null,2)}\\n`);}for(const path of["README.md","content/install.sh","content/install.ps1","content/docs/spec.md","wrangler.jsonc","test/source-authority-projection.test.mjs","test/regression-closure.test.mjs"]){const text=await readFile(path,"utf8");await writeFile(path,text.split(before).join(upstream.commit));}console.log(`authority synchronized ${before} -> ${upstream.commit}; source law unchanged`);
''',
    )
    write(
        "scripts/verify-production.mjs",
        '''import{readFile}from"node:fs/promises";function parseJsonc(s){return JSON.parse(s.replace(/\\/\\*[\\s\\S]*?\\*\\//g,"").replace(/^\\s*\\/\\/.*$/gm,"").replace(/,\\s*([}\\]])/g,"$1"));}const wrangler=parseJsonc(await readFile("wrangler.jsonc","utf8"));const authority=JSON.parse(await readFile("runtime/authority.json","utf8"));const expectedCommit=process.env.EXPECTED_WEB_COMMIT||process.env.GITHUB_SHA;if(!/^[0-9a-f]{40}$/.test(expectedCommit||""))throw new Error("EXPECTED_WEB_COMMIT or GITHUB_SHA must be an exact commit");const hosts=[...new Set(wrangler.routes.map(r=>r.pattern.split("/")[0]))].sort();const attempts=Number(process.env.IDOL_VERIFY_ATTEMPTS||20);const delay=Number(process.env.IDOL_VERIFY_DELAY_MS||3000);const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function verifyHost(host){if(host==="www.idol.id"){const response=await fetch(`https://${host}/`,{redirect:"manual",cache:"no-store"});const location=response.headers.get("location");if(response.status!==308||!String(location||"").startsWith("https://idol.id"))throw new Error(`${host} redirect mismatch: ${response.status} ${location}`);return{host,status:response.status,redirect:location};}const response=await fetch(`https://${host}/__idol/version`,{cache:"no-store"});if(!response.ok)throw new Error(`${host} version ${response.status}`);const value=await response.json();if(value.commit!==expectedCommit)throw new Error(`${host} web commit ${value.commit} != ${expectedCommit}`);if(value.authority!==authority.language.commit)throw new Error(`${host} authority ${value.authority} != ${authority.language.commit}`);if(value.native_authority!==authority.native.commit)throw new Error(`${host} native ${value.native_authority} != ${authority.native.commit}`);if(value.source_law!==authority.language.source_law.sha256)throw new Error(`${host} source law ${value.source_law} != ${authority.language.source_law.sha256}`);return{host,status:response.status,app:value.app,surface:value.surface};}let last;for(let attempt=1;attempt<=attempts;attempt++){try{const results=[];for(const host of hosts)results.push(await verifyHost(host));console.log(JSON.stringify({verified:true,commit:expectedCommit,authority:authority.language.commit,hosts:results},null,2));process.exit(0);}catch(error){last=error;if(attempt<attempts)await sleep(delay);}}throw last;
''',
    )

    write(
        ".github/workflows/authority-sync.yml",
        '''name: reconcile Idol authority

on:
  schedule:
    - cron: "17 */6 * * *"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: idol-id-authority-sync
  cancel-in-progress: true

jobs:
  reconcile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - name: Reconcile commit-only upstream movement
        run: node scripts/sync-authority.mjs --write
      - name: Verify generated authority consumers
        run: npm run authority:check
      - name: Open or update authority pull request
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          git diff --quiet && { echo "No authority drift"; exit 0; }
          branch=bot/reconcile-idol-authority
          git config user.name idol-authority-bot
          git config user.email actions@users.noreply.github.com
          git checkout -B "$branch"
          git add runtime authority content README.md wrangler.jsonc test
          git commit -m "chore: reconcile current Idol authority"
          git push --force-with-lease origin "$branch"
          gh pr view "$branch" >/dev/null 2>&1 || gh pr create --base main --head "$branch" --title "chore: reconcile current Idol authority" --body "Automated commit-only authority reconciliation. Source-law or compact-law changes fail closed for manual semantic review."
''',
    )

    provision_lib = read("scripts/platform-provision-lib.mjs")
    provision_lib = provision_lib.replace(
        "export function renderProductionWrangler(baseConfig, provisioned, { webCommit } = {}) {",
        "export function renderProductionWrangler(baseConfig, provisioned, { webCommit, authority } = {}) {",
    )
    old = '''  config.vars = {
    ...(config.vars || {}),
    ...(webCommit ? { IDOL_COMMIT: webCommit } : {}),
    ACCESS_TEAM_DOMAIN: provisioned.teamDomain,
    ACCESS_AUD: provisioned.accessAudience,
    ACCESS_EMAIL: provisioned.bootstrapEmail,
  };'''
    new = '''  if (!authority?.language?.commit || !authority?.native?.commit || !authority?.language?.source_law?.sha256) {
    throw new Error("renderProductionWrangler requires the immutable runtime authority document");
  }
  config.vars = {
    ...(config.vars || {}),
    ...(webCommit ? { IDOL_COMMIT: webCommit } : {}),
    IDOL_AUTHORITY: authority.language.commit,
    IDOL_NATIVE_AUTHORITY: authority.native.commit,
    IDOL_SOURCE_LAW: authority.language.source_law.sha256,
    ACCESS_TEAM_DOMAIN: provisioned.teamDomain,
    ACCESS_AUD: provisioned.accessAudience,
    ACCESS_EMAIL: provisioned.bootstrapEmail,
  };'''
    if old not in provision_lib:
        raise RuntimeError("platform provisioning vars block changed")
    write("scripts/platform-provision-lib.mjs", provision_lib.replace(old, new))

    provision = read("scripts/provision-platform.mjs")
    require = '''  const base = parseJsonc(await readFile(resolve(root, "wrangler.jsonc"), "utf8"));
  const production = renderProductionWrangler(base, provisioned, { webCommit });'''
    replacement = '''  const base = parseJsonc(await readFile(resolve(root, "wrangler.jsonc"), "utf8"));
  const authority = JSON.parse(await readFile(resolve(root, "runtime", "authority.json"), "utf8"));
  const production = renderProductionWrangler(base, provisioned, { webCommit, authority });'''
    if require not in provision:
        raise RuntimeError("platform provision call changed")
    write("scripts/provision-platform.mjs", provision.replace(require, replacement))

    worker = read("worker/index.js")
    worker = worker.replace("const HOSTS = Object.freeze({", "export const hostMap = Object.freeze({")
    worker = worker.replace("return HOSTS[host] || null;", "return hostMap[host] || null;")
    worker = worker.replace(
        '''    commit,
    authority,
    runtime: "/runtime/manifest.json",''',
        '''    commit,
    authority: authority.language.commit,
    native_authority: authority.native.commit,
    source_law: authority.language.source_law.sha256,
    runtime: "/runtime/manifest.json",''',
    )
    app_shell = '''async function appShell(env, request, app) {
  return asset(env, request, `/apps/${app}/index.html`, { html: true });
}
'''
    authority_loader = '''function validRuntimeAuthority(value) {
  return Boolean(
    value &&
    typeof value.language?.commit === "string" && value.language.commit.length > 0 &&
    typeof value.native?.commit === "string" && value.native.commit.length > 0 &&
    typeof value.language?.source_law?.sha256 === "string" && value.language.source_law.sha256.length > 0
  );
}

async function loadRuntimeAuthority(env, request) {
  const loaded = await readJsonAsset(env, request, "/runtime/authority.json");
  if (loaded.response || !validRuntimeAuthority(loaded.value)) {
    return { response: json({ error: { code: "RUNTIME_AUTHORITY_UNAVAILABLE", message: "immutable runtime authority projection is unavailable or invalid" } }, { status: 503 }) };
  }
  return { value: loaded.value };
}

async function appShell(env, request, app) {
  return asset(env, request, `/apps/${app}/index.html`, { html: true });
}
'''
    if app_shell not in worker:
        raise RuntimeError("worker appShell insertion point changed")
    worker = worker.replace(app_shell, authority_loader, 1)
    start = worker.index('  const commit = env.IDOL_COMMIT || "development";')
    end = worker.index("\n\n  const ideResponse =", start)
    identity_block = '''  const commit = env.IDOL_COMMIT || "development";

  if (["/__idol/version", "/__idol/health", "/config.js"].includes(url.pathname)) {
    const loaded = await loadRuntimeAuthority(env, request);
    if (loaded.response) return loaded.response;
    const authority = loaded.value;
    const identity = {
      commit,
      authority: authority.language.commit,
      native_authority: authority.native.commit,
      source_law: authority.language.source_law.sha256,
      app: info.app,
      surface: info.surface,
    };
    if (url.pathname === "/__idol/version") return json({ service: "idol-id", ...identity });
    if (url.pathname === "/__idol/health") return json({ status: "healthy", edge: true, ...identity });
    return secure(new Response(configSource(info, host, commit, authority), {
      headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
    }));
  }
  if (url.pathname === "/__idol/manifest") return asset(env, request, "/manifest.json", { immutable: false });'''
    worker = worker[:start] + identity_block + worker[end:]
    write("worker/index.js", worker)

    build = read("scripts/build.mjs")
    build = build.replace(
        'for(const directory of["apps","shared","content"])',
        'for(const directory of["apps","shared","content","authority"])',
    )
    build = build.replace(
        'for(const file of["authority.json","source-law.json","worlds.json"])',
        'for(const file of["authority.json","source-law.json","worlds.json","idol-source-manifest.json"])',
    )
    marker = "const foreignSource=validateForeignSource("
    language_insert = 'const research=JSON.parse(await readFile(join(root,"authority","manifest.json"),"utf8"));const languageAuthority={schema:"idol.web.language-authority.v1",semantic_authority:false,authority:authorityPin,research,rule:"This deployment projects clpi/idol authority; it cannot mint language law."};await writeFile(join(dist,"runtime","language-authority.json"),`${JSON.stringify(languageAuthority,null,2)}\\n`);\n'
    if marker not in build:
        raise RuntimeError("build foreign marker changed")
    build = build.replace(marker, language_insert + marker, 1)
    old_wasm = 'const configured=process.env.IDOL_WASM_PATH?resolve(process.env.IDOL_WASM_PATH):join(root,"runtime","idol-web.wasm");let wasm={available:false,file:null,bytes:0,sha256:null};if(await exists(configured)){const target=join(dist,"runtime","idol-web.wasm");await cp(configured,target);const content=await readFile(target);wasm={available:true,file:"/runtime/idol-web.wasm",bytes:(await stat(target)).size,sha256:createHash("sha256").update(content).digest("hex")}}'
    new_wasm = 'const wasmPath=process.env.IDOL_WASM_PATH?resolve(process.env.IDOL_WASM_PATH):null;const descriptorPath=process.env.IDOL_WASM_DESCRIPTOR_PATH?resolve(process.env.IDOL_WASM_DESCRIPTOR_PATH):null;let wasm={available:false,admitted:false,file:null,bytes:0,sha256:null,admission:null};if(wasmPath||descriptorPath){if(!wasmPath)throw new Error("IDOL_WASM_PATH is required when IDOL_WASM_DESCRIPTOR_PATH is supplied");if(!descriptorPath)throw new Error("IDOL_WASM_DESCRIPTOR_PATH is required when IDOL_WASM_PATH is supplied");if(!await exists(wasmPath))throw new Error(`Idol Wasm artifact is unavailable: ${wasmPath}`);if(!await exists(descriptorPath))throw new Error(`Idol Wasm admission descriptor is unavailable: ${descriptorPath}`);const content=await readFile(wasmPath);const artifactSha=createHash("sha256").update(content).digest("hex");const descriptor=JSON.parse(await readFile(descriptorPath,"utf8"));if(descriptor.schema!=="idol.wasm.admission.v1")throw new Error("Wasm descriptor schema must be idol.wasm.admission.v1");if(descriptor.admitted!==true)throw new Error("Wasm descriptor must explicitly set admitted=true");if(descriptor.artifact_sha256!==artifactSha)throw new Error("Wasm descriptor artifact_sha256 does not match artifact bytes");if(descriptor.authority?.language!==authority)throw new Error("Wasm descriptor language authority mismatch");if(descriptor.authority?.native!==native)throw new Error("Wasm descriptor native authority mismatch");if(descriptor.authority?.source_law!==authorityPin.language.source_law.sha256)throw new Error("Wasm descriptor source-law mismatch");if(!Array.isArray(descriptor.capabilities)||!descriptor.capabilities.length)throw new Error("Wasm descriptor requires capabilities[]");const target=join(dist,"runtime","idol-web.wasm");await cp(wasmPath,target);await writeFile(join(dist,"runtime","idol-web.admission.json"),`${JSON.stringify(descriptor,null,2)}\\n`);wasm={available:true,admitted:true,file:"/runtime/idol-web.wasm",bytes:(await stat(target)).size,sha256:artifactSha,admission:{file:"/runtime/idol-web.admission.json",admitted:true,capabilities:descriptor.capabilities}}}'
    if old_wasm not in build:
        raise RuntimeError("build Wasm block changed")
    build = build.replace(old_wasm, new_wasm)
    build = build.replace("browser_wasm:wasm.available", "browser_wasm:wasm.admitted")
    build = build.replace(
        'authority_projection:"/runtime/authority.json",source_law:',
        'authority_projection:"/runtime/authority.json",language_authority:"/runtime/language-authority.json",research_projection:"/authority/manifest.json",source_law:',
    )
    build = build.replace(
        'source_examples:"/content/source-examples.json",browser_preview:',
        'source_examples:"/content/source-examples.json",authored_sources:"/runtime/idol-source-manifest.json",browser_preview:',
    )
    build = build.replace(
        'note:wasm.available?"Idol Wasm artifact is deployed and loaded as the preferred compute realization.":"The semantic web bridge is active; provide IDOL_WASM_PATH when the canonical Idol browser artifact is admitted."',
        'note:wasm.admitted?"An artifact-bound Idol Wasm realization is admitted and digest-verified before instantiation.":"No Idol Wasm realization is admitted; JavaScript remains transport/presentation and cannot impersonate semantic authority."',
    )
    build = build.replace(
        'const manifest={schema:"idol.web.deploy.v1",commit,authority,surfaces:',
        'const manifest={schema:"idol.web.deploy.v1",commit,authority,native_authority:native,source_law:authorityPin.language.source_law.sha256,surfaces:',
    )
    build = build.replace("`idol wasm: ${wasm.available?", "`idol wasm: ${wasm.admitted?")
    build = build.replace('"not supplied (bridge remains explicit)"', '"not admitted"')
    write("scripts/build.mjs", build)

    write(
        "shared/wasm.js",
        '''(() => {
  "use strict";
  const state = { available: false, admitted: false, inspected: false, loaded: false, manifest: null, instance: null, error: null };
  const hex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
  async function inspect() {
    if (state.inspected || state.error) return state;
    try {
      const response = await fetch("/runtime/manifest.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`runtime manifest ${response.status}`);
      state.manifest = await response.json();
      state.available = Boolean(state.manifest?.wasm?.available);
      state.admitted = Boolean(state.manifest?.wasm?.admitted && state.manifest?.wasm?.admission?.admitted);
      if (state.available && !state.admitted) throw new Error("Wasm artifact is present without admitted artifact-bound evidence");
      state.inspected = true;
    } catch (error) { state.error = String(error?.message || error); }
    return state;
  }
  async function load(imports = {}) {
    await inspect();
    if (!state.available || !state.admitted || state.loaded || state.error) return state;
    try {
      const response = await fetch(state.manifest.wasm.file, { cache: "force-cache" });
      if (!response.ok) throw new Error(`runtime wasm ${response.status}`);
      const bytes = await response.arrayBuffer();
      const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
      if (digest !== state.manifest.wasm.sha256) throw new Error(`runtime wasm sha256 mismatch: ${digest}`);
      const result = await WebAssembly.instantiate(bytes, imports);
      state.instance = result.instance || result;
      state.loaded = true;
    } catch (error) { state.error = String(error?.message || error); }
    return state;
  }
  window.IdolWasm = Object.freeze({ state, inspect, load, ready: inspect() });
})();
''',
    )

    api = read("apps/api/index.html").replace("(function () {", "(async function () {", 1)
    api = api.replace("body: { source: 'add = (a, b) a + b\\nstdout:write(add(20, 22))' }", 'body: { source: "" }')
    api = api.replace("body: { source: 'x = 40 + 2', target: \"aarch64-linux\", emit: \"asm\", opt: \"3\" }", 'body: { source: "", target: "aarch64-linux", emit: "asm", opt: "3" }')
    api = api.replace("body: { source: 'stdout:write(\"hello from the graph\")' }", 'body: { source: "" }')
    api = api.replace('body: { source: "x=1\\ny   =  2" }', 'body: { source: "" }')
    api = api.replace('body: { name: "example", version: "0.1.0", source: "x = 1", summary: "example" }', 'body: { name: "example", version: "0.1.0", source: "", summary: "example" }')
    root_marker = '  const root = document.getElementById("root");'
    api_loader = '''  const SOURCE_EXAMPLES = "/content/source-examples.json";
  let authorityExample = "";
  try {
    const response = await fetch(SOURCE_EXAMPLES, { cache: "no-cache" });
    if (!response.ok) throw new Error(`source example manifest ${response.status}`);
    const manifest = await response.json();
    authorityExample = manifest.examples?.find((entry) => entry.status === "current-law")?.source || manifest.examples?.[0]?.source || "";
    for (const endpoint of EPS) if (endpoint.body && Object.hasOwn(endpoint.body, "source")) endpoint.body.source = authorityExample;
  } catch (error) { console.warn("authority-pinned source examples unavailable", error); }

  const root = document.getElementById("root");'''
    if root_marker not in api:
        raise RuntimeError("API root marker changed")
    api = api.replace(root_marker, api_loader, 1)
    api = api.replace(
        '"the same semantic surface behind every face — try any endpoint live. POST bodies are JSON."',
        '"transport console over the deployed compiler and registry. Source defaults come from the authority-pinned example projection; lawful source does not imply parser, lowering, or runtime support."',
    )
    write("apps/api/index.html", api)

    deploy = read(".github/workflows/deploy.yml")
    verify_marker = '''      - name: Repository authority and transport security
        run: node --test test/repository-platform-errors.test.mjs test/repository-worker.test.mjs test/repository-transformation-worker.test.mjs'''
    if "Check current upstream Idol authority" not in deploy:
        deploy = deploy.replace(
            verify_marker,
            '''      - name: Check current upstream Idol authority
        run: node scripts/check-upstream-authority.mjs
      - name: Repository authority and transport security
        run: node --test test/repository-platform-errors.test.mjs test/repository-worker.test.mjs test/repository-transformation-worker.test.mjs''',
            1,
        )
    deploy_marker = '''      - name: Deploy root and every subdomain atomically
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: npx --yes wrangler@4.125.0 deploy --config .wrangler.production.jsonc'''
    if "Verify deployed authority and every configured host" not in deploy:
        deploy = deploy.replace(
            deploy_marker,
            '''      - name: Deploy root and every subdomain atomically
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: npx --yes wrangler@4.125.0 deploy --config .wrangler.production.jsonc
      - name: Verify deployed authority and every configured host
        env:
          EXPECTED_WEB_COMMIT: ${{ github.sha }}
          IDOL_VERIFY_ATTEMPTS: 30
          IDOL_VERIFY_DELAY_MS: 4000
        run: node scripts/verify-production.mjs''',
            1,
        )
    write(".github/workflows/deploy.yml", deploy)

    provision_test = read("test/provision-platform.test.mjs")
    provision_test = provision_test.replace(
        '  }, { webCommit: "web-sha" });',
        '''  }, {
    webCommit: "web-sha",
    authority: {
      language: { commit: "language-sha", source_law: { sha256: "source-law-sha" } },
      native: { commit: "native-sha" },
    },
  });''',
        1,
    )
    provision_test = provision_test.replace(
        '''    IDOL_AUTHORITY: "authority",
    IDOL_COMMIT: "web-sha",''',
        '''    IDOL_AUTHORITY: "language-sha",
    IDOL_NATIVE_AUTHORITY: "native-sha",
    IDOL_SOURCE_LAW: "source-law-sha",
    IDOL_COMMIT: "web-sha",''',
        1,
    )
    write("test/provision-platform.test.mjs", provision_test)

    print(json.dumps({"applied": True, "language": language, "native": native, "source_law": source_law}, indent=2))


if __name__ == "__main__":
    main()
