# Idol Worlds Atlas and Authenticated Platform

**Status:** requested design expansion; review gate before implementation planning  
**Date:** 2026-08-25  
**Repository:** `clpi/idol-id`  
**Amends:** `2026-08-25-semantic-observatory-registry-distribution-design.md`  
**Language authority:** `clpi/idol`  
**Native realization/evidence authority:** `clpi/idol-native`

## 1. Purpose

This addendum adds two first-class public product surfaces to the approved Semantic Observatory, native registry, and distribution design:

- `worlds.idol.id` — the public atlas of provided Idol worlds, published worlds, foreign-origin worlds, world projections, injection witnesses, integration recipes, and world/universe graph exploration;
- `platform.idol.id` — the authenticated workbench for accounts, API access, repository connections, browser IDE workflows, project scaffolding, foreign-project integration, repo-to-Idol migration, metaprogramming, world formation, universe views, evidence, and a capability-explicit web shell.

Both surfaces use the same semantic selection, graph, projection, world, provenance, and lowering machinery as `graph.idol.id`, `lib.idol.id`, and the browser IDE. They do not create a second compiler, resolver, world model, package system, shell ontology, or transformation language.

The deployment authority expands from the current root plus seven subdomain faces to:

```text
idol.id
api.idol.id
docs.idol.id
graph.idol.id
lib.idol.id
worlds.idol.id
platform.idol.id
r8a.idol.id
r8b.idol.id
r16.idol.id
```

Every push to `idol-id/main` continues to build, test, and deploy one immutable web version across all ten host surfaces.

## 2. Authority and terminology constraints

### 2.1 `worlds` is a hostname, not a plural semantic kind

The language has the semantic concept `world`. `worlds.idol.id` is a product/catalog hostname. It must not cause program identities such as `WorldCatalog`, `ForeignWorld`, `WorldManager`, or a second world registry to become semantic authority.

### 2.2 `platform` is a product surface, not a language concept

`platform.idol.id` is the authenticated product/control surface. It must not mint a semantic `platform`, `manager`, `orchestrator`, `workspace context`, or other responsibility-bag object. Operational records exist physically, but all program meaning remains in ordinary Idol facts and applications.

### 2.3 One semantic universe

Idol retains one semantic universe. A user-facing “universe” in the product is a saved, named operational view over worlds, relations, projects, policies, and evidence. It may realize as a derived world or a graph query/view. It does not establish an independent universe ontology or competing semantic law.

The UI may call these **universe views**. Their canonical content is:

```text
selected world identities
reachability and injection facts
policy/grant facts
project/package/repository provenance
saved graph query and visualization state
optional derived-world assumptions
```

### 2.4 Foreignness is qualification

A foreign-origin world is an ordinary world carrying origin, lawset, version, uncertainty, boundary, capability, and provenance facts. `foreign` is not a new world kind. Imported facts do not become equivalent to Idol facts without an explicit correspondence or equivalence witness.

### 2.5 Existing world law remains absolute

The product preserves the current distinctions:

```text
home != world
home != subject
path != identity
package provenance != authority
value != place
binding != place
world witness != relation/protocol witness
```

`@` is the current world. Injection does not mutate its source world and cannot manufacture authority. Product UI, repo conversion, generated adapters, shell sessions, and account policies must never weaken these rules.

## 3. Product map

### 3.1 Public surfaces

| Surface | Primary responsibility |
|---|---|
| `idol.id` | language/product landing and installation |
| `docs.idol.id` | law, references, tutorials, integration guides |
| `graph.idol.id` | source-centric semantic observatory |
| `lib.idol.id` | package/version/projection/artifact registry |
| `worlds.idol.id` | world atlas, composition, integration, and foreign boundaries |
| `api.idol.id` | transport projection of the same facts |
| `r8a`, `r8b`, `r16` | hardware/realization provenance views |

### 3.2 Authenticated surface

`platform.idol.id` provides:

- account and profile management;
- organization/team management;
- API token, OAuth application, service identity, audit, and usage management;
- GitHub, GitLab, Bitbucket, and generic Git repository connections;
- private projects, packages, worlds, evidence, and universe views;
- browser IDE and local-first workspaces;
- repo analysis, scaffolding, transformation, and migration workflows;
- world formation and publication workflows;
- generated foreign integration projections;
- isolated build/test/benchmark/transformation execution;
- an Idol web shell operating under explicit world grants.

## 4. `worlds.idol.id`: World Atlas

### 4.1 World sources

The atlas displays several origin-qualified sets through one world model:

1. **Provided worlds** — worlds supplied with the canonical Idol distribution, such as source, build, test, benchmark, process, filesystem, environment, network, clock, random, browser, WASI, target, and hardware facts where admitted.
2. **Published worlds** — public worlds released through `lib.idol.id` or directly published as world projections.
3. **Package worlds** — package/version projection worlds, build worlds, documentation worlds, target worlds, and artifact worlds derived from registry facts.
4. **Foreign-origin worlds** — representations of external languages, runtimes, frameworks, ABIs, APIs, schemas, build systems, operating systems, repositories, and services.
5. **Private worlds** — visible only through the authenticated platform and organization policy.
6. **Derived worlds** — exact fact deltas, experiments, transformations, and optimizer/search incarnations whose parent and injection provenance are explicit.

All are ordinary worlds. Origin and visibility are facts.

### 4.2 World identity page

Canonical URL shape:

```text
/world/<stable-id-or-provenance-slug>
/world/<id>/graph
/world/<id>/fact
/world/<id>/relation
/world/<id>/projection
/world/<id>/inject
/world/<id>/integration
/world/<id>/version
/world/<id>/evidence
/world/<id>/security
/world/<id>/compare/<other-id>
```

The display slug is navigation provenance. The stable semantic identity is shown separately and used by APIs and deep links.

A world page exposes:

- identity, origin, version, law authority, and provenance;
- public facts and exact closed/open status;
- members, reachable homes, and relation/application availability;
- world requirements and granted capabilities;
- injection witnesses and refusal reasons;
- parent/derived-world lineage;
- target and representation projections;
- packages/projects using the world;
- native/Wasm/C/foreign integration artifacts;
- security and capability review;
- source, graph, documentation, and evidence downloads;
- interactive examples in the Semantic Observatory.

### 4.3 Atlas search

Search supports:

- human name and summary;
- stable world identity;
- relation, descriptor, protocol requirement, effect, capability, target, ABI, and origin;
- provider package/project;
- source or foreign ecosystem;
- public/private/organization visibility;
- evidence, version, and compatibility status;
- worlds admitting or refusing a selected application;
- worlds satisfying a selected dependency or projection requirement.

Search results explain why each world matched. String relevance is presentation; semantic matches are grounded in published identities and facts.

### 4.4 World graph lenses

World pages reuse the Observatory selection bus and add deterministic lenses:

- **Boundary** — what is inside, outside, imported, exported, witnessed, uncertain, or refused;
- **Authority** — world requirements, grants, effects, and capability flow;
- **Injection** — source world, fact delta, witness, resulting derived world, and non-mutation proof;
- **Projection** — one semantic identity across source, native, Wasm, C ABI, JS, Python, Rust, Go, JVM, .NET, schema, and documentation projections where available;
- **Reach** — home/member reachability without conflating reach with authority;
- **Lineage** — parent, version, derived world, transformation, and evidence history;
- **Integration** — external projects, build systems, package managers, and generated boundary artifacts.

### 4.5 Compose and compare

Users can select two or more worlds and ask:

- which facts agree;
- which facts conflict;
- which requirements remain unsatisfied;
- which injection is unique and witnessed;
- which capabilities would be granted or widened;
- which relations become available;
- which target projections remain lawful;
- whether a derived world can be formed without hidden parent fallback.

The result is an inspectable witness or an exact refusal. The UI does not implement a free-form merge that silently combines authorities.

### 4.6 Integration recipes

Every world may publish generated, versioned recipes for consuming Idol from foreign projects and consuming foreign systems from Idol.

Examples of physical projections, when admitted:

```text
C ABI header + library + ownership/effect contract
Wasm/WASI module + interface/world requirements
browser Wasm + JavaScript host projection
Python extension/wheel or FFI projection
Rust crate/bindings projection
Go module/cgo or Wasm projection
JVM/JNI or Wasm projection
.NET/native or Wasm projection
CMake/Meson/Bazel/Make integration
npm/pnpm/yarn wrapper package
Cargo/build.rs-free integration where possible
pip/uv integration
Gradle/Maven integration
container/OCI projection
OpenAPI/JSON Schema/Protobuf/GraphQL schema projection
```

A recipe always shows:

- semantic world identity and version;
- foreign origin/target and version bounds;
- selected projection and artifact hash;
- ABI, ownership, failure, threading, effect, and world obligations;
- generated code provenance;
- required build/test commands;
- exact round-trip or equivalence evidence;
- unsupported or uncertain facts.

“Copy integration” never means “copy an unversioned opaque snippet.” The copied command pins or records a resolvable identity.

### 4.7 Importing a foreign world

A foreign-world import workflow accepts:

- repository connection;
- source/archive upload;
- package coordinate;
- API/schema/documentation URL;
- binary/library artifact;
- compiler/runtime descriptor;
- build/test/benchmark logs and evidence.

Import stages:

```text
ingest provenance
→ detect languages/build systems/targets
→ extract foreign declarations and boundary facts
→ produce candidate world facts with confidence/uncertainty
→ identify missing laws and opaque behavior
→ run probes/tests where granted
→ request human confirmation for unresolved authority
→ publish private candidate world
→ optionally publish a reviewed public world
```

The importer must fail closed when a fact cannot be established. It may publish uncertainty and an exact missing witness; it may not hallucinate equivalence.

### 4.8 Mobile world experience

On phones:

- world search and filters use a compact command sheet;
- the world identity summary remains visible while scrolling;
- graph, facts, inject, project, integrate, versions, and evidence are bottom-navigation destinations;
- world composition uses a persistent comparison tray;
- graph interaction supports pinch zoom, tap-to-inspect, and an accessible list/tree alternative;
- integration commands have one-tap copy and explicit version/artifact disclosure;
- no workflow depends on hover.

## 5. `platform.idol.id`: Authenticated Workbench

### 5.1 Account and profile

The platform manages:

- public profile and verified identities;
- organizations, teams, roles, and policies;
- connected Git providers and repositories;
- package/world ownership and publishing rights;
- API tokens and service identities;
- passkeys, recovery, sessions, and security events;
- private projects, packages, worlds, universe views, runs, and evidence;
- notification preferences and webhooks;
- usage and quota visibility where applicable.

Profiles link to authored packages, worlds, contributions, evidence, advisories, and public semantic activity without exposing private repositories or grants.

### 5.2 API access management

Users and organizations can create scoped API credentials for:

```text
read public semantic facts
read selected private project/package/world
analyze source/repository
run admitted transforms
run build/test/benchmark in selected worlds
publish package/world
manage selected package/world owners
manage provider connections
manage webhooks
```

Each credential has:

- name and stable identity;
- owner and organization;
- exact scopes and resource bounds;
- optional world/capability ceiling;
- expiration;
- last-used time and coarse origin metadata;
- rate/usage records;
- immediate revocation;
- append-only audit events.

API tokens are not world authority by themselves. They authorize the platform to request operations; each run still requires the relevant world grants and policy witness.

### 5.3 Provider connections

Initial integrations:

- GitHub App/OAuth;
- GitLab OAuth/application;
- Bitbucket OAuth;
- generic Git over HTTPS/SSH through a user-controlled credential;
- local folder/archive import;
- optional cloud storage and CI providers in later programs.

Provider tokens are stored in a dedicated secret facility, encrypted and resource-scoped. They are never returned to browser JavaScript, written into repository files, or copied into world bundles.

Repository permissions are least-privilege and separately grant:

- read source/metadata;
- read checks/builds;
- create branches/commits;
- open pull/merge requests;
- comment/status checks;
- manage webhooks.

The default transformation workflow creates a branch and proposed PR/MR. It does not push directly to a protected default branch.

### 5.4 Project/workspace model

Operational records include:

```text
account/organization
provider connection
repository revision
project workspace
source snapshot
candidate world
transformation run
evidence bundle
published package/world
saved universe view
shell session
runner allocation
```

These are storage/workflow records. They do not become new Idol semantic kinds. Repository revision, path, branch, and provider remain provenance.

### 5.5 Browser IDE

The browser IDE is local-first and progressively powered by admitted Idol Wasm artifacts.

Client capabilities:

- file tree, search, multi-file editor, diagnostics, format, references, rename, graph, facts, lowering, and semantic diff;
- exact clickable token behavior shared with the Observatory;
- OPFS/IndexedDB local workspace cache;
- import local files/directories without uploading by default;
- source control diff and staged transformation preview;
- native/Wasm/C/foreign projection preview;
- build/test/benchmark evidence panes;
- terminal/shell surface under explicit world grants;
- collaboration/presence only after core single-user authority is correct.

Idol-Wasm responsibilities, as admitted:

```text
lexical and grammar projection
format/canonicalize
resolve/check
semantic graph publication
exact token binding
source transformation
foreign projection generation
selected target lowering
package/world validation
resolver queries
```

Operations unavailable in the browser fail explicitly or route to an admitted remote native runner. The UI never implies the browser performed a native check when it only ran a lexical preview.

### 5.6 Responsive IDE

Desktop:

```text
activity rail | files/source | graph/lowering/output | semantic rail
terminal/evidence drawer
```

Tablet:

```text
files/source | active semantic surface
inspector and terminal as dockable sheets
```

Phone:

```text
source · graph · facts · lower · terminal bottom navigation
file/repo picker drawer
semantic inspector bottom sheet
command accessory above software keyboard
```

Mobile requirements:

- deliberate touch editing and selection;
- no tiny desktop tree controls;
- 44 px minimum targets;
- full-screen graph/terminal modes;
- pinch zoom and accessible graph list;
- hardware-keyboard shortcuts where present;
- safe-area and browser-chrome handling;
- resumable local workspace state;
- no mandatory large download before simple source viewing.

## 6. Arbitrary repository workflows

### 6.1 Principle

“Convert any arbitrary repo to Idol” is a goal-directed workflow with exact coverage and refusal, not a promise of blind whole-repository translation.

The platform supports progressive adoption:

```text
observe
→ scaffold
→ integrate
→ project
→ transform
→ migrate
→ publish world/package
```

A repository can gain Idol leverage before every source file is Idol.

### 6.2 Observe

The platform analyzes a selected revision and publishes:

- language/build/test/benchmark/toolchain inventory;
- source and dependency topology;
- foreign world candidates;
- ABI/API/schema boundaries;
- build/test/bench commands and environment assumptions;
- generated-code and metaprogramming surfaces;
- effects, process/network/filesystem/device requirements;
- migration blockers, unsupported constructs, and uncertainty;
- initial semantic/provenance graph.

No repository path or filename becomes semantic identity after ingress.

### 6.3 Scaffold Idol into an existing project

The scaffold workflow can propose a PR adding only the selected capabilities:

- Idol project/package descriptor projection;
- `idol` build entry;
- Idol-driven test harness;
- Idol-driven benchmark harness with verified outcomes before timing;
- generated foreign bindings;
- CI setup and cache;
- package/world lock and authority pins;
- semantic graph/evidence export;
- developer setup and copyable installer reference;
- no-op or sample Idol component when requested.

The user previews every file and semantic effect before the PR is opened.

### 6.4 Add projection/injection algebra to a foreign project

This workflow does not attempt to add Idol syntax to another language. It adds an Idol semantic control surface around existing foreign code:

- describe the foreign project as world facts;
- define/import boundary identities;
- generate lawful projections and wrappers;
- make required capabilities/worlds explicit;
- map build/test/benchmark results into Idol evidence;
- expose foreign APIs as qualified relations/descriptors where witnessed;
- allow Idol-generated code to enter through explicit projections;
- allow foreign callers to consume Idol through target-specific artifacts;
- maintain exact provenance back to foreign source and generated code.

### 6.5 Add functionality through metaprogramming

The user describes a desired semantic change and selects allowed scopes/worlds. The platform can:

- query the repository/world graph;
- run compile-time Idol generators;
- create source/graph transformations;
- generate adapters, tests, benchmarks, schemas, documentation, migrations, and configuration;
- specialize behavior per target/world;
- preview semantic diff and generated provenance;
- validate outcomes under existing and generated tests;
- open a branch/PR with evidence.

Generated code carries transformation identity, input/output correspondence, generator authority, world grants, and exact source provenance. A generator cannot read secrets, network, filesystem regions, or processes unless granted.

### 6.6 Migrate code to Idol

Migration is incremental and evidence-gated:

1. select a boundary, package, component, file set, relation, or dependency slice;
2. construct the foreign semantic/world facts available for that slice;
3. identify behavior oracle and equivalence requirements;
4. generate or author candidate Idol source;
5. compare canonical graph facts where correspondence is known;
6. build both versions;
7. run differential tests and selected benchmarks;
8. preserve foreign fallback until equivalence is established;
9. propose a PR with exact supported/unsupported coverage;
10. delete the foreign owner only when production authority has transferred.

The platform reports partial conversion honestly. A translated file count is not self-hosting or authority transfer.

### 6.7 Convert a repository/project into a world

The conversion produces a candidate world projection containing:

- stable imported identities where correspondence is established;
- reachable homes and package/repository provenance;
- public relations/descriptors/protocol requirements;
- build/test/benchmark/process/environment facts;
- target/ABI/artifact facts;
- capability requirements and grants;
- uncertainty and opaque boundaries;
- source/graph/evidence references;
- version and parent/derived-world lineage.

The candidate is private by default. Publishing requires review, immutable versioning, capability disclosure, and evidence. Converting to a world does not grant authority and does not make every imported fact canonical Idol law.

### 6.8 Transformation transaction

Every platform transformation runs in a derived world or equivalent transactional graph incarnation:

```text
canonical repository/world facts
→ derived candidate world
→ inject proposed assumptions/changes
→ build/test/measure under candidate
→ produce semantic diff and evidence
→ user review
→ commit as branch/PR or discard
```

Discard leaves the canonical project/world untouched. Commit publishes a witnessed transformation and provenance; it is never a silent destructive rewrite.

## 7. Universe views

### 7.1 Purpose

A universe view lets a user or organization organize and reason over multiple worlds/projects/packages without creating another semantic universe.

Examples:

- all worlds used by one repository revision;
- production versus test worlds;
- browser/WASI/native target constellation;
- organization-approved capability worlds;
- foreign ecosystems participating in a migration;
- optimizer or agent candidate derived worlds;
- security/advisory impact across packages and worlds.

### 7.2 Operations

Users can:

- create, rename, share, archive, clone, and version a universe view;
- add/remove world references and graph queries;
- define visibility and organization policy;
- compare two views;
- run reachability/capability/conflict analysis;
- inspect dependency, projection, injection, and transformation paths;
- save dashboards and evidence filters;
- derive a candidate world from selected facts where lawful;
- publish a read-only public view without publishing private world contents.

### 7.3 Visual representation

Universe view lenses:

- world constellation;
- dependency/projection graph;
- authority/capability graph;
- target/representation matrix;
- transformation timeline;
- package/security impact;
- repository ownership and provenance.

Large views use clustering, viewport culling, semantic filtering, and accessible list/tree alternatives.

## 8. Idol web shell

### 8.1 One language surface

The default web shell is canonical Idol source evaluated under an explicit shell/process world. It is not a second shell language.

Examples are conceptual and remain subject to upstream syntax authority:

```text
command:run()
source:read():parse(json)
process:status()
stdout:write(text)
```

Environment, filesystem, process, network, clock, secrets, repository, and runner access are visible world facts and grants.

### 8.2 Familiar shell ingress

The product may optionally accept POSIX-shell or PowerShell-compatible command ingress for convenience. That text is compatibility provenance and normalizes immediately into the same Idol process/application graph. It may not establish an independent pipeline, redirection, environment, status, or process semantics.

The UI always offers “show canonical Idol” for a compatibility command.

### 8.3 Shell projection algebra

The shell exposes:

- process applications;
- input/output/error packs or streams;
- explicit environment projection;
- filesystem places where observable;
- pipeline/dataflow edges;
- exit/outcome/evidence distinction;
- world/capability requirements;
- remote/local/runner target realization;
- generated script provenance;
- command-to-semantic-graph inspection.

Pipes and redirections are graph/dataflow projections, not opaque strings. A process exit status is not the run outcome or evidence payload.

### 8.4 Safety

- no network, secret, write, device, or provider access by default;
- grants are scoped per command/session/project and visibly summarized;
- destructive operations require review/confirmation and policy;
- shell sessions run in isolated ephemeral environments unless explicitly local;
- secrets are injected by reference and never printed by default;
- every command records source, canonical graph, grants, outcome, evidence, and artifact provenance;
- timeouts, resource limits, and cancellation are mandatory;
- mobile terminal provides command history and grant review without hiding capability changes.

## 9. Agent and automation workflows

The platform can expose the same semantic API to human users and agents:

- inspect exact source/graph/world/package facts;
- propose derived-world transformations;
- request narrowly scoped grants;
- run build/test/benchmark/evidence workflows;
- generate integration projections;
- open PRs/MRs;
- explain every selected/rejected transformation or resolution;
- attach signed action receipts/evidence where supported.

Agents do not receive raw text-only authority when stable semantic IDs and graph queries exist. They cannot bypass human/org policy or manufacture world grants.

Automation templates include:

- convert one component to Idol;
- add Idol build/test/bench scaffolding;
- generate C/Wasm/JS/Python/Rust/Go boundary projection;
- convert repository to private world;
- update package/world projection after upstream changes;
- inspect semantic compatibility before dependency update;
- add generated functionality through an approved metaprogram;
- optimize under derived worlds and commit only a cheaper lawful realization.

## 10. Storage and execution architecture

### 10.1 Browser/local

- OPFS/IndexedDB for local workspaces, caches, and source snapshots;
- admitted Idol Wasm for local semantic operations;
- Web Workers for expensive local graph/layout operations;
- no provider credential or long-lived secret in browser storage;
- explicit upload/sync boundaries.

### 10.2 Cloudflare edge

- Worker routes `worlds.idol.id` and `platform.idol.id` alongside existing hosts;
- static applications and immutable public world metadata via Static Assets/cache;
- D1 for accounts, organizations, connections metadata, project/workspace records, world indexes, universe views, tokens metadata, audit indexes, and run metadata;
- R2 for immutable repo snapshots, world bundles, generated artifacts, logs, docs, evidence, and package envelopes;
- Durable Objects or equivalent per-workspace/per-publication coordination;
- Queues/Workflows for imports, analysis, builds, transformations, indexing, and provider webhooks;
- dedicated secret storage for provider/OAuth credentials;
- rate limits and abuse controls per account/token/resource.

### 10.3 Native runners

Isolated Idol-native runners perform operations not admitted in browser/edge Wasm:

- repository ingestion and checkout;
- native compiler/build/test/benchmark;
- foreign toolchain invocation;
- generated binding/artifact production;
- differential migration checks;
- sandboxed metaprogram/generator execution;
- world/evidence publication;
- large semantic analysis.

Each run receives an exact source revision, toolchain authority, world grants, resource limits, and output contract. Runners are replaceable physical realizations, not semantic authorities.

## 11. APIs

Representative public world endpoints:

```text
GET  /v1/world
GET  /v1/world/:id
GET  /v1/world/:id/graph
GET  /v1/world/:id/fact
GET  /v1/world/:id/projection
GET  /v1/world/:id/integration
GET  /v1/world/:id/evidence
GET  /v1/world/:id/compare/:other
POST /v1/world/compose
POST /v1/world/import
```

Representative authenticated platform endpoints:

```text
GET/PUT  /v1/profile
GET/POST /v1/organization
GET/POST /v1/token
GET/POST /v1/connection
GET/POST /v1/project
GET/POST /v1/workspace
POST     /v1/repository/analyze
POST     /v1/repository/scaffold
POST     /v1/repository/project
POST     /v1/repository/transform
POST     /v1/repository/migrate
POST     /v1/repository/world
GET/POST /v1/universe
POST     /v1/shell/session
POST     /v1/shell/evaluate
GET      /v1/run/:id
GET      /v1/evidence/:id
```

Names are HTTP transport routes, not language identities. The underlying request/response facts are versioned and use stable semantic IDs.

## 12. Navigation and UI integration

The global product navigation becomes:

```text
graph · lib · worlds · docs · api · platform
```

Account/profile controls appear only where signed in. Public surfaces remain fully usable without authentication.

Shared Semantic Observatory behavior applies to:

- world facts and integration examples;
- repository source and generated diffs;
- package docs/source;
- shell commands;
- build/test/benchmark output with provenance;
- generated foreign projections;
- universe view graphs.

Every exact ID, edge, world, application, projection, artifact, version, repository revision, and transformation is cross-linkable. Text spelling alone never becomes the join key after semantic facts exist.

## 13. Testing and evidence

### 13.1 World Atlas

- provided/published/foreign/private/derived origin facts remain distinct;
- world identity is not path/name/hash identity;
- injection cannot mutate source world or manufacture authority;
- compose returns witness or exact refusal;
- foreign uncertainty is preserved;
- every integration artifact is pinned and provenance-linked;
- mobile graph/search/compare/integration flows;
- world deep links restore selection and lens;
- public/private visibility boundaries.

### 13.2 Platform/auth/connections

- passkey/OAuth/device login;
- scoped API token creation, use, expiration, and revocation;
- provider least-privilege permissions;
- provider secrets never reach browser/source/world bundles;
- organization policies and resource visibility;
- audit log completeness;
- direct-default-branch write is absent by default;
- branch/PR/MR creation and retry/idempotency.

### 13.3 IDE and repository workflows

- local-only file import does not upload without consent;
- exact token/graph facts replace lexical preview after analysis;
- browser-Wasm versus native-runner capability labeling;
- scaffold diff is previewed and reversible;
- repo transform runs transactionally in a derived world;
- discard leaves canonical revision untouched;
- migration reports partial coverage/refusal;
- generated code provenance survives PR creation;
- build/test/benchmark outcomes are separated from completion/evidence;
- mobile editor/graph/terminal workflows.

### 13.4 Shell

- no implicit network/write/secret/device grant;
- compatibility shell normalizes to canonical process graph;
- grant changes are visible and confirmed;
- cancellation/timeouts/resource limits;
- stdout/stderr/result/outcome/evidence remain distinct;
- source/graph/outcome/evidence audit record;
- secrets are redacted and referenced, not echoed.

### 13.5 Performance

Publish reproducible measurements for:

- browser IDE startup and first semantic analysis;
- incremental token/graph update;
- repository import and graph publication;
- world search/compose/compare;
- large world/universe graph interaction on mobile;
- browser-Wasm versus remote analysis latency;
- shell startup and command graph publication;
- transformation throughput and artifact size.

No “convert any repo,” “faster than X,” or “fully local” claim is made beyond measured admitted coverage.

## 14. Implementation decomposition

This addendum extends Programs A–H from the base design with independently gated programs.

### Program I — World Atlas read path

- add `worlds.idol.id` host and application;
- migrate existing public world read APIs into a stable versioned projection;
- world search, identity pages, facts, graph, lineage, compare, and integration views;
- mobile World Atlas shell;
- no auth or mutation required initially.

### Program J — Foreign world and integration projections

- foreign-origin fact model and uncertainty;
- import pipeline for repository/schema/API/binary sources;
- C/Wasm/browser and selected ecosystem integration artifacts;
- projection/injection witnesses and refusal;
- exact provenance and evidence.

### Program K — Platform identity and API access

- add `platform.idol.id` host/application;
- account/profile/org/team/passkey/OAuth foundation;
- scoped API token and audit UI;
- provider connection secret boundary;
- public/private resource policy.

### Program L — Browser IDE and local workspace

- responsive IDE shell;
- OPFS/local import;
- exact Semantic Observatory selection;
- admitted Idol-Wasm semantic services;
- explicit remote-runner fallback;
- mobile editor/graph/lowering/terminal.

### Program M — Repository observation and scaffolding

- GitHub/GitLab/Bitbucket/generic Git ingestion;
- repository inventory and candidate foreign world;
- scaffold build/test/benchmark/CI/graph/authority files;
- generated branch/PR/MR with semantic diff;
- no broad automatic translation yet.

### Program N — Projection, metaprogramming, and migration

- foreign boundary generation;
- repository graph queries and metaprogram execution;
- transactional derived-world transformations;
- incremental code migration and differential evidence;
- project-to-world publication.

### Program O — Universe views and collaboration

- saved world constellations/queries/policies;
- compare/reach/capability/security analysis;
- organization sharing and public read-only views;
- no second semantic-universe ontology.

### Program P — Web shell world

- canonical Idol shell world;
- compatibility command ingress normalized to the same graph;
- explicit grant UI and isolated runners;
- process/dataflow/evidence inspector;
- mobile terminal.

### Program Q — Native/Wasm and agent convergence

- move world import, projection, transformation, and shell semantic operations into shared Idol native/Wasm cores;
- expose stable semantic APIs to browser, CLI, and agents;
- retain platform host code only for infrastructure integration;
- deletion-gate every temporary JS/Python semantic bridge.

Recommended order:

```text
A responsive shell
→ I public World Atlas
→ K identity/API access
→ L browser IDE/local workspace
→ M repository observe/scaffold
→ J foreign integration projections
→ N transactional transformation/migration
→ O universe views
→ P shell world
→ Q semantic core convergence throughout
```

The first implementation plan after approval should cover only **Program I plus the minimal shared navigation/deployment changes**, not all programs at once.

## 15. Acceptance criteria added by this addendum

1. `worlds.idol.id` is deployed from the same immutable `main` build as every other surface.
2. Provided, published, foreign-origin, private, and derived worlds are distinguishable by facts without separate semantic world kinds.
3. World pages expose exact identity, facts, requirements, injections, projections, lineage, integration artifacts, provenance, and evidence.
4. World composition produces a witness or exact refusal and cannot silently widen authority.
5. Foreign integrations are versioned, content-addressed, and explicit about ABI/effect/world/ownership obligations and uncertainty.
6. `platform.idol.id` provides account/profile/org, API token, audit, provider connection, private resource, and project/workspace management.
7. Provider credentials never reach browser code, repository source, or published world/package bundles.
8. The browser IDE uses exact compiler facts and clearly separates lexical preview, browser-Wasm capability, and remote native evidence.
9. Arbitrary repositories can be observed and scaffolded without requiring whole-repository conversion.
10. Transformations execute transactionally in derived worlds and are proposed through reviewable branches/PRs/MRs by default.
11. Projection/injection integration and generated metaprogram changes retain exact provenance and world grants.
12. Repository-to-world conversion preserves uncertainty and does not manufacture authority.
13. Universe views manage world constellations and policy/query state without creating competing semantic universes.
14. The web shell uses canonical Idol world/process algebra, and compatibility shell text is ingress provenance only.
15. No shell operation receives implicit network, write, secret, provider, device, or process authority.
16. All critical worlds/platform workflows are usable at 320 px width, by touch, by keyboard, and with reduced motion.
17. Every token, graph edge, world fact, projection, generated artifact, transformation, and lowering/evidence reference remains cross-linkable through stable identities.
18. Claims of conversion coverage, local execution, compatibility, or performance are evidence-backed and exact about refusals.

## 16. Explicit non-goals

- A second semantic universe per user or project.
- A `ForeignWorld` class or foreign-only semantic ontology.
- A generic “platform manager” that owns language facts.
- Blind conversion of unsupported repositories while hiding gaps.
- Direct mutation of protected default branches by default.
- Treating repository path, provider ID, commit hash, package name, or URL as semantic identity.
- Implicit package/build/shell lifecycle scripts or hidden authority grants.
- A second shell language or opaque string pipeline model.
- Browser UI claims that exceed the admitted Idol-Wasm artifact.
- Agents bypassing user/org policy, evidence, or world grants.

## 17. Design decision summary

The expanded product follows one end-to-end chain:

```text
foreign or Idol source/repository/service
→ provenance-qualified world and semantic facts
→ exact projection/injection/requirement graph
→ derived-world candidate transformations
→ build/test/benchmark evidence
→ reviewed commit/package/world publication
→ target-specific native/Wasm/foreign realization
```

`worlds.idol.id` makes the world and boundary algebra publicly inspectable and reusable. `platform.idol.id` makes the same algebra operational for authenticated projects, accounts, repositories, agents, and shell sessions. Neither surface becomes a new semantic authority.