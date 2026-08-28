# idol-id — one edge deployment for every idol.id face

`clpi/idol-id` is the canonical web-platform repository. One build and one Cloudflare Worker version serve every public face:

| face | hostnames | application |
|---|---|---|
| site | `idol.id` | landing, installation and project status |
| docs | `docs.idol.id` | law, graph, world and platform references |
| registry | `lib.idol.id` | published packages/worlds, source, graph and provenance |
| api | `api.idol.id` | compiler/registry HTTP console, public world transport and API-token transport |
| graph | `graph.idol.id`, `r8a.idol.id`, `r8b.idol.id`, `r16.idol.id` | explorer, lowering and architecture projections |
| worlds | `worlds.idol.id` | public World Atlas, foreign candidate boundaries and exact manifest comparison |
| platform | `platform.idol.id` | Access-verified account/API console and local-first browser IDE at `platform.idol.id/ide` |

A push to `main` runs tests, builds every surface once, validates the Worker bundle, snapshots the public world projection, validates the authority-pinned foreign projection, provisions the platform identity boundary, applies D1 migrations, and deploys the same immutable version across all ten hosts and protected Platform paths.

## authority

The single `runtime/authority.json` producer pins:

- language and semantic authority: `clpi/idol@cb2199dff026c1b2d3fbd0caa04d6d323370a9e8`
- native realization/evidence: `clpi/idol-native@ad438a856daa8786e77ac9f033d38deb9e8f5c29`

Source spelling, package coordinates, foreign provenance slugs, account identifiers, credential IDs, workspace paths and hostnames are provenance. They do not mint relation, application, value, world, demand or realization identity.

## architecture

```text
browser request
    -> one Cloudflare Worker
    -> host/path selects one product face
    -> existing Route hosts preserve the Cloudflare Tunnel compiler origin
    -> worlds/platform Custom Domains are Worker-origin surfaces
    -> Access protects account APIs, /ide*, and /v1/ide/*
    -> D1 stores platform profiles, token digests and audit events
    -> IndexedDB stores browser workspaces locally
    -> remote-native analysis occurs only after explicit user action
    -> exact deployment/authority/runtime/world/foreign projections remain inspectable
```

Current product sources live in:

```text
apps/{site,docs,lib,api,graph,worlds,platform,ide}/index.html
shared/{theme.css,surface.css,shell.js,idol.js,graph.js,worlds.js,foreign.js,platform*.js,workspace.js,semantic-bundle.js,web.js,wasm.js}
worker/{index.js,platform.js,ide.js}
content/{docs/*.md,foreign.json}
runtime/{authority.json,worlds.json}
migrations/*.sql
```

The legacy Python server remains the dynamic compiler and R2-registry origin for established Route-backed hosts. `/api/*`, `/health`, `/info`, existing registry writes and dynamic fallbacks continue to that Tunnel origin.

`worlds.idol.id` and `platform.idol.id` are Cloudflare Worker Custom Domains. They have no generic same-host dynamic origin. The Worker refuses unknown dynamic fallthrough instead of recursively fetching itself. Explicit `/v1/world/*`, `/v1/platform/*`, and `/v1/ide/*` endpoints are implemented inside the Worker.

## World Atlas boundary

Production deploys refresh `runtime/worlds.json` from the canonical public registry projection and package the immutable snapshot with the same Worker version.

The Atlas exposes exact published fields such as:

```text
name · version · publisher · graph id · source hash
provenance · tags · extent · mirror · publication time
```

Its `provided`, `published` and `foreign` labels are presentation qualifications only. The browser does not infer semantic compatibility, composition, injection witnesses, authority grants or equivalence.

## Foreign candidates and integration projections

`content/foreign.json` is a version-controlled product projection, not a second world registry or compiler authority. The build validates it and emits `/runtime/foreign.json` with exact language/native authority pins.

The first public projection includes candidates for C17, Wasm/WASI, browser, Python, Rust and Go. Every candidate publishes:

```text
semantic_id = null
identity_status = not-published
origin and version provenance
uncertainty and missing facts
selected target projections
ABI / ownership / failure / threading / effect / world obligations
required evidence
exact refusal
```

All initial integration projections are `not-admitted`. They have no artifact and emit no copy/install command.

Public world endpoints:

```text
GET  /v1/world/foreign
GET  /v1/world/:slug/integration
POST /v1/world/import-plan
```

The import-plan operation is deterministic and plan-only. It performs no checkout, source fetch, network probe, upload, binary execution, transformation, semantic publication, world formation or repository mutation.

## Platform identity and API access

Program K establishes a real transport identity boundary without creating a password system or confusing credentials with semantic authority.

Browser identity:

```text
Cloudflare Access one-time PIN
→ Access application JWT
→ Worker verifies RS256 signature, issuer, audience, expiry and exact owner email
→ D1 profile
```

API credentials:

```text
random idol_pat token
→ plaintext returned once
→ SHA-256 digest + prefix + scopes + expiry stored in D1
→ revocation, last-use and append-only audit
```

Public and protected endpoints:

```text
GET   /v1/platform/status                         public
GET   /v1/platform/browser/login                  Access protected
GET   /v1/platform/browser/session                Access protected
GET   /v1/platform/browser/profile                Access protected
PATCH /v1/platform/browser/profile                Access + browser request proof
GET   /v1/platform/browser/tokens                 Access protected
POST  /v1/platform/browser/tokens                 Access + browser request proof
POST  /v1/platform/browser/tokens/:id/revoke      Access + browser request proof
GET   /v1/platform/browser/audit                  Access protected
GET   /v1/platform/api/whoami                     Idol bearer token
```

Browser mutations require the exact Platform origin, `X-Idol-Request: browser`, JSON where a body is parsed, bounded request size, and a verified Access identity. API tokens currently admit only allowlisted read scopes and cannot create other tokens.

An account or token authorizes transport only. It never grants filesystem, process, network, secret, device, repository, runner or Idol-world authority.

## Browser IDE

`platform.idol.id/ide` is a real local-first multi-file workspace rather than a simulated cloud editor.

```text
source files
→ validated immutable workspace model
→ IndexedDB persistence in the current browser
→ immediate lexical preview
→ optional admitted browser Wasm capability
→ explicit Analyze remotely action
→ remote-native compiler evidence
→ exact token / graph / application / edge / lowering inspection
```

The editor keeps every lexical token clickable, including tokens with no semantic binding. Lexical preview is labeled `semantic identity not published`; it never upgrades name matching into compiler authority. When the compiler publishes exact token spans and graph identities, the UI preserves those identities as strings and cross-links them to graph nodes, applications, edges, provenance and lowering.

Source remains local until the user presses **Analyze remotely**. The protected Worker then:

- independently verifies the Access identity;
- requires same-origin browser request proof;
- validates workspace/file/path/source bounds;
- calls the fixed `api.idol.id/api/analyze` origin exactly once;
- returns a `remote-native` semantic bundle;
- appends metadata-only audit evidence without storing source text.

The IDE supports desktop, tablet, phone and 320px layouts; touch-sized controls; file import/export; responsive source/graph/facts/output lenses; keyboard navigation; reduced motion; and Iosevka only for code and exact identities.

This is not a cloud workspace, provider repository connection, shell, collaboration service, or automatic repository mutation surface. Those require later programs and explicit world/policy grants.

## Cloudflare provisioning

The protected production deploy is idempotent:

```text
ensure D1 database idol-platform
ensure Zero Trust organization
ensure one-time-PIN identity provider
ensure Access application for platform account APIs, /ide*, and /v1/ide/*
ensure exact bootstrap owner policy
render production Wrangler config
apply D1 migrations
build and deploy one Worker version
```

The generated configuration contains resource IDs and Access verification facts, not secrets. The Cloudflare API token remains in the protected GitHub production secret store.

## idol web runtime

`shared/web.js` is a small dependency bridge. It tracks exact reads and updates only subscribed projections; it does not build a virtual DOM or run a component-tree diff.

`shared/wasm.js` exposes an admitted Wasm artifact when one is supplied:

```sh
IDOL_WASM_PATH=/path/to/idol-web.wasm npm run build
```

The build publishes `/runtime/manifest.json`, including authority commit, artifact hash, bytes, projection paths, the IDE capability contract, and whether Wasm is actually present. No performance claim is valid without a deployed artifact and reproducible measurement.

## local verification

```sh
npm test
npm run build
npx --yes wrangler@4.125.0 deploy --dry-run
```

Local Worker development:

```sh
npm run dev
# http://localhost:8787/?surface=worlds
# http://localhost:8787/?surface=platform
# http://localhost:8787/?surface=ide
```

Platform provisioning is intentionally production-only unless explicit Cloudflare credentials are supplied:

```sh
node scripts/provision-platform.mjs
npx wrangler d1 migrations apply PLATFORM_DB --remote --config .wrangler.production.jsonc
```

## deployment evidence

Every deployed version exposes:

- `/__idol/version`
- `/__idol/health`
- `/__idol/manifest`
- `/runtime/manifest.json`
- `/runtime/worlds.json`
- `/runtime/foreign.json`
- `/v1/platform/status`
- `/ide`
- `/v1/ide/analyze` (Access and browser-proof protected)

On Route-backed hosts, `/health` and `/info` remain origin checks. Originless hosts use `/__idol/health` for edge liveness.

## legacy host deployment

`deploy/` contains the prior systemd installer and registry seeding tools. They remain useful for the Tunnel origin, but public edge deployment is owned by `.github/workflows/deploy.yml`, `wrangler.jsonc`, `worker/`, `scripts/build.mjs`, and the generated production configuration.
