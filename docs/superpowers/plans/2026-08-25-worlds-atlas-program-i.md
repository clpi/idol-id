# Worlds Atlas Program I Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `worlds.idol.id` as a responsive public World Atlas, reserve `platform.idol.id` with an honest public frontier shell, and deploy both automatically from `idol-id/main` without inventing semantic world facts.

**Architecture:** The Cloudflare Worker becomes the origin for the two new hostnames through Custom Domains. `worlds.idol.id` reads an immutable build snapshot generated from the canonical public registry projection, while existing compiler-backed hosts keep their current Tunnel origins. A pure browser/Node world model owns presentation-only filtering, classification, comparison, and links; semantic identities and graph hashes remain sourced from registry manifests.

**Tech Stack:** Node.js 22, native `node:test`, vanilla ES modules, existing exact-dependency browser bridge, Cloudflare Workers Static Assets, Wrangler 4.125.0.

**Spec:** `docs/superpowers/specs/2026-08-25-worlds-platform-design-addendum.md`

## Global Constraints

- `clpi/idol` remains the language and semantic authority.
- `foreign` and `provided` are presentation qualifications, never new semantic world kinds.
- The UI may classify a manifest for navigation, but must display the exact published identity, graph hash, provenance, and version from the manifest.
- `worlds.idol.id` and `platform.idol.id` are originless Worker Custom Domains; they must never proxy a same-host request and recurse.
- Existing `/api/*`, `/health`, and `/info` behavior on the current Route-backed hosts must remain unchanged.
- Mobile is first-class: 44 px touch targets, no hover-only actions, safe-area padding, single-column layouts below 700 px.
- Body/UI prose uses the shared sans family; code, graph IDs, hashes, versions, and machine facts use the Iosevka-first mono stack.
- No React, virtual DOM, component rerender tree, or new runtime dependency.
- A push to `main` must continue to test, build, and deploy one immutable version across all configured surfaces.

---

### Task 1: Lock the host-routing and build contract with failing tests

**Files:**
- Modify: `test/worker.test.mjs`
- Create: `test/build.test.mjs`

**Interfaces:**
- Consumes: `resolveHost(hostname)`, `handle(request, env)`, and `npm run build`.
- Produces: executable expectations for the `worlds` and `platform` host records, originless refusal behavior, app shells, and deployment manifest entries.

- [ ] **Step 1: Add failing Worker tests**

Add a `worlds` and `platform` asset to `envWithAssets()` and these tests:

```js
test("worlds and platform are originless custom-domain surfaces", () => {
  assert.deepEqual(resolveHost("worlds.idol.id"), { app: "worlds", surface: "worlds", origin: false });
  assert.deepEqual(resolveHost("platform.idol.id"), { app: "platform", surface: "platform", origin: false });
});

test("worlds navigation receives the atlas shell", async () => {
  const response = await handle(new Request("https://worlds.idol.id/world/std", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(await response.text(), "<html>worlds</html>");
});

test("originless surfaces refuse dynamic proxy paths instead of recursing", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("unexpected"); };
  const response = await handle(new Request("https://worlds.idol.id/api/worlds"), envWithAssets());
  assert.equal(response.status, 404);
  assert.equal(called, false);
});

test("local development can select the new surfaces", async () => {
  let response = await handle(new Request("http://localhost/?surface=worlds"), envWithAssets());
  assert.equal(await response.text(), "<html>worlds</html>");
  response = await handle(new Request("http://localhost/?surface=platform"), envWithAssets());
  assert.equal(await response.text(), "<html>platform</html>");
});
```

- [ ] **Step 2: Add a failing build contract test**

Create `test/build.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

test("build emits worlds and platform in one deployment", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
  assert.equal(manifest.surfaces["worlds.idol.id"], "worlds");
  assert.equal(manifest.surfaces["platform.idol.id"], "platform");
  assert.match(await readFile("dist/apps/worlds/index.html", "utf8"), /World Atlas/);
  assert.match(await readFile("dist/apps/platform/index.html", "utf8"), /Platform/);
  assert.ok(JSON.parse(await readFile("dist/runtime/worlds.json", "utf8")).worlds.length > 0);
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npm test
```

Expected: failures because `resolveHost()` does not know either hostname and the app/build artifacts do not exist.

- [ ] **Step 4: Commit the red tests**

```bash
git add test/worker.test.mjs test/build.test.mjs
git commit -m "test: define worlds atlas deployment contract"
```

### Task 2: Add the originless Cloudflare host surfaces

**Files:**
- Modify: `worker/index.js`
- Modify: `wrangler.jsonc`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Produces: `resolveHost("worlds.idol.id")`, `resolveHost("platform.idol.id")`, static app shells, manifest entries, and non-recursive originless error behavior.

- [ ] **Step 1: Add host records**

Add:

```js
"worlds.idol.id": { app: "worlds", surface: "worlds", origin: false },
"platform.idol.id": { app: "platform", surface: "platform", origin: false },
```

Mark the existing Route-backed records with `origin: true` so proxy eligibility is explicit.

- [ ] **Step 2: Make local surface selection exact**

Extend the local-host branch so `surface=worlds` resolves to `{ app: "worlds", surface: "worlds", origin: false }` and `surface=platform` resolves similarly.

- [ ] **Step 3: Refuse originless dynamic fallthrough**

Before `proxyOrigin()` and before final `fetch(request)`, require `info.origin !== false`. For originless hosts, return:

```js
return json({ error: "dynamic origin unavailable on this surface", surface: info.surface }, { status: 404 });
```

Static assets, `/config.js`, `/__idol/*`, and navigation shells remain available.

- [ ] **Step 4: Configure Custom Domains**

Append to `wrangler.jsonc` routes:

```json
{ "pattern": "worlds.idol.id", "custom_domain": true },
{ "pattern": "platform.idol.id", "custom_domain": true }
```

Do not create separate DNS code: Cloudflare Custom Domains create DNS and certificates for originless Worker hosts.

- [ ] **Step 5: Extend the build surface list**

In `scripts/build.mjs`:

```js
for (const app of ["site", "docs", "lib", "api", "graph", "worlds", "platform"]) { ... }
```

and add both hostnames to `manifest.surfaces`.

- [ ] **Step 6: Run Worker tests**

Run:

```bash
node --test test/worker.test.mjs
```

Expected: host and recursion tests pass; build test remains red until Tasks 3–4.

- [ ] **Step 7: Commit**

```bash
git add worker/index.js wrangler.jsonc scripts/build.mjs
git commit -m "feat: route worlds and platform as originless surfaces"
```

### Task 3: Implement the presentation-only world model and snapshot refresh

**Files:**
- Create: `shared/worlds.js`
- Create: `test/worlds.test.mjs`
- Create: `runtime/worlds.json`
- Create: `scripts/snapshot-worlds.mjs`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces:
  - `normaliseWorld(manifest)`
  - `classifyWorld(manifest)`
  - `filterWorlds(worlds, query, category)`
  - `compareWorlds(left, right)`
  - `worldCoordinate(world)`
  - `registryUrl(world)`
  - `graphUrl(world)`

- [ ] **Step 1: Write failing model tests**

Create `test/worlds.test.mjs` with real manifest objects and assertions that:

- `publisher: "idol.id"` classifies as `provided`;
- `provenance.origin.family: "rust"` classifies as `foreign`;
- another publisher classifies as `published`;
- search matches name, summary, tags, publisher, origin, graph ID, and version;
- comparison reports exact changed fields without inventing compatibility;
- links encode the world name safely.

- [ ] **Step 2: Run the model tests and verify RED**

```bash
node --test test/worlds.test.mjs
```

Expected: module-not-found failure for `shared/worlds.js`.

- [ ] **Step 3: Implement the pure model**

`classifyWorld()` returns one of `provided`, `foreign`, or `published` as a UI qualification only. `compareWorlds()` returns rows shaped as:

```js
{ field: "version", left: "0.1.0", right: "0.2.0", equal: false }
```

It does not emit `compatible`, `breaking`, or any semantic judgment.

- [ ] **Step 4: Add a checked-in fallback snapshot**

Create `runtime/worlds.json` with schema `idol.web.worlds.v1`, a `captured_at` timestamp, `source: "https://api.idol.id/api/worlds"`, and the current eight public manifests. This makes local/offline builds deterministic.

- [ ] **Step 5: Add the production snapshot script**

`scripts/snapshot-worlds.mjs` fetches `IDOL_WORLD_SOURCE` or `https://api.idol.id/api/worlds`, validates `{ worlds: [] }`, strips no published fields, adds snapshot metadata, and atomically replaces `runtime/worlds.json`. Network failure exits nonzero unless `IDOL_WORLD_SNAPSHOT_OPTIONAL=1` is explicitly set.

- [ ] **Step 6: Refresh before the immutable production build**

In the deploy job, run:

```yaml
- name: Snapshot the public world projection
  run: node scripts/snapshot-worlds.mjs
```

before `npm run build`. PR verification continues using the checked-in fallback and does not depend on the live origin.

- [ ] **Step 7: Copy the snapshot into `dist`**

Update `scripts/build.mjs` to copy `runtime/worlds.json` after creating `dist/runtime`, then write the runtime manifest without overwriting the snapshot.

- [ ] **Step 8: Run tests**

```bash
node --test test/worlds.test.mjs test/build.test.mjs
```

Expected: model tests pass; build still fails only if app shells are absent.

- [ ] **Step 9: Commit**

```bash
git add shared/worlds.js test/worlds.test.mjs runtime/worlds.json scripts/snapshot-worlds.mjs scripts/build.mjs .github/workflows/deploy.yml
git commit -m "feat: publish immutable world atlas snapshots"
```

### Task 4: Build the responsive World Atlas and honest Platform frontier

**Files:**
- Create: `apps/worlds/index.html`
- Create: `apps/platform/index.html`
- Modify: `shared/shell.js`
- Modify: `shared/theme.css`

**Interfaces:**
- Consumes: `/runtime/worlds.json`, `shared/worlds.js`, `shared/idol.js`, `shared/graph.js`, and `window.IDOL`.
- Produces: mobile-first world list/detail/compare navigation and an explicit platform capability frontier.

- [ ] **Step 1: Add a static-content test before implementation**

Extend `test/build.test.mjs` to assert:

```js
assert.match(worldsHtml, /type="module"/);
assert.match(worldsHtml, /runtime\/worlds\.json/);
assert.match(worldsHtml, /compare/i);
assert.match(worldsHtml, /@media \(max-width: 699px\)/);
assert.match(platformHtml, /not yet enabled/i);
```

Run the build test and verify it fails for the missing files.

- [ ] **Step 2: Implement `apps/worlds/index.html`**

The page includes:

- sans-serif UI with Iosevka-first exact identity fields;
- search and origin qualification filters;
- list/detail layout on desktop and single-surface/detail-sheet behavior on phones;
- cards showing exact name, version, publisher, graph ID, source hash, tags, line/byte counts, mirror, and capture provenance;
- copyable coordinate `name@version`;
- links to `lib.idol.id/#name` and `graph.idol.id/`;
- comparison of two selected manifests with an explicit notice that it compares published fields, not semantic compatibility;
- clear empty/refusal/error states;
- no essential hover action.

- [ ] **Step 3: Implement `apps/platform/index.html`**

This is an honest public frontier shell, not fake authentication. It exposes the planned account, API, repository, IDE, transformation, world, universe, and shell programs as status cards, links current usable capabilities to Graph/Lib/Worlds, and states that sign-in and write operations are not yet enabled.

- [ ] **Step 4: Add both surfaces to shared navigation**

Add `worlds` and `platform` to `shared/shell.js` navigation. Preserve the compact mobile navigation by allowing horizontal overflow and 44 px touch height below 700 px.

- [ ] **Step 5: Correct shared typography**

Change the global `body` font to `var(--sans)`. Keep `code`, `pre`, inputs that represent code/identities, `.mono-note`, `.statusbar`, semantic IDs, hashes, and exact metrics on `var(--mono)`. Add reusable `.mono`, `.prose`, `.identity`, `.mobile-sheet`, and responsive navigation rules.

- [ ] **Step 6: Run all tests and build**

```bash
npm run check
```

Expected: all Node tests pass and the build reports ten surfaces.

- [ ] **Step 7: Commit**

```bash
git add apps/worlds/index.html apps/platform/index.html shared/shell.js shared/theme.css test/build.test.mjs
git commit -m "feat: add responsive worlds atlas and platform frontier"
```

### Task 5: Review, deploy, and verify the production surfaces

**Files:**
- Modify: `README.md`
- Modify: `content/docs/platform.md`

**Interfaces:**
- Produces: documented host ownership and live evidence for ten immutable surfaces.

- [ ] **Step 1: Document the new surface map**

Update the README and platform docs with `worlds.idol.id` and `platform.idol.id`, the snapshot boundary, Custom Domain behavior, and explicit Program I limitations.

- [ ] **Step 2: Run final local verification**

```bash
npm run check
npx --yes wrangler@4.125.0 deploy --dry-run --outdir .wrangler-dry-run
```

Expected: tests/build pass and Wrangler accepts the two Custom Domains.

- [ ] **Step 3: Open the implementation PR**

PR body must state:

- exact main/base SHA;
- tests and dry-run evidence;
- that world classifications are presentation facts;
- that `platform` is a public frontier only;
- that no auth, provider connection, repo mutation, composition witness, or semantic compatibility claim is included.

- [ ] **Step 4: Review CI and code review**

Do not merge with failing tests or unresolved concrete review findings.

- [ ] **Step 5: Merge and verify production**

After merge, verify HTTP 200 and matching deployed commit at:

```text
https://worlds.idol.id/__idol/version
https://platform.idol.id/__idol/version
https://worlds.idol.id/runtime/worlds.json
```

Also recheck the prior eight hostnames to ensure the single deployment remains coherent.

- [ ] **Step 6: Record the next boundary**

The next implementation plan is Program B/I convergence: exact compiler token/world projections and richer world-detail graph bundles. Authentication and repository writes remain separate Programs K–N.
