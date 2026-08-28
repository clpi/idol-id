# Hosted MCP and Live Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `mcp.idol.id` as an authenticated, stateless hosted Idol MCP and `live.idol.id` as an authenticated project/collaboration control plane with profiles, API keys, world-view binding, one causal history, one admitted frontier, and exact graph projections.

**Architecture:** Extend the existing Cloudflare Worker/D1 platform rather than creating a second authority or runtime. The hosted MCP is a transport projection: it validates MCP framing, authenticates an existing platform API token, and delegates each tool to the existing platform, Universe, compiler-analysis, world, or new Live service. Live persists collaboration facts as projects, nodes, application records, causal events, and frontier decisions; operation names remain relation identities while graph edges are derived structural roles (`relation`, `subject`, `target`, `operand`, `result`, `world`, `witness`, `demand`, `provenance`) rather than operational edge kinds.

**Tech Stack:** Cloudflare Workers, D1, JavaScript ES modules, Node 22 tests, immutable static assets, Cloudflare Access, MCP Streamable HTTP (`2026-07-28` plus handshake-era compatibility), real-Chrome CDP smoke tests.

**Spec:** `authority/Idol-live.md`; `docs/superpowers/specs/2026-08-25-worlds-platform-design-addendum.md`; `runtime/authority.json`.

## Global Constraints

- `clpi/idol` remains the sole Idol semantic authority; this repository may only project exact authority.
- Live owns collaboration truth, not language truth.
- History is immutable; frontier decisions add facts and never erase attempts.
- Exactly one accepted frontier exists per project.
- Causal admission must be closed over admitted predecessors.
- An operation word is a relation identity, never a structural graph edge role.
- Reverse traversal is derived from forward records.
- Paths, hostnames, package coordinates, UI records, and API token IDs never mint semantic identity or world authority.
- A Universe View is an operational projection over one semantic universe and grants no authority.
- Browser mutation requires verified Cloudflare Access identity plus exact same-origin proof.
- API and MCP mutation requires digest-only API tokens with exact scopes.
- MCP is stateless for protocol `2026-07-28`; no hidden session state or `Mcp-Session-Id` is created.
- Hosted MCP validates `Origin` when present and validates modern `Mcp-Method`/`Mcp-Name` headers against the JSON-RPC body.
- No hosted tool can choose an arbitrary upstream URL.
- Every new app remains responsive at 390×844, keyboard usable, safe-area aware, and free of horizontal overflow.
- Product prose uses sans-serif; Iosevka is limited to code, exact IDs, hashes, spans, and machine facts.
- The current implementation remains a host transport/reference realization until an artifact-bound Idol/Wasm realization is admitted.

---

### Task 1: RED contracts for MCP, Live, persistence, routing, and browser behavior

**Files:**
- Create: `test/mcp-worker.test.mjs`
- Create: `test/live-core.test.mjs`
- Create: `test/live-worker.test.mjs`
- Create: `test/live-build.test.mjs`
- Create: `test/live-migration.test.mjs`
- Create: `test/live-ui.test.mjs`

**Interfaces:**
- Consumes: current `worker/entry.js`, platform authentication, Universe stores, build and deployment manifests.
- Produces: executable behavioral contract for every later task.

- [ ] Write tests proving the current tree lacks `mcp.idol.id`, `live.idol.id`, MCP discovery/tools/call, Live project persistence, causal frontier closure, world-view binding, scopes, migrations, UI, navigation, and production verification.
- [ ] Run `node --test --test-concurrency=1 test/mcp-worker.test.mjs test/live-core.test.mjs test/live-worker.test.mjs test/live-build.test.mjs test/live-migration.test.mjs test/live-ui.test.mjs` and observe only expected missing-feature failures.
- [ ] Commit the RED contracts without production code.

### Task 2: Live collaboration model and derived graph projection

**Files:**
- Create: `shared/live.js`
- Test: `test/live-core.test.mjs`

**Interfaces:**
- Produces:
  - `LiveError`
  - `normaliseLiveProjectInput(input)`
  - `normaliseLiveNodeInput(input)`
  - `normaliseLiveApplicationInput(input)`
  - `normaliseLiveEventInput(input)`
  - `normaliseFrontierDecision(input)`
  - `projectLiveGraph(project, nodes, applications, events, frontier)`

- [ ] Implement bounded UTF-8 validation and stable string IDs.
- [ ] Model operation semantics as application records with relation identity plus subject/target/operand/result/world/witness/demand/provenance fields.
- [ ] Derive structural edges from application records; never accept operational edge kinds as stored authority.
- [ ] Model immutable causal events with predecessor IDs.
- [ ] Model frontier decisions (`held`, `admitted`, `rejected`, `superseded`, `reversed`) and reject admission when any predecessor is not admitted.
- [ ] Publish explicit boundaries: one semantic universe, one project frontier, no semantic identity minting, no world authority grant, no dispatcher authority.
- [ ] Verify deterministic ordering and fail-closed unknown/duplicate identities.

### Task 3: Live memory and D1 stores

**Files:**
- Create: `shared/live-memory.js`
- Create: `shared/live-d1.js`
- Create: `migrations/0007_live_control_plane.sql`
- Test: `test/live-core.test.mjs`
- Test: `test/live-migration.test.mjs`

**Interfaces:**
- Produces store methods:
  - `commitProject(record, member, event)`
  - `listProjects(subject, limit)`
  - `getProject(subject, id)`
  - `updateProject(record, event)`
  - `commitNode(record, event)`
  - `commitApplication(record, event)`
  - `commitEvent(record, audit)`
  - `commitFrontier(record, audit)`
  - `projectGraph(subject, projectId)`

- [ ] Add subject-owned projects and owner membership.
- [ ] Add immutable nodes, applications, events, and append-only frontier decisions.
- [ ] Use D1 `batch()` for record plus audit writes.
- [ ] Preserve shipped migrations and add only migration `0007`.
- [ ] Store JSON as bounded documents and expose bounded list summaries.
- [ ] Exercise the migration with `node:sqlite` in tests.

### Task 4: Live service and world-view binding

**Files:**
- Create: `shared/live-service.js`
- Test: `test/live-core.test.mjs`

**Interfaces:**
- Produces `createLiveService({ store, universe, now, randomBytes })` with:
  - `listProjects(identity, limit)`
  - `createProject(identity, input)`
  - `getProject(identity, id)`
  - `updateProject(identity, id, patch)`
  - `createNode(identity, projectId, input)`
  - `createApplication(identity, projectId, input)`
  - `appendEvent(identity, projectId, input)`
  - `setFrontier(identity, projectId, input)`
  - `graph(identity, projectId)`
  - `bindUniverseView(identity, projectId, universeViewId)`

- [ ] Require verified subject/email identity.
- [ ] Keep project IDs, node IDs, application IDs, and event IDs opaque and stable.
- [ ] Validate linked Universe Views through the existing subject-owned Universe service.
- [ ] Store the world view as a reference/projection fact; do not copy worlds or grant authority.
- [ ] Emit exact audit records for every mutation.

### Task 5: Platform token scopes and multi-scope authentication

**Files:**
- Modify: `shared/platform-auth.js`
- Modify: `shared/platform.js`
- Modify: `apps/platform/index.html`
- Test: `test/platform-worker.test.mjs`
- Test: `test/mcp-worker.test.mjs`

**Interfaces:**
- Add scopes: `live:read`, `live:write`, `mcp:connect`, `world:write`.
- Extend `authenticateApiToken(rawToken, requiredScopes)` to accept one scope or an array and return one authenticated principal.

- [ ] Add focused failing tests first.
- [ ] Preserve existing single-scope callers.
- [ ] Require every requested scope and return one exact missing-scope refusal.
- [ ] Add the scopes to the existing profile/token console without changing secret handling.

### Task 6: Live browser/API transport

**Files:**
- Create: `worker/live.js`
- Modify: `worker/entry.js`
- Test: `test/live-worker.test.mjs`

**Interfaces:**
- Browser prefix: `/v1/live/browser/`
- API prefix: `/v1/live/api/`
- Public status: `/v1/live/status`

- [ ] Route browser requests only on `live.idol.id` with Access identity and same-origin proof.
- [ ] Route API requests only on `api.idol.id` with `live:read`/`live:write` scopes.
- [ ] Expose projects, project detail, graph, node/application/event creation, frontier decisions, and Universe View binding.
- [ ] Bound JSON bodies and list limits.
- [ ] Fail closed on absent Access, D1, or Universe storage.

### Task 7: Hosted MCP transport and tool delegation

**Files:**
- Create: `shared/mcp.js`
- Create: `worker/mcp.js`
- Modify: `worker/entry.js`
- Test: `test/mcp-worker.test.mjs`

**Interfaces:**
- Endpoint: `https://mcp.idol.id/mcp`
- Modern protocol: `2026-07-28`
- Legacy compatibility: `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`

- [ ] Implement JSON-RPC errors, deterministic tool catalog, `server/discover`, legacy `initialize`, `notifications/initialized`, `ping`, `tools/list`, and `tools/call`.
- [ ] Require `mcp:connect`; enforce each tool's underlying scope from the already-authenticated principal.
- [ ] Validate modern protocol and routing headers; reject mismatch.
- [ ] Validate `Origin` when present.
- [ ] Do not issue session IDs.
- [ ] Return cache hints on modern discovery/list results.
- [ ] Expose read tools for authority/profile/worlds/Universe/Live and write tools for Live project/node/application/event/frontier/world-view binding.
- [ ] Delegate compiler analysis only to the fixed `https://api.idol.id/api/analyze` endpoint with bounded input/output and no redirect following.
- [ ] Record MCP tool usage through the existing audit store without storing token secrets or source text.

### Task 8: Live and MCP product surfaces

**Files:**
- Create: `apps/live/index.html`
- Create: `apps/mcp/index.html`
- Create: `shared/live-app.js`
- Create: `shared/live-app.css`
- Modify: `shared/shell.js`
- Modify: `apps/site/index.html`
- Modify: `apps/platform/index.html`
- Test: `test/live-ui.test.mjs`

**Interfaces:**
- Live UI: project catalog, selected project, goal/task/attempt/intent graph, causal history, frontier, world view, exact raw records.
- MCP UI: endpoint, auth/scopes, deterministic tools, protocol versions, example client configuration.

- [ ] Make project creation and selection functional.
- [ ] Make node/application/event/frontier creation functional through browser APIs.
- [ ] Make every node/application/edge/event/frontier record selectable and cross-linked.
- [ ] Show exact structural edge role and relation identity separately.
- [ ] Show explicit not-published/not-proven/no-authority states.
- [ ] Add profile/token/world-management links.
- [ ] Add mobile catalog/graph/history/facts modes, safe-area padding, 44 px controls, and no overflow.

### Task 9: Build, routing, Access, manifests, and production verification

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `worker/index.js`
- Modify: `wrangler.jsonc`
- Modify: `scripts/platform-provision-lib.mjs`
- Modify: `scripts/verify-production.mjs`
- Modify: `.github/workflows/deploy.yml`
- Create: `runtime/live-contract.json`
- Test: `test/live-build.test.mjs`

**Interfaces:**
- New custom domains: `live.idol.id`, `mcp.idol.id`.
- Runtime projections: `/runtime/live-contract.json`, MCP tool manifest in `/runtime/manifest.json`.

- [ ] Build both app shells and include both hostnames in immutable manifests.
- [ ] Route `live.idol.id` and `mcp.idol.id` through the same Worker.
- [ ] Protect Live browser routes with the existing exact-owner Access application.
- [ ] Keep MCP outside Access and inside API-token authentication.
- [ ] Add post-deploy probes for Live status, Access redirect, MCP discovery refusal without token, MCP authenticated smoke, host version convergence, and mobile browser QA.

### Task 10: Honest Idol source bridge and deletion gate

**Files:**
- Create: `live/model.id`
- Create: `live/projection.id`
- Modify: `runtime/idol-source-manifest.json`
- Modify: `runtime/live-contract.json`
- Test: `test/live-build.test.mjs`

**Interfaces:**
- Source declares the Live project/history/frontier/application projection model using current admitted Idol source forms only.
- Runtime contract reports `implementation: host-reference`, `idol_source_present: true`, `idol_execution_admitted: false` until a compiler-generated artifact and correspondence evidence exist.

- [ ] Use only syntax already present in exact current authority examples.
- [ ] Add source provenance records.
- [ ] Do not advertise the source as the executing implementation.
- [ ] Publish the deletion gate for the host reducer/transport once an artifact-bound Idol/Wasm realization passes differential evidence.

### Task 11: Final verification, review, merge, and live browser proof

**Files:**
- No new production files unless a test reveals a defect.

- [ ] Run the full `npm run check` suite.
- [ ] Run Wrangler 4.125.0 dry-run.
- [ ] Run real-Chrome 390×844 and 1440×900 interaction flows for Live, MCP, Platform token scopes, Graph, Lib, and root navigation.
- [ ] Confirm no runtime exceptions, console errors, same-origin 5xx responses, or horizontal overflow.
- [ ] Reconcile current `main` without dropping concurrent authority changes.
- [ ] Resolve every review thread.
- [ ] Merge only the exact green head.
- [ ] Observe the main deploy and independently probe `live.idol.id`, `mcp.idol.id`, every existing Idol hostname, and the hosted MCP with a temporary test token that is revoked immediately after use.
