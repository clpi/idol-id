# The idol.id platform

One edge deployment, one design system and one authority projection serve ten host surfaces.

| face | where | what |
|---|---|---|
| Site | idol.id | landing, installation and project status |
| Explorer | graph.idol.id · r8a · r8b · r16 | editor, token exploration, graph, lowering, run and facts |
| Registry | lib.idol.id | homes, packages, published worlds, versions and provenance |
| World Atlas | worlds.idol.id | public world facts, foreign-origin candidates, integration obligations and exact refusal |
| Platform | platform.idol.id | verified account profile, scoped API tokens, audit, and the local-first browser IDE at `/ide` |
| Docs | docs.idol.id | language law and references |
| API | api.idol.id | compiler, registry, public world, and bearer-token transport |

## Routing and origins

The existing root/docs/lib/api/graph/r8 hosts are Cloudflare Worker Routes over proxied Tunnel origins. Static assets are served at the edge; dynamic compiler and registry requests continue to existing services.

`worlds.idol.id` and `platform.idol.id` are Worker Custom Domains. Generic unknown dynamic paths fail closed instead of recursively fetching the Worker.

Explicit `/v1/world/*`, `/v1/platform/*`, and `/v1/ide/*` operations are implemented in the Worker. Every push to `idol-id/main` tests all surfaces, refreshes public projections, provisions the Platform identity boundary, applies D1 migrations, validates Wrangler configuration, and deploys one immutable Worker version.

## World Atlas

`worlds.idol.id` consumes:

```text
/runtime/worlds.json   public registry facts
/runtime/foreign.json  provenance-qualified foreign candidates and integration records
```

The labels `provided`, `published` and `foreign` are presentation qualifications. They do not establish semantic compatibility, equivalence, composition, injection or authority.

The public foreign projection currently covers C17, Wasm/WASI, browser, Python, Rust and Go. Every candidate keeps `semantic_id = null`, publishes uncertainty and obligations, and refuses availability until a content-addressed artifact plus verified evidence exists.

Public world transport:

```text
GET  /v1/world/foreign
GET  /v1/world/:slug/integration
POST /v1/world/import-plan
```

The import-plan operation is deterministic and strictly plan-only. It performs no source fetch, repository checkout, schema dereference, API call, binary execution, transformation, semantic publication, world formation or mutation.

## Platform identity boundary

Program K introduces account and API transport without inventing a password database or treating identity as world authority.

### Browser identity

Cloudflare Access protects:

```text
platform.idol.id/v1/platform/browser/*
platform.idol.id/ide*
platform.idol.id/v1/ide/*
```

The initial provider is one-time PIN, admitted for the exact bootstrap owner. Access admission alone is not trusted by application code. The Worker verifies the Access JWT again:

```text
RS256 signature
issuer = https://<team>.cloudflareaccess.com
audience = exact Access application AUD
expiry and not-before
verified exact email
subject and email claims
```

Only after this verification does the Worker create or read a Platform profile or admit remote IDE analysis.

### Profile

A profile contains:

```text
verified Access subject
verified email
display name
created and updated times
```

The subject and email originate in verified Access claims. The editable display name is presentation only.

### API tokens

A user can create scoped personal API tokens from the Access-protected console.

Token format:

```text
idol_pat_<public-id>.<secret>
```

The plaintext token is returned exactly once. D1 stores only:

```text
token id
owner subject
human name
safe prefix
SHA-256 digest
allowlisted scopes
created / expiry / revocation / last-use times
```

Current scopes:

```text
profile:read
world:read
registry:read
analysis:read
```

Only `profile:read` is consumed by the first bearer endpoint. Reserved scopes grant nothing until an explicit producer consumes them.

A token cannot create another token. It does not grant filesystem, process, network, secret, device, repository, runner or world authority.

### Audit

The following events are appended:

```text
profile.created
profile.updated
token.created
token.used
token.revoked
ide.analysis.requested
```

Audit records retain actor email, owner subject, target, exact event type, bounded metadata, and time. Token plaintext, token digests, and IDE source text are not exposed through the UI or audit API.

## Platform API

Public:

```text
GET /v1/platform/status
```

Access-protected browser endpoints:

```text
GET   /v1/platform/browser/login
GET   /v1/platform/browser/session
GET   /v1/platform/browser/profile
PATCH /v1/platform/browser/profile
GET   /v1/platform/browser/tokens
POST  /v1/platform/browser/tokens
POST  /v1/platform/browser/tokens/:id/revoke
GET   /v1/platform/browser/audit
POST  /v1/ide/analyze
```

Bearer endpoint:

```text
GET /v1/platform/api/whoami
Authorization: Bearer idol_pat_...
```

Browser mutations and remote IDE analysis require:

```text
verified Access identity
Origin: https://platform.idol.id
X-Idol-Request: browser
application/json when a body is parsed
bounded request body
```

Missing Access configuration, missing D1, invalid JWTs, invalid origins, unsupported scopes, expired credentials and revoked credentials fail explicitly.

## Browser IDE

The browser IDE at `platform.idol.id/ide` is local-first. It is not a cloud workspace and does not silently upload a project.

### Local workspace

The workspace model is immutable and bounded:

```text
maximum 256 files
maximum 2 MiB per file
maximum 8 MiB serialized workspace snapshot
relative normalized paths only
no traversal, absolute paths, hidden parent fallback, or path-as-semantic-identity
```

Workspaces persist in IndexedDB when available. Storage refusal is visible and the editor can continue in memory. Users can create, rename, delete, import, and export files. A deep workspace URL selects only a local browser record; it does not identify a cloud project or semantic world.

### Authority states

The IDE visibly separates:

```text
lexical preview
browser Wasm
remote native
```

Lexical preview is immediate and keeps every non-whitespace token clickable. Its inspector says **semantic identity not published** unless the compiler has supplied an exact token projection. The browser lexer may color and segment source; it may not infer semantic binding from spelling or graph-neighborhood heuristics.

An admitted browser Wasm artifact is reported separately. Merely downloading a Wasm module does not prove that the IDE semantic entry points are present. Unsupported local operations remain explicit.

Remote analysis is explicit. Source remains local until the user presses **Analyze remotely**. That request sends only the selected file to the fixed compiler analysis endpoint through the Access-protected Worker. The Worker:

1. independently verifies the Access identity;
2. requires exact Platform-origin browser proof;
3. validates workspace identity, file identity, normalized path, JSON, body size, and source size;
4. calls `https://api.idol.id/api/analyze` exactly once;
5. bounds and validates the compiler response;
6. returns a `remote-native` semantic bundle;
7. records metadata-only audit evidence containing hashes and sizes, never source text.

### Semantic Observatory behavior

A remote bundle can publish:

```text
exact token spans and lexical identities
source faces and canonical identities
semantic, graph and application identities
inbound/outbound edges
provenance
representation and lowering facts
compiler graph nodes, edges and applications
output/realization text where published
```

Every token remains selectable even when no semantic identity exists. Compiler-published graph identities cross-link into the graph lens. Edge selections can traverse to adjacent nodes. Facts and output remain synchronized with the selected file and authority state.

### Responsive layout

Desktop:

```text
activity rail | files | source/graph/facts/output | semantic inspector
```

Tablet moves the inspector into a docked sheet. Phone uses a full-width workbench with file and inspector drawers plus bottom navigation. The 320px layout retains source, graph, facts, output and inspection access; controls remain touch-sized; no workflow depends on hover; reduced motion is honored.

Product prose and controls use sans-serif typography. Source, graph identities, hashes, versions, coordinates and lowering use Iosevka.

### Deliberate boundary

The IDE does not yet provide:

```text
provider-connected repositories
multi-user collaboration
cloud-synchronized workspaces
repository mutation or pull requests
native build/test/benchmark runners
transactional migrations
shell execution
private world publication
```

Those require provider secrets, organization policy, transactional derived worlds, native runners, evidence, and explicit capability grants.

## D1 storage

The production migration creates:

```text
platform_profile
platform_token
platform_audit
```

Foreign keys bind credentials and audit to a verified profile. Token digests are unique. Owner, active-token and audit-time indexes support bounded account queries.

## Cloudflare provisioning

The protected production workflow idempotently:

1. creates or reuses D1 database `idol-platform` in western North America;
2. creates or reuses the Zero Trust organization;
3. creates or reuses the one-time-PIN identity provider;
4. creates or reuses the Access application for account APIs, `/ide*`, and `/v1/ide/*`;
5. creates or verifies the exact bootstrap owner Allow policy;
6. generates the production Wrangler configuration with D1 and Access verification facts;
7. applies migrations;
8. deploys the same Worker version across all hosts and protected paths.

Generated configuration contains only non-secret IDs and verification values. The Cloudflare API token remains in protected CI secret storage.

## Platform UI

The public page remains readable without authentication. Its account console offers:

```text
Access sign-in and sign-out
profile view/edit
API-token creation
one-time plaintext reveal and copy
token list and revocation
audit trail
provisioning status
browser IDE entry
```

The console and IDE are responsive down to 320px, use touch-sized controls, keyboard navigation and reduced-motion support. Product prose uses sans-serif; exact identities, token prefixes, scopes, source and timestamps use Iosevka.

## Still not enabled

```text
organizations and teams
GitHub / GitLab / Bitbucket connections
provider credential storage
cloud-synchronized or collaborative workspaces
repository import or mutation
foreign probing or binary execution
build/test/benchmark runners
world/universe management writes
remote shell execution
```

Those remain separate programs with their own policy, secret, world-grant, sandbox, transformation and evidence requirements.

## Existing compiler and registry API

```text
GET  /health
GET  /info
GET  /__idol/health
GET  /__idol/version
POST /api/analyze
POST /api/fmt
POST /api/lower
POST /api/run
GET  /api/libs
GET  /api/worlds
GET  /api/lib/:name/detail
GET  /api/lib/:name/dependents
GET  /api/lib/:name/versions
POST /api/publish
GET  /api/whys
GET  /api/authority
```

The existing registry publication token remains provisional and separate from Program K tokens.

## Provenance rule

A hostname, Access subject, email, token ID, provider coordinate, workspace path, URL, version or hash can identify a transport or product record. None independently establishes Idol world, relation, package, value or application identity.
