# Browser IDE and Local Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first production-safe, local-first Idol browser IDE at `platform.idol.id/ide` with multi-file persistence, explicit lexical/browser-Wasm/remote-native authority states, clickable token facts, graph inspection, and opt-in remote analysis.

**Architecture:** Browser source and workspace state remain local in IndexedDB until the user explicitly requests remote analysis. The IDE reuses the existing Idol editor and graph renderer, but introduces focused workspace and semantic-bundle modules so lexical preview, exact compiler facts, and remote evidence cannot be conflated. Cloudflare Access protects the IDE page and browser IDE APIs; the Worker independently verifies the Access JWT before proxying bounded analysis requests to `api.idol.id`.

**Tech Stack:** Vanilla ES modules, IndexedDB, existing `Idol.editor`, existing `GraphView`, Cloudflare Worker + Access, Node 22 tests, Wrangler 4.125.0.

**Spec:** `docs/superpowers/specs/2026-08-25-worlds-platform-design-addendum.md`

## Global Constraints

- One semantic universe; workspace, tab, file, route, and repository coordinates are provenance, not semantic identity.
- Local source is never uploaded automatically. Remote analysis occurs only after an explicit user action.
- Lexical preview, browser Idol-Wasm results, and remote native evidence are visibly distinct states.
- A token without a compiler-published binding remains clickable but must say `semantic identity not published`; no name/line heuristic may be represented as exact authority.
- `platform.idol.id/ide*` and `platform.idol.id/v1/ide/*` are admitted only through the existing exact owner Cloudflare Access policy.
- Worker requests remain bounded, same-origin, JSON-only where parsed, and independently verify Access JWT claims.
- No repository provider connection, remote shell, private cloud workspace, collaboration, source-control write, transformation, or migration is added in this program.
- UI must work at 320px width, by touch, by keyboard, and with reduced motion.
- Iosevka is reserved for source, exact IDs, graph facts, target output, paths, and measurements; product prose and controls use sans-serif.

---

### Task 1: Pure local workspace model

**Files:**
- Create: `shared/workspace.js`
- Create: `test/workspace.test.mjs`

**Interfaces:**
- Produces: `createWorkspace(name)`, `addFile(workspace, path, source)`, `writeFile(workspace, fileId, source)`, `renameFile(workspace, fileId, path)`, `removeFile(workspace, fileId)`, `selectFile(workspace, fileId)`, `workspaceSnapshot(workspace)`, `restoreWorkspace(snapshot)`, `MemoryWorkspaceStore`.
- All mutation functions return a new frozen workspace object; source strings are never sent to a network function.

- [ ] **Step 1: Write failing model tests**

Cover:

```js
const initial = createWorkspace("scratch");
const withMain = addFile(initial, "main.id", "main() 0");
assert.notEqual(withMain, initial);
assert.equal(withMain.files[0].path, "main.id");
assert.equal(withMain.active, withMain.files[0].id);
assert.throws(() => addFile(withMain, "../secret", ""), /invalid workspace path/);
assert.throws(() => addFile(withMain, "main.id", ""), /already exists/);
```

Also assert rename collision, deletion fallback selection, deterministic snapshot ordering, bounded file/workspace sizes, snapshot validation, and store round-trip behavior.

- [ ] **Step 2: Run tests and observe RED**

Run: `node --test test/workspace.test.mjs`

Expected: failure because `shared/workspace.js` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

Use UUID-like IDs supplied by an injectable `idFactory`; browser default may use `crypto.randomUUID()`, tests use deterministic IDs. Validate relative slash-separated paths, reject empty segments, `.`/`..`, NUL, backslash, absolute paths, duplicate paths, more than 256 files, files larger than 2 MiB, and snapshots larger than 8 MiB.

- [ ] **Step 4: Implement `MemoryWorkspaceStore`**

```js
const store = new MemoryWorkspaceStore();
await store.save(workspace);
const restored = await store.load(workspace.id);
```

The store clones through `workspaceSnapshot` / `restoreWorkspace`; callers never receive its internal object.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test test/workspace.test.mjs && npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared/workspace.js test/workspace.test.mjs
git commit -m "feat: add local workspace model"
```

### Task 2: Browser persistence adapter

**Files:**
- Modify: `shared/workspace.js`
- Modify: `test/workspace.test.mjs`

**Interfaces:**
- Produces: `BrowserWorkspaceStore`, `createBrowserWorkspaceStore({ indexedDB, databaseName })`.
- Database: `idol-browser-workspaces-v1`; object store `workspace`; key is workspace ID; value is the validated snapshot.

- [ ] **Step 1: Write failing adapter contract tests**

Use a small fake IndexedDB contract to verify open, save, load, list, and delete. Assert that failure to open IndexedDB returns an explicit `storage-unavailable` result rather than silently claiming persistence.

- [ ] **Step 2: Observe RED**

Run: `node --test test/workspace.test.mjs`

Expected: `BrowserWorkspaceStore` is missing.

- [ ] **Step 3: Implement the IndexedDB adapter**

Do not place network, auth, or API functions in this module. Save one validated snapshot per transaction. Return workspaces sorted by `updated_at` descending.

- [ ] **Step 4: Run tests and commit**

Run: `node --test test/workspace.test.mjs && npm test`

```bash
git add shared/workspace.js test/workspace.test.mjs
git commit -m "feat: persist browser workspaces locally"
```

### Task 3: Semantic bundle and exact authority states

**Files:**
- Create: `shared/semantic-bundle.js`
- Create: `test/semantic-bundle.test.mjs`

**Interfaces:**
- Produces: `lexicalBundle({ source, tokens, authority })`, `remoteBundle({ source, response, authority })`, `tokenSelection(bundle, tokenIndex)`, `bundleCapability(bundle)`.
- `bundle.authority.kind` is exactly one of `lexical-preview`, `browser-wasm`, `remote-native`.
- `bundle.tokens[*].binding.status` is exactly one of `published`, `not-published`, `ambiguous`.

- [ ] **Step 1: Write failing authority tests**

Assert:

```js
const preview = lexicalBundle({ source, tokens: [{ s: 0, e: 4, v: "main", t: "name" }] });
assert.equal(preview.authority.kind, "lexical-preview");
assert.equal(preview.tokens[0].binding.status, "not-published");
assert.equal(preview.tokens[0].semantic_id, null);
```

For remote responses containing an exact `tokens` projection, assert span-based binding, semantic/application/graph IDs, provenance, and lowering references are preserved as strings. For remote responses without exact token facts, assert the graph remains available but token bindings remain `not-published`; never call the legacy heuristic binder from this module.

- [ ] **Step 2: Observe RED**

Run: `node --test test/semantic-bundle.test.mjs`

Expected: module missing.

- [ ] **Step 3: Implement bundle normalization**

Reject overlapping/out-of-range exact token spans, duplicate exact token IDs, unsafe numeric semantic IDs, authority mismatches, and malformed graph collections. Preserve unknown producer fields under `raw`; do not manufacture compatibility or equivalence.

- [ ] **Step 4: Run tests and commit**

Run: `node --test test/semantic-bundle.test.mjs && npm test`

```bash
git add shared/semantic-bundle.js test/semantic-bundle.test.mjs
git commit -m "feat: separate lexical and compiler semantic bundles"
```

### Task 4: Protected IDE transport

**Files:**
- Modify: `worker/index.js`
- Create: `test/ide-worker.test.mjs`
- Modify: `scripts/platform-provision-lib.mjs`
- Modify: `test/platform-provision.test.mjs`

**Interfaces:**
- Browser endpoint: `POST /v1/ide/analyze`.
- Request body: `{ workspace_id, file_id, path, source }`.
- Response: `{ schema: "idol.web.ide.analysis.v1", authority, capability: "remote-native", source_hash, result }`.
- The upstream request is a fresh POST to `https://api.idol.id/api/analyze`; source is never logged or stored by this module.

- [ ] **Step 1: Write failing transport tests**

Cover:

- unauthenticated request → 401;
- wrong Access subject/email/audience/issuer → 403 or 401 according to existing auth contract;
- wrong `Origin` or missing `X-Idol-Request: browser` → 403;
- non-JSON or body over 2 MiB → 415/413;
- path traversal or source/file/workspace IDs over bounds → 400;
- admitted request performs exactly one upstream call to `https://api.idol.id/api/analyze`;
- upstream error is returned as bounded `502` evidence, not a Worker exception;
- response labels `remote-native` and includes the pinned language authority;
- no request body appears in audit detail.

- [ ] **Step 2: Write failing provisioning tests**

Require the existing Access application to include all three public destinations:

```text
platform.idol.id/v1/platform/browser/*
platform.idol.id/ide*
platform.idol.id/v1/ide/*
```

Cloudflare Access public destinations support path wildcards; the provisioning code must update an existing application when its destination set is an older strict subset, while refusing unrelated destination drift.

- [ ] **Step 3: Observe RED in CI**

Commit only the tests and open a draft PR. Run `npm test`; expected failures are missing IDE transport and incomplete Access destinations, while existing Program I/J/K tests remain green.

- [ ] **Step 4: Implement Worker transport**

Reuse the existing Access verifier and browser request checks. Add a dedicated bounded body reader. Construct the upstream request from a fresh URL and headers; do not reuse a consumed request body. Return `cache-control: no-store`.

- [ ] **Step 5: Extend idempotent Access provisioning**

Represent required destinations as a sorted immutable set. If the existing app has only known previous destinations, update it with `PUT /access/apps/:id`; if it contains an unknown destination, fail closed. Keep the same exact email policy and audience.

- [ ] **Step 6: Run tests and commit**

Run: `node --test test/ide-worker.test.mjs test/platform-provision.test.mjs && npm test`

```bash
git add worker/index.js scripts/platform-provision-lib.mjs test/ide-worker.test.mjs test/platform-provision.test.mjs
git commit -m "feat: add protected browser IDE analysis transport"
```

### Task 5: Responsive local-first IDE application

**Files:**
- Create: `apps/ide/index.html`
- Modify: `scripts/build.mjs`
- Modify: `worker/index.js`
- Modify: `test/build.test.mjs`
- Modify: `test/worker.test.mjs`

**Interfaces:**
- `platform.idol.id/ide` and every `/ide/*` navigation path serve `apps/ide/index.html`.
- Static module dependencies: `/shared/workspace.js`, `/shared/semantic-bundle.js`, `/shared/idol.js`, `/shared/graph.js`, `/shared/wasm.js`.

- [ ] **Step 1: Write failing build and routing tests**

Require the build to package the IDE shell and modules. Require platform `/ide`, `/ide/workspace/:id`, and local `?surface=ide` navigation to serve the IDE. Require `/ide` on other hostnames to keep their existing app behavior.

- [ ] **Step 2: Observe RED**

Run: `node --test test/build.test.mjs test/worker.test.mjs`

Expected: missing IDE shell and route.

- [ ] **Step 3: Implement the IDE shell**

Desktop layout:

```text
activity rail | files | source editor | graph/facts/output
               status/evidence drawer
```

Phone layout:

```text
source · graph · facts · output bottom navigation
file drawer
semantic inspector sheet
```

Implement:

- create, rename, delete, and select files;
- import selected files/directories through browser file input only after user action;
- export a validated workspace snapshot;
- autosave locally with visible persistence state;
- explicit `Analyze remotely` action;
- capability banner for `lexical preview`, `browser Wasm unavailable/available`, and `remote native evidence`;
- source, graph, facts, and output lenses;
- every non-whitespace token clickable;
- selected token rail showing lexical identity, span, source face, binding status, semantic/application/graph IDs when published, provenance, edges, and lowering references;
- explicit `semantic identity not published` when absent;
- graph node selection updates the same rail;
- no source upload during editing, autosave, navigation, import, or export.

Use the existing editor and graph renderer; do not add React, Monaco, CodeMirror, or a virtual DOM.

- [ ] **Step 4: Add accessibility and mobile contracts**

All primary controls are at least 44px on mobile. File tree and graph have keyboard/list alternatives. Drawers use focus containment and restore focus. Motion honors `prefers-reduced-motion`. Editor/source uses Iosevka; UI prose uses sans.

- [ ] **Step 5: Run tests and commit**

Run: `node --test test/build.test.mjs test/worker.test.mjs && npm test && npm run build`

```bash
git add apps/ide/index.html scripts/build.mjs worker/index.js test/build.test.mjs test/worker.test.mjs
git commit -m "feat: add local-first browser IDE"
```

### Task 6: Platform entry point, docs, and deployment evidence

**Files:**
- Modify: `apps/platform/index.html`
- Modify: `README.md`
- Modify: `content/docs/platform.md`
- Modify: `.github/workflows/deploy.yml`
- Modify: `test/build.test.mjs`

**Interfaces:**
- Platform console exposes an `Open browser IDE` action only after the browser session is admitted.
- Runtime/deploy manifest reports the IDE surface capability and whether a browser Wasm artifact is present.

- [ ] **Step 1: Write failing copy/build tests**

Require all copy to distinguish local lexical preview, optional browser Wasm, and remote native evidence. Require docs to state that IndexedDB holds local source, remote analysis is opt-in, and source is not a cloud workspace.

- [ ] **Step 2: Observe RED**

Run: `node --test test/build.test.mjs`

- [ ] **Step 3: Implement entry point and documentation**

Update the production deployment summary to include the protected IDE route. Do not claim repository integration, collaboration, shell, source control, transformation, or full browser compiler support.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm run check
npx --yes wrangler@4.125.0 deploy --dry-run --outdir .wrangler-dry-run
```

Expected: zero failed tests, successful immutable build, successful Wrangler validation.

- [ ] **Step 5: Request review and repair findings**

Mark the PR ready. Resolve all critical/important review findings with regression tests. Re-run the full suite after the final repair.

- [ ] **Step 6: Reconcile latest main and merge**

Compare the branch against current `main`. Preserve all concurrent commits. Create a fresh merge candidate if the PR branch is stale or GitHub verification stops scheduling. Merge only after the exact candidate is green.

- [ ] **Step 7: Verify production**

Probe:

```text
GET  https://platform.idol.id/ide              -> Access challenge or authenticated IDE
GET  https://platform.idol.id/__idol/version   -> deployed main commit
POST https://platform.idol.id/v1/ide/analyze   -> Access protected
GET  https://idol.id/__idol/version            -> same deployed commit
```

When an authenticated browser session is available, verify create/edit/reload persistence, explicit analysis, token selection, graph selection, mobile layout, and audit metadata. Do not claim interactive behavior that could not be exercised through Access.
