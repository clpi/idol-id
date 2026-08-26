# Program O — Universe Views Implementation Plan

> **Authority:** `clpi/idol-id` provides the product and transport projection. `clpi/idol` remains the sole language/semantic authority. A universe view is an operational graph/query projection, never a second semantic universe.

**Goal:** Ship a bounded, mobile-first Universe Views vertical slice on `platform.idol.id` and `worlds.idol.id`: users can save exact constellations of published or foreign-origin world references, inspect evidence-safe analysis, keep them private or publish a read-only view, and access the same facts through scoped APIs. No world composition, authority grant, semantic identity, or equivalence is inferred.

**Base:** `acc63620641ff1dc1ea120ddd43ce10e9c5ed4fa`

## Non-negotiable boundaries

- Grok remains the canonical 24/7 dispatcher. Do not touch Grok, Hermes, Telegram, ntfy, pollers, queues, or host processes.
- One semantic universe only. `UniverseView` is a physical product record and saved graph projection.
- World selection uses explicit origin-qualified references; display names are not semantic join keys.
- Existing graph IDs and other exact identities remain strings.
- Foreign candidates retain `semantic_id: null` and `identity_status: not-published`.
- Unknown, ambiguous, private, or stale selections fail closed.
- The view may report facts, differences, unresolved identity, evidence, and refusals. It may not claim composition, reachability, compatibility, equivalence, injection, authority, or grants.
- Mutations require independently verified Cloudflare Access identity plus same-origin browser proof, or an API token with the exact scope.
- Every record mutation and its audit event commit atomically.
- Public views expose only the bounded published projection; owner subject/email and private operational metadata never appear.
- No repository mutation, provider credential, native execution, shell execution, world publication, or agent dispatch is added.

## Data contract

### Universe view

```json
{
  "schema": "idol.web.universe.view.v1",
  "id": "uv_<random>",
  "semantic_id": null,
  "identity_status": "not-published",
  "title": "Native boundary worlds",
  "visibility": "private",
  "lens": "constellation",
  "query": "wasm target",
  "policy": {
    "require_evidence": true,
    "deny_unpublished_identity": false,
    "deny_unverified_projection": true
  },
  "selections": [
    { "source": "published", "key": "io@0.1.0" },
    { "source": "foreign", "key": "wasm-wasi" }
  ],
  "resolved": [],
  "analysis": {},
  "boundary": {},
  "created_at": "...",
  "updated_at": "..."
}
```

### Lenses

- `constellation` — selected records and origin/evidence summary.
- `reach` — published reachability facts only; otherwise exact `not-published` refusal.
- `authority` — declared capability/world requirements only; no grant inference.
- `projection` — artifact/projection availability, evidence, obligations, and refusal counts.
- `security` — uncertainty, unpublished identities, unverified projections, and policy violations.

### Selection bounds

- maximum 32 selections;
- unique `(source,key)` pairs;
- sources: `published`, `foreign`;
- titles 1–120 UTF-8 characters;
- query maximum 512 characters;
- supported policy booleans only;
- no arbitrary JSON extensions.

## Tasks

### Task 1 — RED model contracts

Create `test/universe-view.test.mjs` first. Require:

1. exact published and foreign reference resolution from immutable projections;
2. graph IDs retained as strings;
3. foreign semantic identity remains unpublished;
4. duplicate/unknown selections fail exactly;
5. policy violations appear as evidence-safe refusals;
6. analysis never emits composition/equivalence/grant claims;
7. public projection omits owner/audit/private fields;
8. bounded summary omits the full resolved graph payload.

Run the PR workflow and observe RED because `shared/universe.js` does not exist.

### Task 2 — Universe model

Create `shared/universe.js` with pure functions:

- `normaliseUniverseInput(input)`;
- `catalogUniverseWorlds(worldManifest, foreignManifest)`;
- `resolveUniverseSelections(input, catalogs)`;
- `createUniverseView(input, catalogs, options)`;
- `universeViewSummary(view)`;
- `publicUniverseView(view)`.

The model must be deterministic for fixed input/time/id, immutable, and must publish explicit boundary/refusal facts.

### Task 3 — RED persistence contracts

Extend tests to require subject-owned, atomic storage:

- memory list/get/commit;
- D1 list/get/commit;
- summaries exclude resolved payload and policy internals not required for navigation;
- private records never cross subjects;
- public lookup returns only public records;
- equal timestamps use insertion/row order descending.

Create migration contract for `migrations/0006_universe_views.sql`.

### Task 4 — Persistence

Create:

- `shared/universe-memory.js`;
- `shared/universe-d1.js`;
- `migrations/0006_universe_views.sql`.

Table fields:

```text
id
subject
title
visibility
lens
selection_count
violation_count
document
created_at
updated_at
```

Indexes:

- subject/update history;
- public/update history.

`commitView(record,event)` must use one D1 `batch()` containing view upsert and `platform_audit` insert.

### Task 5 — RED service and transport contracts

Create `test/universe-worker.test.mjs`. Require:

Browser routes on `platform.idol.id`:

```text
GET  /v1/universe/browser/views
POST /v1/universe/browser/views
GET  /v1/universe/browser/views/:id
PATCH /v1/universe/browser/views/:id
```

API routes on `api.idol.id`:

```text
GET  /v1/universe/api/views
POST /v1/universe/api/views
GET  /v1/universe/api/views/:id
```

Public route on `worlds.idol.id`:

```text
GET /v1/universe/public/:id
```

Require:

- Access identity and same-origin proof for browser writes;
- `universe:read` and `universe:write` API scopes;
- private public lookup returns 404 without existence disclosure;
- immutable world/foreign catalogs are loaded from deployed assets;
- unknown world references fail before persistence;
- transport returns exact status/error codes.

### Task 6 — Service and transport

Create:

- `shared/universe-service.js`;
- `worker/universe.js`.

Wire `worker/index.js` before generic proxy/static routing. Extend `PLATFORM_SCOPES` with:

```text
universe:read
universe:write
```

Use existing Access JWT, API token, D1, CSRF, and error patterns rather than inventing a competing identity system.

### Task 7 — RED routing/build/UI contracts

Create `test/universe-ui.test.mjs`. Require:

- `platform.idol.id/universe` serves the authenticated manager shell;
- `worlds.idol.id/universe/:id` serves the public read-only shell;
- global navigation exposes `universe`;
- build packages `apps/universe/index.html` and shared module;
- runtime manifest publishes the exact capability and boundary;
- 320 px/mobile CSS, 44 px controls, safe-area handling, reduced-motion query;
- Iosevka only for IDs/code, sans-serif for product prose;
- no hover-only workflow.

### Task 8 — Responsive Universe workspace

Create `apps/universe/index.html` and `shared/universe-app.js`.

Authenticated manager:

- selection search over the immutable published/foreign catalogs;
- constellation tray with maximum 32 selections;
- title, lens, query, policy, private/public controls;
- save/update actions;
- history list;
- deterministic analysis panels;
- exact boundary/refusal panel;
- copyable public link only after public save.

Public reader:

- read-only title/lens/selection/analysis/boundary;
- links to World Atlas, Graph, Lib, integration, and exact provenance where available;
- no edit controls or owner metadata.

Responsive layout:

```text
desktop: catalog | constellation/analysis | boundary rail
tablet: catalog drawer | active workspace | boundary sheet
phone: catalog · view · analysis · boundary bottom navigation
```

### Task 9 — Platform presentation and documentation

- Add a signed-in Universe Views entry on Platform.
- Mark Program O `live` with exact bounded wording.
- Add `content/docs/universe.md`.
- Update root/docs/API navigation and relevant capability copy without overstating composition/collaboration.

### Task 10 — Build and deploy

Update:

- `scripts/build.mjs` app list and runtime manifest;
- `worker/index.js` platform/worlds navigation routing;
- `.github/workflows/deploy.yml` deployment summary if required.

Every merge to `main` must continue to provision, migrate, build, validate, and atomically deploy all ten existing host surfaces. No new hostname is required; Universe Views live under `platform.idol.id` and `worlds.idol.id`.

### Task 11 — Verification and review

Before merge:

1. focused Universe model/persistence/transport tests;
2. full Node test suite;
3. immutable build;
4. Wrangler 4.125.0 dry-run;
5. Codex review;
6. resolve every valid P1/P2 review thread;
7. verify no Grok/Hermes/Telegram/ntfy/dispatcher files changed.

After merge:

1. observe the exact `main` deployment workflow through success;
2. verify D1 migration `0006` applied;
3. probe `__idol/version` and health on all ten surfaces;
4. probe Platform Universe shell, Worlds public shell, private public refusal, and API unauthenticated refusal;
5. confirm each surface reports the exact merge commit;
6. confirm `hermes.idol.id` and dispatcher topology were not changed by the deployment.

## Deliberately deferred

- organization/team sharing and collaborative editing;
- private-world ingestion;
- semantic world composition or reachability witnesses;
- world/capability grants;
- repository writes, branches, commits, or PR creation;
- native build/test/benchmark execution;
- shell sessions;
- agent dispatch;
- shared Idol native/Wasm semantic core migration (Program Q).
