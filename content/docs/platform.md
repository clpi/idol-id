# The idol.id platform

One edge deployment, one design system and one authority projection serve ten public host surfaces.

| face | where | what |
|---|---|---|
| Site | idol.id | landing, installation and project status |
| Explorer | graph.idol.id · r8a · r8b · r16 | editor, token exploration, graph, lowering, run and facts |
| Registry | lib.idol.id | homes, packages, published worlds, versions and provenance |
| World Atlas | worlds.idol.id | public world facts, foreign-origin candidates, integration obligations and exact refusal |
| Platform | platform.idol.id | read-only capability frontier for accounts, IDE, repositories, transformations and shell programs |
| Docs | docs.idol.id | language law and references |
| API | api.idol.id | transport projection of compiler, registry and public world operations |

## Routing and origins

The existing root/docs/lib/api/graph/r8 hosts are Cloudflare Worker Routes over proxied Tunnel origins. Static assets are served at the edge; dynamic requests continue to the existing compiler or registry service.

`worlds.idol.id` and `platform.idol.id` are Worker Custom Domains. They are static Worker-origin surfaces and have no same-host dynamic origin. Generic dynamic paths there fail closed instead of recursively fetching the Worker.

Explicit public `/v1/world/*` operations are implemented in the Worker and consume immutable build projections. They do not depend on the Tunnel origin.

Every push to `idol-id/main` tests and builds all surfaces, refreshes the public world snapshot, validates the authority-pinned foreign projection, validates Wrangler configuration and deploys one immutable Worker version.

## World Atlas

`worlds.idol.id` consumes two immutable deployment projections:

```text
/runtime/worlds.json   public registry facts
/runtime/foreign.json  provenance-qualified foreign candidates and integration records
```

The published-world projection preserves exact manifest facts:

```text
world display name
release version
publisher
published graph identity
source hash
provenance
published tags
source extent
mirror and publication time
```

The labels `provided`, `published` and `foreign` are presentation qualifications. They do not create world kinds or establish semantic compatibility, equivalence, composition, injection or authority. The UI states when those authoritative facts are not published.

Comparison compares transport and published manifest fields only. A compiler-backed semantic compatibility view is a later program and must not be inferred from field equality.

## Foreign-origin candidates

A foreign-origin candidate is an ordinary product record qualified by provenance. It is not a `ForeignWorld` semantic kind and it is not an admitted Idol world.

The first public projection includes candidates for:

```text
C17
Wasm / WASI
browser web platform
Python
Rust
Go
```

Every candidate intentionally publishes:

```text
semantic_id = null
identity_status = not-published
origin/version provenance
uncertainty
facts required before admission
selected target projection records
ABI / ownership / failure / threading / effect / world obligations
required evidence
exact refusal
```

A display slug such as `c17` is URL provenance only. It is never presented as semantic identity.

## Integration projections

The Atlas integration lens shows each selected physical boundary and all facts still required for it:

```text
target projection
artifact state
ABI obligations
ownership and lifetime obligations
failure/trap/exception mapping
threading/runtime obligations
effects and required worlds
evidence status and required evidence
exact refusal code and detail
```

An integration is `available` only when a content-addressed artifact and verified evidence are both published. Initial Program J projections are all `not-admitted`; they have no artifact and therefore expose no copy/install command.

The page does not infer correspondence from headers, symbols, schemas, package names, URLs, tags or documentation. It cannot manufacture an equivalence witness or world grant.

## Import planning

The public import-plan operation accepts these provenance inputs:

```text
repository
schema
API description
binary artifact
```

Endpoint:

```text
POST /v1/world/import-plan
```

The result is a deterministic `idol.web.import.plan.v1` document containing:

```text
stages
required grants
missing facts
refusal conditions
authority-boundary statement
```

The operation is strictly **plan-only**:

```text
executed = false
semantic_id = null
identity_status = not-published
```

It performs no repository checkout, source/archive upload, network probe, schema dereference, API request, binary inspection, process execution, transformation, generated-code production, candidate-world publication or repository mutation.

The approved future import pipeline remains:

```text
ingest provenance
→ detect/extract candidate facts
→ preserve uncertainty
→ identify missing laws and opaque behavior
→ run probes only under explicit grants
→ request human confirmation
→ prepare a private candidate world
→ publish only after review and evidence
```

## Public world transport

```text
GET  /v1/world/foreign
GET  /v1/world/:slug/integration
POST /v1/world/import-plan
```

These endpoints are available on both the Worlds and API hosts. They serve the same authority-pinned immutable projection. Unknown candidates, malformed requests, unsupported input kinds and oversized bodies fail explicitly.

## Platform frontier

`platform.idol.id` currently exposes the implementation frontier and links to capabilities that are genuinely live.

Not yet enabled:

```text
account sign-in
API-token creation
provider/repository connections
private workspaces
browser-IDE writes
repository import or mutation
foreign probing or binary execution
remote shell execution
world/universe management writes
```

Those capabilities require separate identity, policy, secret, world-grant, sandbox, transactional transformation and evidence programs. The public frontier does not simulate them.

## Existing dynamic compiler and registry API

```text
GET  /health                     origin liveness + compiler presence
GET  /info                       origin service + authority edition
GET  /__idol/health              edge liveness
GET  /__idol/version             deployed edge version and surface
POST /api/analyze   {source}     graph + explain + check in one pass
POST /api/fmt       {source}     formatter
POST /api/lower     {source, target, emit, opt}   realization text
POST /api/run       {source, args}                native execution
GET  /api/libs                   indexed homes
GET  /api/worlds                 public registry worlds
GET  /api/lib/:name/detail       source + graph + explain + stats
GET  /api/lib/:name/dependents   reverse references
GET  /api/lib/:name/versions     sealed snapshots
POST /api/publish   {name, version, source}       write token required
GET  /api/whys?subject=X         provenance facts
GET  /api/authority              source-law authority edition
```

Targets for `/api/lower`: `native`, `aarch64-linux`, `aarch64-macos`, `wasm32-wasi`; emits: `asm`, `c`, `wasm`.

## Authentication boundary

Current registry reads and public world projections are open. Existing publication uses an out-of-band bearer write token at the Tunnel origin. The future authenticated platform will replace this provisional surface with scoped identities, passkeys/device login, organizations, audit and explicit policy. No public page reads or executes secret files.

## Instances and provenance

The same graph application serves `graph`, `r8a`, `r8b` and `r16`; the surface label is deployment and hardware provenance, not semantic authority. Likewise, a hostname, foreign slug, provider coordinate, path, URL, version or hash selects a product record but never establishes world, relation, package or value identity.
