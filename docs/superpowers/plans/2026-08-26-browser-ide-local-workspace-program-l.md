# Browser IDE and Local Workspace — Program L Implementation Record

**Status:** implemented on `feat/browser-ide-program-l-20260826`; merge and production verification pending  
**Date:** 2026-08-26  
**Spec:** `docs/superpowers/specs/2026-08-25-worlds-platform-design-addendum.md`

## Goal

Ship the first production-safe, local-first Idol browser IDE at `platform.idol.id/ide` with:

- immutable bounded multi-file workspaces;
- IndexedDB persistence with explicit memory-only fallback;
- lexical preview, optional browser-Wasm, and remote-native authority states;
- exact compiler token spans replacing browser token guesses after analysis;
- clickable source tokens, graph nodes, applications, edges, provenance, representation, and lowering;
- explicit opt-in remote analysis through a protected Worker transport;
- usable desktop, tablet, phone, 320px, touch, keyboard, and reduced-motion layouts.

## Authority constraints

- Workspace IDs, file IDs, paths, tabs, routes, and storage records are product provenance, not semantic identities.
- Source remains local until **Analyze remotely** is explicitly invoked.
- Browser lexical highlighting never claims semantic identity.
- Exact compiler token spans replace covered browser-token regions; uncovered lexical regions remain clickable and `not-published`.
- Stale analysis cannot replace the active file: workspace, path, source, and returned source hash are rechecked.
- Cloudflare Access protects `/ide*` and `/v1/ide/*`; the Worker independently verifies Access claims.
- Audit admission is persisted before source leaves the browser; completion/refusal evidence follows. Audit never stores source text.
- Transport identity does not grant repository, filesystem, process, network, secret, runner, device, or Idol-world authority.

## Implemented work

### 1. Workspace model and persistence

**Files**

- `shared/workspace.js`
- `test/workspace.test.mjs`
- `test/workspace-identity.test.mjs`

**Delivered**

- immutable create/add/write/rename/remove/select operations;
- maximum 256 files, 2 MiB per file, 8 MiB serialized snapshot;
- normalized relative slash paths only;
- missing/null/duplicate identities refused;
- deterministic snapshots;
- memory and IndexedDB stores;
- explicit `storage-unavailable` outcome.

### 2. Semantic bundle and exact token authority

**Files**

- `shared/semantic-bundle.js`
- `shared/ide-semantic-layer.js`
- `test/semantic-bundle.test.mjs`
- `test/semantic-bundle-sparse.test.mjs`

**Delivered**

- `lexical-preview`, `browser-wasm`, and `remote-native` capability states;
- `published`, `not-published`, and `ambiguous` token-binding states;
- exact string-preserving semantic, graph, application, edge, and lowering identities;
- authority mismatch, unsafe-number, malformed-graph, duplicate-ID, overlap, and invalid-span refusal;
- span-based merge of exact compiler projections with uncovered lexical regions;
- exact compiler-token visual rendering rather than index-based decoration;
- stale response refusal when file/workspace/source/hash changes in flight.

### 3. Protected IDE transport

**Files**

- `worker/ide.js`
- `worker/index.js`
- `test/ide-worker.test.mjs`

**Delivered**

- `POST /v1/ide/analyze` only on `platform.idol.id`;
- verified Access identity and exact owner admission;
- exact Platform `Origin` plus `X-Idol-Request: browser` proof;
- JSON, identifier, path, body, source, and result bounds;
- one fixed upstream request to `https://api.idol.id/api/analyze`;
- bounded `502` refusal rather than Worker exceptions;
- request audit before source transfer, then completion/refusal audit;
- source hash/size metadata only; no source text in audit;
- audit-unavailable fails closed before source transfer.

### 4. Access and D1 provisioning

**Files**

- `scripts/platform-provision-lib.mjs`
- `scripts/provision-platform.mjs`
- `test/provision-platform.test.mjs`
- `migrations/0001_platform_identity.sql`

**Delivered**

- Access destinations for browser account APIs, `/ide*`, and `/v1/ide/*`;
- complete application-document reconciliation, including exact OTP IdP, session duration, redirect, launcher, interstitial, and deny-message settings;
- unknown destination drift refusal;
- exact bootstrap email policy;
- D1 profile, digest-only token, and append-only audit storage;
- production Wrangler generation without secrets.

### 5. Responsive IDE application

**Files**

- `apps/ide/index.html`
- `shared/ide-directory.js`
- `shared/platform-ide-entry.js`
- `shared/shell.js`
- `scripts/build.mjs`
- `test/build.test.mjs`
- `test/worker.test.mjs`

**Delivered**

- source, graph, facts, output, and semantic-inspector lenses;
- file create/rename/delete/select/import/export/autosave;
- file and directory import preserving `webkitRelativePath`;
- local workspace deep links;
- session-gated Platform IDE entry rather than public hero link;
- IDE-only routing at `platform.idol.id/ide*`;
- exact token and graph cross-linking;
- responsive activity rail, file drawer, inspector sheet, and mobile bottom navigation;
- 44px touch targets, keyboard shortcuts, 320px contract, reduced motion;
- Iosevka for source/exact facts and sans-serif for product prose.

### 6. Documentation and deployment

**Files**

- `README.md`
- `content/docs/platform.md`
- `.github/workflows/deploy.yml`
- `runtime/manifest.json` generated by `scripts/build.mjs`

**Delivered**

- honest local-first and explicit-upload documentation;
- runtime IDE capability contract;
- production provisioning, migration, immutable build, Wrangler validation, and atomic deploy on every `main` push;
- deployment evidence for all ten hosts plus protected Platform IDE paths.

## Verification sequence

### RED evidence

- missing workspace and semantic-bundle modules failed first;
- baseline tests remained green while seven protected-transport tests failed;
- IDE app/build/routing contracts failed before the app existed.

### Required exact-head checks

```bash
node --test test/workspace.test.mjs test/workspace-identity.test.mjs
node --test test/semantic-bundle.test.mjs test/semantic-bundle-sparse.test.mjs
node --test test/ide-worker.test.mjs test/provision-platform.test.mjs
node --test test/build.test.mjs test/worker.test.mjs
npm run check
npx --yes wrangler@4.125.0 deploy --dry-run --outdir .wrangler-dry-run
```

### Review gate

Before merge:

- all Codex, CodeRabbit, and other review findings must be verified against the current head;
- every valid critical/important finding receives a regression test and fix;
- all review threads are resolved;
- current `main` is compared and any concurrent changes are preserved;
- the exact merge candidate reruns the full suite and Wrangler validation.

### Production verification

After merge and automatic deployment:

```text
GET  https://platform.idol.id/ide
     -> Access challenge or authenticated IDE

GET  https://platform.idol.id/__idol/version
GET  https://idol.id/__idol/version
GET  https://worlds.idol.id/__idol/version
GET  https://docs.idol.id/__idol/version
     -> same merged main commit

GET  https://platform.idol.id/runtime/manifest.json
     -> IDE route/local-storage/upload/analysis contract

POST https://platform.idol.id/v1/ide/analyze
     -> Access protected; no unauthenticated source transfer
```

An authenticated browser exercise must verify local create/edit/reload persistence, file and directory import, explicit remote analysis, stale-result refusal, exact token replacement, graph selection, mobile navigation, and metadata-only audit. Interactive claims are limited to what can actually be exercised through Access.

## Explicitly deferred

- GitHub/GitLab/Bitbucket repository connections;
- provider-secret storage;
- cloud-synchronized or collaborative workspaces;
- repository mutation and PR generation;
- native build/test/benchmark runners;
- transactional migrations and metaprogram execution;
- shell execution;
- private world publication and universe management.
