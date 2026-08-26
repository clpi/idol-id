# The idol.id platform

One edge deployment, one design system and one authority projection serve ten public host surfaces.

| face | where | what |
|---|---|---|
| Site | idol.id | landing, installation and project status |
| Explorer | graph.idol.id · r8a · r8b · r16 | editor, token exploration, graph, lowering, run and facts |
| Registry | lib.idol.id | homes, packages, published worlds, versions and provenance |
| World Atlas | worlds.idol.id | searchable public world identities, exact manifest facts and comparison |
| Platform | platform.idol.id | read-only capability frontier for accounts, IDE, repositories, transformations and shell programs |
| Docs | docs.idol.id | language law and references |
| API | api.idol.id | transport projection of compiler and registry operations |

## Routing and origins

The existing root/docs/lib/api/graph/r8 hosts are Cloudflare Worker Routes over proxied Tunnel origins. Static assets are served at the edge; dynamic requests continue to the existing compiler or registry service.

`worlds.idol.id` and `platform.idol.id` are Worker Custom Domains. They are static Worker-origin surfaces and have no same-host dynamic origin. Dynamic paths there fail closed instead of recursively fetching the Worker.

Every push to `idol-id/main` tests and builds all surfaces, refreshes the public world snapshot, validates Wrangler configuration and deploys one immutable Worker version.

## World Atlas

`worlds.idol.id` consumes `/runtime/worlds.json`, an immutable deployment snapshot refreshed from the public registry projection.

The Atlas preserves exact manifest facts:

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

Comparison currently compares exact published manifest fields. A compiler-backed semantic compatibility view is a later program and must not be inferred from manifest equality.

## Platform frontier

`platform.idol.id` currently exposes the implementation frontier and links to capabilities that are genuinely live.

Not yet enabled:

```text
account sign-in
API-token creation
provider/repository connections
private workspaces
browser-IDE writes
repository mutation
remote shell execution
world/universe management writes
```

Those capabilities require separate identity, policy, secret, world-grant, transactional transformation and evidence programs. The public frontier does not simulate them.

## Dynamic API surface

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

Current registry reads are open. Existing publication uses an out-of-band bearer write token at the Tunnel origin. The future authenticated platform will replace this provisional surface with scoped identities, passkeys/device login, organizations, audit and explicit policy. No public page reads or executes secret files.

## Instances and provenance

The same graph application serves `graph`, `r8a`, `r8b` and `r16`; the surface label is deployment and hardware provenance, not semantic authority. Likewise, a hostname selects a product face but never establishes world, relation, package or value identity.
