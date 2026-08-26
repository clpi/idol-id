# Foreign World and Integration Projections — Program J Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first evidence-safe Program J slice: public foreign-origin world candidates, versioned integration projection records, deterministic import planning, World Atlas integration views, and `/v1/world/*` transport endpoints without claiming unadmitted artifacts, semantic equivalence, world composition, or repository mutation.

**Architecture:** A checked-in product projection at `content/foreign.json` describes foreign-origin candidate facts, uncertainty, selected ecosystem projections, obligations, missing evidence, and exact refusal. `scripts/build.mjs` validates and publishes an authority-pinned immutable `/runtime/foreign.json`. One pure module, `shared/foreign.js`, owns transport normalization and import-plan behavior for both browser and Worker use. `worlds.idol.id` consumes the projection and the Worker exposes read-only/query endpoints; compiler semantic identity remains absent unless an upstream producer publishes it.

**Tech Stack:** Node.js 22 built-in test runner, ECMAScript modules, Cloudflare Workers/Static Assets, vanilla HTML/CSS/JS, existing Idol exact-dependency web bridge.

**Spec:** `docs/superpowers/specs/2026-08-25-worlds-platform-design-addendum.md` sections 2.4, 4.6–4.8, 11, 13.1, 14 Program J, and acceptance criteria 2–5, 11–12, 16–18.

## Global Constraints

- Foreignness is qualification, never a `ForeignWorld` semantic kind.
- A transport slug, path, name, provider coordinate, URL, version, or content hash never becomes semantic identity.
- Candidate records must publish `semantic_id: null` and `identity_status: "not-published"` until an upstream compiler/registry producer supplies a real identity.
- No integration record may claim `available` without a content-addressed artifact, version, exact authority, and evidence record.
- No copied command may be emitted for a nonexistent or unpinned artifact.
- Uncertainty, unsupported facts, missing witnesses, and exact refusal remain visible.
- Import planning performs no network access, repository checkout, binary execution, source transformation, or world publication.
- Existing Tunnel-backed routes retain their origin; originless Worlds/Platform surfaces must not recurse through same-host fetches.
- UI and prose use sans-serif; code, exact IDs, hashes, versions, and target facts use Iosevka.
- Mobile workflows require 44 px targets, no hover-only behavior, safe-area handling, keyboard access, and reduced-motion support.
- No React, virtual DOM, package lifecycle script, or new language syntax.

---

## File map

- Create `content/foreign.json` — version-controlled source projection for foreign-origin candidates and integration records.
- Create `shared/foreign.js` — pure normalization, filtering, projection selection, refusal, and import-plan functions usable in Node, Worker, and browser.
- Create `test/foreign.test.mjs` — unit tests for authority boundaries, uncertainty, projections, and import plans.
- Create `test/foreign-worker.test.mjs` — Worker endpoint tests using static-asset fixtures.
- Modify `scripts/build.mjs` — validate source projection, inject authority pins, and write deterministic `dist/runtime/foreign.json`.
- Modify `test/build.test.mjs` — assert the immutable foreign projection is built and honest.
- Modify `worker/index.js` — serve `GET /v1/world/foreign`, `GET /v1/world/:slug/integration`, and `POST /v1/world/import-plan` before generic proxy/refusal handling.
- Modify `apps/worlds/index.html` — merge foreign candidates into the Atlas, add integration lens and import-plan sheet, and preserve mobile/deep-link behavior.
- Modify `shared/worlds.js` — normalize candidate identity status and integration metadata without treating them as canonical world facts.
- Modify `content/docs/platform.md` and `README.md` — document the public Program J boundary and non-claims.

---

### Task 1: Establish RED contracts for the foreign projection

**Files:**
- Create: `test/foreign.test.mjs`
- Modify: `test/build.test.mjs`

**Interfaces:**
- Consumes: existing `normaliseWorld()` and build script.
- Produces: required exports from `shared/foreign.js`: `normaliseForeignWorld`, `normaliseIntegration`, `filterForeignWorlds`, `integrationFor`, `planForeignImport`, `parseImportRequest`.

- [ ] **Step 1: Write the failing unit tests**

Create `test/foreign.test.mjs` with tests that require:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  filterForeignWorlds,
  integrationFor,
  normaliseForeignWorld,
  normaliseIntegration,
  parseImportRequest,
  planForeignImport,
} from "../shared/foreign.js";

const candidate = {
  slug: "c17",
  name: "C17",
  version: "ISO/IEC 9899:2018",
  summary: "C language and ABI provenance candidate",
  semantic_id: null,
  identity_status: "not-published",
  provenance: { origin: { family: "c", standard: "ISO/IEC 9899:2018" } },
  uncertainty: [{ fact: "implementation-defined behavior", status: "unresolved" }],
  projections: [{
    id: "c17-cabi",
    target: "c-abi",
    status: "not-admitted",
    artifact: null,
    obligations: { abi: ["calling convention"], ownership: ["aliasing"] },
    evidence: { status: "missing", required: ["round-trip test"] },
    refusal: { code: "ARTIFACT_NOT_ADMITTED", detail: "no signed artifact" },
  }],
};

test("foreign candidates never fabricate semantic identity", () => {
  const world = normaliseForeignWorld(candidate);
  assert.equal(world.semantic_id, null);
  assert.equal(world.identity_status, "not-published");
  assert.equal(world.category, "foreign");
  assert.equal(world.uncertainty[0].status, "unresolved");
});

test("integration records expose obligations and exact refusal", () => {
  const projection = normaliseIntegration(candidate.projections[0], candidate);
  assert.equal(projection.available, false);
  assert.equal(projection.refusal.code, "ARTIFACT_NOT_ADMITTED");
  assert.deepEqual(projection.obligations.abi, ["calling convention"]);
  assert.equal("copy_command" in projection, false);
});

test("integration lookup and search remain provenance based", () => {
  assert.equal(integrationFor(candidate, "c-abi").target, "c-abi");
  assert.deepEqual(filterForeignWorlds([candidate], "aliasing").map((x) => x.slug), ["c17"]);
});

test("import planning is deterministic and performs no import", () => {
  const request = parseImportRequest({ kind: "repository", locator: "https://example.invalid/repo", version: "abc123" });
  const first = planForeignImport(request);
  const second = planForeignImport(request);
  assert.deepEqual(first, second);
  assert.equal(first.status, "plan-only");
  assert.equal(first.semantic_id, null);
  assert.equal(first.executed, false);
  assert.ok(first.stages.includes("ingest provenance"));
  assert.ok(first.missing_facts.length > 0);
});

test("unsupported import kinds fail exactly", () => {
  assert.throws(() => parseImportRequest({ kind: "magic", locator: "x" }), /unsupported import kind/);
});
```

- [ ] **Step 2: Extend the build test before production code**

Add assertions to `test/build.test.mjs`:

```js
const foreign = JSON.parse(await readFile("dist/runtime/foreign.json", "utf8"));
assert.equal(foreign.schema, "idol.web.foreign.v1");
assert.equal(foreign.authority.language.commit, snapshotAuthority.language.commit);
assert.ok(foreign.worlds.length >= 6);
assert.ok(foreign.worlds.every((world) => world.semantic_id === null));
assert.ok(foreign.worlds.every((world) => world.identity_status === "not-published"));
assert.ok(foreign.worlds.flatMap((world) => world.projections).every((projection) =>
  projection.status !== "available" || (projection.artifact?.sha256 && projection.evidence?.status === "verified")));
```

Read `runtime/authority.json` in the test as `snapshotAuthority`.

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
npm test
```

Expected: failures because `shared/foreign.js` and `dist/runtime/foreign.json` do not exist.

- [ ] **Step 4: Commit the RED contract**

```bash
git add test/foreign.test.mjs test/build.test.mjs
git commit -m "test: define foreign world integration contract"
```

---

### Task 2: Add the version-controlled foreign projection source

**Files:**
- Create: `content/foreign.json`

**Interfaces:**
- Consumes: no runtime code.
- Produces: `idol.web.foreign.source.v1` document with `revision`, `worlds`, and `import_kinds`.

- [ ] **Step 1: Add six honest candidate records**

Create candidates for:

```text
c17
wasm-wasi
browser
python
rust
go
```

Every record must include:

```json
{
  "slug": "c17",
  "name": "C17",
  "version": "ISO/IEC 9899:2018",
  "summary": "C language and ABI provenance candidate",
  "semantic_id": null,
  "identity_status": "not-published",
  "provenance": {
    "origin": {
      "family": "c",
      "standard": "ISO/IEC 9899:2018"
    }
  },
  "uncertainty": [
    {
      "fact": "implementation-defined behavior",
      "status": "unresolved",
      "detail": "compiler, target, ABI, and flags must be pinned before correspondence can be witnessed"
    }
  ],
  "requirements": ["target triple", "compiler and version", "ABI", "ownership", "failure", "threading", "effects"],
  "projections": []
}
```

Each world receives one or two projection records for the relevant targets. Every initial projection uses `status: "not-admitted"`, `artifact: null`, `evidence.status: "missing"`, and a nonempty refusal code/detail. No copy command is present.

- [ ] **Step 2: Add import-kind planning facts**

Add records for `repository`, `schema`, `api`, and `binary`, each with exact stages, required grants, missing facts, and refusal conditions derived from the approved design.

- [ ] **Step 3: Validate JSON**

Run:

```bash
node -e 'JSON.parse(require("node:fs").readFileSync("content/foreign.json","utf8")); console.log("valid")'
```

Expected: `valid`.

- [ ] **Step 4: Commit**

```bash
git add content/foreign.json
git commit -m "feat: add foreign world projection source"
```

---

### Task 3: Implement the shared foreign projection module

**Files:**
- Create: `shared/foreign.js`
- Test: `test/foreign.test.mjs`

**Interfaces:**
- Produces:
  - `normaliseForeignWorld(record: object): Readonly<object>`
  - `normaliseIntegration(record: object, world?: object): Readonly<object>`
  - `filterForeignWorlds(worlds: object[], query?: string, target?: string): object[]`
  - `integrationFor(world: object, target: string): object | null`
  - `parseImportRequest(input: object): Readonly<{kind, locator, version}>`
  - `planForeignImport(request: object, source?: object): Readonly<object>`

- [ ] **Step 1: Implement strict normalization**

Requirements:

- `semantic_id` remains `null` unless the source provides a nonempty explicit value; initial source validation rejects a fabricated value.
- `identity_status` is `not-published` for candidates.
- `category` is presentation-only `foreign`.
- arrays and nested objects are copied and frozen where practical.
- projection availability is true only when `status === "available"`, artifact `sha256` is present, and evidence is `verified`.
- absent artifact means no `copy_command` property is returned.

- [ ] **Step 2: Implement deterministic import planning**

`parseImportRequest` accepts only:

```text
repository
schema
api
binary
```

`locator` is required, trimmed, and capped at 2048 characters. `version` is optional and capped at 256 characters.

`planForeignImport` returns:

```json
{
  "schema": "idol.web.import.plan.v1",
  "status": "plan-only",
  "executed": false,
  "semantic_id": null,
  "kind": "repository",
  "locator": "…",
  "version": "…",
  "stages": [],
  "required_grants": [],
  "missing_facts": [],
  "refusals": [],
  "authority_boundary": "No source was fetched, executed, transformed, or published."
}
```

- [ ] **Step 3: Run unit tests**

```bash
node --test test/foreign.test.mjs
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add shared/foreign.js test/foreign.test.mjs
git commit -m "feat: model foreign candidates and import plans"
```

---

### Task 4: Build an authority-pinned immutable foreign projection

**Files:**
- Modify: `scripts/build.mjs`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: `content/foreign.json`, `runtime/authority.json`.
- Produces: `dist/runtime/foreign.json` schema `idol.web.foreign.v1`.

- [ ] **Step 1: Add validation in the build**

Reject source documents unless:

- schema is `idol.web.foreign.source.v1`;
- revision is a nonempty string;
- at least one world exists;
- every candidate has slug/name/version, `semantic_id === null`, `identity_status === "not-published"`, origin family, nonempty uncertainty, and projection records;
- every projection has target/status/obligations/evidence/refusal;
- an `available` projection has artifact SHA-256 and verified evidence;
- an unavailable projection has no copy command.

- [ ] **Step 2: Write the deterministic runtime document**

The build writes:

```json
{
  "schema": "idol.web.foreign.v1",
  "revision": "…",
  "authority": {
    "language": { "repository": "clpi/idol", "commit": "…" },
    "native": { "repository": "clpi/idol-native", "commit": "…" }
  },
  "worlds": [],
  "import_kinds": []
}
```

No wall-clock timestamp is added.

- [ ] **Step 3: Run full check**

```bash
npm run check
```

Expected: all Node tests and build pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/build.mjs test/build.test.mjs
git commit -m "build: publish authority-pinned foreign projections"
```

---

### Task 5: Expose read-only and plan-only Worker APIs

**Files:**
- Modify: `worker/index.js`
- Create: `test/foreign-worker.test.mjs`

**Interfaces:**
- `GET /v1/world/foreign` → immutable foreign projection.
- `GET /v1/world/:slug/integration` → one candidate and its projections or 404.
- `POST /v1/world/import-plan` → deterministic plan-only document or 400/422.

- [ ] **Step 1: Write Worker tests first**

Tests must assert:

- `GET /v1/world/foreign` returns the static projection on `worlds.idol.id` and `api.idol.id`.
- exact unsafe-width identities remain strings.
- `GET /v1/world/c17/integration` returns only `c17`.
- unknown slug returns 404.
- import plan accepts repository/schema/api/binary and returns `executed:false`.
- invalid JSON returns 400.
- unsupported kind returns 422.
- body larger than 32 KiB returns 413.
- no call to global `fetch` occurs for these originless endpoints.

- [ ] **Step 2: Add the endpoint dispatcher before generic proxy logic**

Import `parseImportRequest` and `planForeignImport` from `../shared/foreign.js`.

For read endpoints, fetch `/runtime/foreign.json` through `env.ASSETS`, parse JSON, and return with no-store API headers. For import planning, read at most 32 KiB, parse JSON, and return the pure plan.

- [ ] **Step 3: Run Worker and full tests**

```bash
node --test test/foreign-worker.test.mjs test/worker.test.mjs
npm run check
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add worker/index.js test/foreign-worker.test.mjs
git commit -m "feat: expose foreign world integration APIs"
```

---

### Task 6: Add integration and import-plan views to the World Atlas

**Files:**
- Modify: `apps/worlds/index.html`
- Modify: `shared/worlds.js`
- Test: `test/build.test.mjs`, `test/worlds.test.mjs`

**Interfaces:**
- Consumes: `/runtime/worlds.json`, `/runtime/foreign.json`, `shared/foreign.js`.
- Produces: searchable foreign candidates, integration detail, and plan-only import sheet.

- [ ] **Step 1: Extend tests before UI code**

Require built Atlas HTML to contain:

```text
/runtime/foreign.json
/shared/foreign.js
integration
import plan
plan-only
identity not published
```

Add tests that candidate worlds normalize into the Atlas without a semantic ID and that integration deep links preserve the selected world.

- [ ] **Step 2: Load and merge projections**

Fetch both runtime documents concurrently. Normalize published worlds with `normaliseWorld` and foreign candidates with `normaliseForeignWorld`. Do not merge records by name; preserve distinct source records and give foreign candidates a display coordinate based on slug/version provenance.

- [ ] **Step 3: Add the integration lens**

For foreign candidates, render:

- identity status;
- origin family/version;
- uncertainty and missing witnesses;
- each target projection;
- ABI/ownership/failure/threading/effect/world obligations;
- evidence status and required evidence;
- exact refusal;
- artifact state;
- no copy button unless a verified content-addressed artifact exists.

For published Idol worlds without integration records, show `integration projection not published`.

- [ ] **Step 4: Add a plan-only import sheet**

The form accepts kind, locator, and version. It POSTs to `/v1/world/import-plan` and renders stages, grants, missing facts, refusal, and the authority-boundary statement. It never says the source was imported.

- [ ] **Step 5: Preserve responsive and accessibility behavior**

- integration is reachable without hover;
- all controls are at least 44 px on phones;
- the detail sheet and import sheet respect safe areas;
- Escape closes the import sheet;
- focus returns to the opener;
- reduced motion remains honored.

- [ ] **Step 6: Run full check**

```bash
npm run check
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/worlds/index.html shared/worlds.js test/build.test.mjs test/worlds.test.mjs
git commit -m "feat: explore foreign integrations in the World Atlas"
```

---

### Task 7: Document the shipped boundary and verify deployment

**Files:**
- Modify: `README.md`
- Modify: `content/docs/platform.md`
- Modify: `.github/workflows/deploy.yml` only if deployment summary omits Program J projection evidence.

**Interfaces:**
- Produces: accurate documentation and deployment evidence.

- [ ] **Step 1: Document what is live**

Document:

- public foreign candidate projection;
- integration obligations/refusals;
- import planning endpoint;
- exact non-claims: no repository fetch, no binary execution, no semantic identity, no equivalence, no integration artifact, no world publication.

- [ ] **Step 2: Verify all tests and Wrangler**

```bash
npm run check
npx --yes wrangler@4.125.0 deploy --dry-run --outdir .wrangler-dry-run
```

Expected: zero test failures and Wrangler exit 0.

- [ ] **Step 3: Request review and resolve actionable findings**

Open/ready the PR, request Codex/CodeRabbit review, verify findings against current code, and fix all valid Critical/Important findings before merge.

- [ ] **Step 4: Merge and verify production**

After green CI, merge to `main`. Verify:

```text
https://worlds.idol.id/runtime/foreign.json
https://worlds.idol.id/v1/world/foreign
https://worlds.idol.id/v1/world/c17/integration
POST https://worlds.idol.id/v1/world/import-plan
https://worlds.idol.id/world/c17/integration
```

All responses must report the deployed `main` commit through `/__idol/version` and preserve the same language authority.

- [ ] **Step 5: Commit documentation before merge**

```bash
git add README.md content/docs/platform.md .github/workflows/deploy.yml
git commit -m "docs: define the public foreign integration boundary"
```

---

## Self-review

- Spec coverage: Program J fact model, uncertainty, selected integration projections, exact provenance/evidence/refusal, import-plan stages, mobile integration view, and public transport endpoints are covered.
- Deliberately deferred: repository checkout/upload, schema parsing, API probing, binary inspection, generated artifacts, projection/injection witnesses, world composition, semantic equivalence, private candidate publication, and native/Wasm implementation. The UI and API state these boundaries explicitly.
- Placeholder scan: no TBD/TODO/implement-later instructions are present.
- Type consistency: the shared module exports named above are used consistently by tests, Worker, and browser.
