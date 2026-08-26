# Idol Semantic Observatory, Native Registry, and Distribution

**Status:** approved direction; implementation design for review  
**Date:** 2026-08-25  
**Repository:** `clpi/idol-id`  
**Baseline:** `fb6dbdf5978f3809460963a3166a2c474c20a8d7`  
**Language authority:** `clpi/idol`  
**Native realization/evidence authority:** `clpi/idol-native`

## 1. Purpose

`idol-id` becomes the single public product surface for the Idol language and ecosystem:

- a semantic observatory in which every source token can be followed through canonical identity, graph applications, facts, transformations, representations, and target lowering;
- a responsive, modern, striking, understated interface that works as well on phones as on large workstations;
- an Idol-native package registry at `lib.idol.id` with the practical completeness of crates.io and npm, but built around semantic identity, projection algebra, explicit worlds, reproducibility, and safe installation;
- a copyable, cross-platform language installer and one dense CLI for toolchains, packages, builds, publishing, provenance, and updates;
- one automatically deployed web platform for `idol.id`, `docs`, `lib`, `api`, `graph`, `r8a`, `r8b`, and `r16`.

This design does not mint new Idol language syntax. Any example package descriptor spelling is illustrative; `clpi/idol` remains the sole source-language authority. The web platform consumes compiler-published facts and emits transport projections. It never becomes a second lexer, parser, type system, package semantics, or lowering ontology.

## 2. Current baseline and the problems being solved

The existing platform already has valuable foundations:

- one Cloudflare Worker deploys the root and all requested subdomains from `main`;
- the graph surface can analyze, lower, run, and inspect source;
- code spans are clickable and a graph renderer exists;
- `lib.idol.id` supports homes, published worlds, versions, uses, dependents, source, graph, and R2-backed artifacts;
- `shared/web.js` provides an exact-dependency browser bridge without a virtual DOM.

The remaining architectural problems are:

1. **UI typography is globally monospaced.** Code and semantic identifiers should use Iosevka, while navigation, prose, explanations, controls, and package documentation should use a high-quality sans-serif.
2. **Browser highlighting is heuristic.** `shared/idol.js` owns keyword/type sets and neighborhood inference. It may provide immediate pre-analysis color, but it must not present those guesses as semantic truth.
3. **Token-to-graph binding is approximate.** Line/column/name matching can silently bind the wrong occurrence. The compiler must publish exact source-span-to-semantic-identity facts.
4. **Selection is fragmented.** Token popovers, graph selection, references, facts, worlds, and lowering do not share one persistent identity and navigation history.
5. **The graph is primarily a force cloud.** It does not communicate application shape, dataflow, world boundaries, representation selection, or lowering lineage as clearly as the semantic graph permits.
6. **Lowering is detached output.** Source tokens and graph applications cannot yet highlight exact native, Wasm, or C ranges and transformations.
7. **The registry is a catalog, not a complete package ecosystem.** It lacks a resolver, lockfile contract, organization/user system, publish security, immutable release policy, advisories, semantic compatibility, artifact matrices, command-line installation, and build provenance.
8. **Installation is not language-grade.** There is no official copyable installer selecting, verifying, and atomically installing the correct Idol toolchain on macOS, Linux, Windows, and supported secondary targets.

## 3. Governing principles

### 3.1 Semantic authority

The compiler owns:

- lexical identity;
- source face and canonical identity;
- bindings and references;
- relations, subjects, applications, operand/result packs;
- descriptors, values, worlds, effects, demand, provenance;
- transformations and realization lineage;
- source and machine ranges.

The browser owns only presentation, interaction state, caching, and temporary lexical fallback before compiler facts arrive.

### 3.2 One selection identity

A user selection is not a DOM element or a string. It is a stable selection record that may contain:

```text
source span
lexical identity
canonical identity
graph node/value/application identities
relation/subject/pack roles
world/effect/demand facts
transformation identities
lowering ranges
package/version/projection provenance
```

All visual surfaces consume that same selection record.

### 3.3 No React-shaped runtime

The platform retains the existing exact-dependency approach:

- no component rerender tree;
- no virtual DOM;
- no general reconciliation loop;
- direct projection from observable semantic state to the affected DOM, canvas, or SVG region;
- progressively more computation moved into admitted Idol Wasm modules.

### 3.4 Mobile is a first-class product

Mobile is not a collapsed desktop page. Every workflow must have a deliberate phone interaction:

- source reading and editing;
- token inspection;
- graph navigation;
- lowering comparison;
- package search and version exploration;
- authentication and publishing review;
- installer copying and release verification.

### 3.5 Native registry safety

Package installation never runs arbitrary lifecycle scripts implicitly. A package that needs a build, generator, network, filesystem, process, device, or environment authority declares a world requirement. The user or build policy grants it explicitly. This removes the npm-style hidden post-install execution class rather than reproducing it.

## 4. Product architecture

The platform is divided into three coordinated subsystems.

### 4.1 Semantic Observatory

Shared across `graph`, `docs`, `lib`, `api`, `site`, `r8a`, `r8b`, and `r16`:

```text
compiler semantic bundle
        ↓
selection and identity store
        ↓
source | graph | facts | references | worlds | representation | lowering
```

### 4.2 Native Registry

```text
browser / CLI
    ↓
Cloudflare Worker edge API
    ↓
Idol-Wasm validation and resolution core
    ↓
D1 metadata + R2 immutable objects + publish coordinator
    ↓
Idol-native builders and analyzers
```

The Worker host shim remains minimal. Registry identity, dependency resolution, package validation, compatibility comparison, and projection selection are implemented in Idol and compiled to Wasm for edge reuse. Native build workers execute the same semantic rules as native Idol code.

### 4.3 Toolchain and package distribution

```text
/install or /install.ps1
    ↓ signed release manifest
platform selection + signature verification
    ↓
atomic user-local Idol installation
    ↓
idol toolchain / package / build / publish commands
```

There is one lifecycle CLI: `idol`. The bootstrap script only obtains the first verified binary. It does not establish a competing `idolup` command kingdom.

## 5. Visual and interaction design: Semantic Observatory

### 5.1 Typography

- **Code and exact machine information:** Iosevka, preferably a carefully subsetted variable web build with ligatures disabled by default in editable code and optional in read-only examples.
- **UI, prose, navigation, package summaries, documentation, buttons, dialogs, and inspector labels:** Inter variable or another open, neutral grotesk chosen once for the whole platform.
- **Numeric metrics:** tabular figures; monospace only where alignment communicates machine meaning.
- The default `body` family is sans-serif. Code surfaces opt into Iosevka.

### 5.2 Color and materials

The platform remains dark and restrained, but moves from pure black and flat panels toward graphite depth:

- graphite canvas and raised carbon surfaces;
- one-pixel boundaries and low-opacity overlays;
- no decorative glass blur;
- no generic neon gradient;
- semantic color is consistent across source, graph, inspector, and lowering.

Recommended semantic palette:

| Semantic role | Visual role |
|---|---|
| subject | muted gold |
| relation/application | warm ivory |
| projection | cool blue |
| world/effect | cyan |
| descriptor/shape | violet |
| value/result | muted green |
| refinement/control | rose |
| provenance/comment | slate |
| refusal/error | restrained red |

Color never carries meaning alone. Shape, label, stroke, and iconography provide redundant cues.

### 5.3 Responsive layouts

#### Desktop, ≥ 1180 px

```text
activity rail | source/editor | graph or lowering canvas | semantic rail
```

All panes are resizable and individually collapsible. The graph/lowering canvas can expand full-screen without losing the pinned semantic rail.

#### Tablet, 700–1179 px

```text
source or package list | visualization/detail
semantic rail as docked or overlay sheet
```

A two-pane layout is retained where practical. Tabs change the right pane between graph, lowering, facts, and package details.

#### Phone, < 700 px

```text
single primary surface
bottom navigation: source · graph · facts · lower · package
semantic inspector as draggable bottom sheet
```

Requirements:

- 44 px minimum interactive targets;
- no essential hover interaction;
- long source lines scroll horizontally without breaking layout;
- graph can enter full-screen with pinch zoom and a mini-map;
- token selection opens a compact bottom-sheet summary, then expands to full details;
- drawers respect safe areas and mobile browser chrome;
- keyboard workflows remain available when a hardware keyboard is present;
- layouts are tested at 320, 375, 390, 430, 768, 1024, 1440, and 1920 CSS pixels.

### 5.4 Dynamic but understated elements

Motion explains semantic change rather than decorating empty space:

- **semantic ribbon:** a horizontal or vertical trace from source → canonical identity → graph application → transformation → representation → target range;
- **edge loom:** selecting an application briefly draws its subject, operand, result, world, and demand edges in sequence;
- **projection lens:** switching target/world/projection smoothly morphs only the affected representation and lowering regions;
- **selection pulse:** one subtle traversal animation identifies the same entity across source, graph, and lowering;
- **live authority indicator:** reports exact deployed web, language, native, package, and runtime identities without a decorative spinner.

All motion stops after communicating the state transition and honors `prefers-reduced-motion`.

## 6. Exact token interaction

### 6.1 Every token is clickable

Every non-whitespace token receives an interaction record:

- identifiers;
- literals;
- operators and relation faces;
- delimiters;
- comments/provenance;
- compatibility spellings;
- errors and incomplete tokens.

Before analysis, the browser may show provisional lexical color and the label `local lexical preview`.

After analysis, the compiler projection replaces provisional information. A token with no semantic identity remains clickable and explicitly displays `semantic identity not published`. The UI never silently falls back from exact identity to string equality.

### 6.2 Compiler web projection

The server exposes a versioned transport projection, not a new semantic ontology:

```json
{
  "schema": "idol.web.semantic.v1",
  "source": { "hash": "…", "family": "…" },
  "tokens": [
    {
      "span": [0, 3],
      "lexical_identity": "…",
      "source_face": "…",
      "canonical_identity": "…",
      "graph_ids": ["…"],
      "application_ids": ["…"],
      "diagnostic_ids": [],
      "provenance": {}
    }
  ],
  "nodes": [],
  "edges": [],
  "applications": [],
  "transformations": [],
  "representations": [],
  "lowerings": []
}
```

IDs are serialized stable semantic IDs or occurrence IDs from the compiler. The web layer does not fabricate them.

### 6.3 Token inspector lenses

Clicking a token pins the semantic rail. The rail has these lenses:

1. **Canonical** — source face, canonical identity, graph identity, occurrence, descriptor/value, subject, relation, operand/result roles, world, demand, provenance.
2. **Edges** — every inbound and outbound edge with from/to identity, relation, qualification, role correspondence, origin, and witness.
3. **References** — exact binding references, declaration, uses, cross-package uses, dependents, and version history.
4. **Representation** — semantic value → descriptor/shape → selected representation → place/no-place → ABI/storage → target realization.
5. **Lowering** — source identity → application → transformation chain → DNIR/physical operation → machine/Wasm/C range.
6. **History** — semantic identity across package versions, including exact compatibility and transformation differences.

Every listed graph identity, application, edge endpoint, package, version, target range, and provenance origin is itself clickable.

## 7. Graph redesign

### 7.1 Deterministic lenses

The default graph is not an undifferentiated force layout. Users can switch among:

- **Application:** relation, subject, projection pack, operand pack, result pack.
- **Dataflow:** values, demand, production, consumption, refinement, recurrence.
- **World:** authorities, effects, provenance, crossings, grants, refusals.
- **Representation:** descriptor, shape, place/no-place, ABI, storage, target selection.
- **Package:** package/version/projection dependencies, exports, dependents, target artifacts.
- **Transformation:** source application through optimization and generated-code lineage.

### 7.2 Visual grammar

- application: open ring;
- relation: diamond;
- value: point;
- descriptor/shape: rounded lozenge;
- pack: bracketed group/hull;
- world: haloed boundary;
- transformation: split/merge glyph;
- package/version: nested capsule;
- target artifact: compact chip with target triple.

Edges have visible direction and role labels at appropriate zoom levels. Selecting an edge opens the same semantic inspector as selecting a source token.

### 7.3 Scale

- deterministic initial placement by scope, application, or package cluster;
- viewport culling;
- spatial index for hit testing;
- web worker or Idol-Wasm layout calculations for large graphs;
- force simulation only when explicitly selected and stopped after convergence;
- overview/minimap for graphs above the viewport threshold;
- 5,000-node graphs remain navigable on a contemporary phone without an unbounded O(n²) loop.

## 8. Lowering and cross-target comparison

The lowering workspace shows synchronized target columns:

```text
semantic trace | native | Wasm | C | selected target metadata
```

Selecting a token, edge, application, value, or transformation highlights exact corresponding ranges in every available target. Selecting a machine instruction or Wasm operation navigates back to the semantic origin.

The compiler projection must distinguish:

- exact range published;
- representation selected but no text range published;
- target refused;
- target unsupported;
- range unavailable because an earlier fact is not yet published.

The UI never guesses a machine mapping from source line order.

## 9. Command and navigation model

A global `⌘K` / `Ctrl+K` palette searches:

- source tokens and spans;
- graph identities and application occurrences;
- relations, descriptors, worlds, effects, demands;
- package names, versions, owners, exports, capabilities;
- target artifacts and build provenance;
- docs and law sections;
- commands and recent selections.

Keyboard defaults:

- `G` graph lens;
- `L` lowering lens;
- `R` references;
- `W` world lens;
- `P` package lens;
- `[` and `]` semantic history back/forward;
- Shift-click compares two selections;
- Escape unpins or closes the current layer.

Deep links preserve source/package/version, semantic selection, lens, target, and viewport without encoding authority in display spelling.

## 10. `lib.idol.id`: native package registry

### 10.1 Registry identity

A package release has distinct identities:

```text
package identity
owner/organization provenance
release/version identity
content hash
semantic graph hash
projection set
artifact set
attestation set
```

Human-readable names and URLs are provenance and navigation. They are not the sole identity.

Registry package coordinates use `owner/name` in URLs and CLI surfaces. They do not reuse `@scope`, because `@` already carries Idol world semantics.

Canonical pages:

```text
/pkg/owner/name
/pkg/owner/name/version
/pkg/owner/name/compare/from...to
/pkg/owner/name/graph
/pkg/owner/name/docs
/pkg/owner/name/versions
/pkg/owner/name/dependencies
/pkg/owner/name/dependents
/pkg/owner/name/builds
/pkg/owner/name/security
```

### 10.2 Package descriptor

The canonical package declaration is an Idol descriptor published by `clpi/idol`. The registry stores its normalized graph facts. JSON, HTTP, lockfiles, and UI records are projections.

The package descriptor covers:

- package identity and release version;
- exports and public semantic identities;
- dependency requirements;
- projection requirements and provided projections;
- target support;
- world/capability requirements;
- build and generation requirements;
- licenses, repository, documentation, authors, categories;
- deprecation and replacement facts;
- minimum compiler/law authority;
- artifact and provenance policy.

This design does not prescribe the final source spelling of that descriptor.

### 10.3 Projection algebra and resolution

The resolver operates over semantic requirements rather than only filenames and string feature flags.

A dependency may require:

```text
package identity
version constraint
exported relation/descriptor/protocol identity
world/capability bounds
target facts
representation/ABI facts
projection constraints
```

A package may publish multiple physical projections that preserve one semantic identity:

- source;
- canonical graph;
- browser Wasm;
- WASI Wasm;
- native target artifacts;
- C/foreign boundary projection;
- documentation/search projection.

Resolution produces an inspectable witness:

```text
requirement
→ candidate releases
→ rejected candidates and exact reasons
→ selected semantic release
→ selected target projection
→ artifact or source-build choice
```

The UI and `idol why` expose the same witness.

Additive feature-like projections are monotonic by default. Mutually exclusive alternatives are explicit descriptor constraints, not hidden string toggles. A resolver may not silently select two projections whose laws conflict.

### 10.4 Release immutability and lifecycle

- Published version contents are immutable.
- Versions may be **yanked** from new resolution while existing lockfiles remain reproducible.
- Versions may be **deprecated** with a reason and optional replacement.
- Mutable channels/tags such as `stable`, `beta`, and `latest` are audited pointers, never release identities.
- Ownership transfers, yanks, deprecations, token actions, and tag changes appear in an append-only audit timeline.
- Package deletion is limited to legal/security emergency quarantine; the transparency record remains.

### 10.5 Expected registry capabilities

The first complete registry includes the practical capabilities developers expect from npm/crates and more:

- fuzzy and exact search;
- semantic search by relation, descriptor, protocol, world, target, capability, license, category, and exported graph identity;
- organizations, teams, owners, maintainers, publishers, auditors;
- immutable versions, pre-releases, channels, yanking, deprecation;
- README and generated API documentation;
- dependency and reverse-dependency graphs;
- version comparison and semantic compatibility reports;
- download/use/build statistics with clear methodology;
- native/Wasm/browser artifact matrix;
- build status and reproducibility attestations;
- licenses, source repository, homepage, funding, categories, keywords;
- security advisories, affected semantic identities, patched releases;
- package tokens, webhooks, CLI publishing, audit logs;
- favorites/watchlists and release notifications;
- mirrors and offline caches;
- source, graph, provenance, package descriptor, docs, and artifacts downloadable separately or as one package envelope;
- executable examples in the observatory;
- cross-package token/reference navigation;
- impact analysis showing which downstream applications or projections a release can change.

### 10.6 Package page experience

A package page is an interactive workspace, not a README with a sidebar.

Desktop:

```text
package/version list | documentation/source | semantic rail
                         graph/lowering/build tabs
```

Mobile:

```text
package summary
versions / install / docs / graph / builds / security bottom nav
semantic details in bottom sheet
```

Top-level package actions:

- copy install/add command;
- open package in graph explorer;
- compare versions;
- inspect dependency resolution;
- inspect projections and target artifacts;
- view source/docs/build provenance;
- watch releases/advisories;
- manage ownership when authorized.

Every code token in README examples, generated docs, source, and diffs uses the same semantic inspector as `graph.idol.id`.

### 10.7 Semantic version comparison

Version comparison separates:

- source spelling changes;
- canonical semantic identity additions/removals;
- relation/application signature changes;
- descriptor/shape changes;
- world/effect/capability changes;
- representation/ABI changes;
- target support changes;
- performance evidence changes;
- documentation-only changes.

Compatibility labels are evidence-backed outputs from the compiler, not author-selected marketing tags.

## 11. Registry storage and services

### 11.1 Cloudflare edge

- Worker routes all registry/API traffic.
- Static UI and public immutable package metadata are edge cached.
- Idol-Wasm modules validate package metadata, evaluate resolver constraints, and service semantic queries.
- D1 stores normalized mutable metadata and audit indexes.
- R2 stores immutable package envelopes, source, graph bundles, docs, attestations, and target artifacts.
- A per-package coordination primitive serializes release publication and ownership mutations.
- Queues drive native builds, indexing, malware scanning, docs generation, and advisory analysis.

### 11.2 Native workers

Idol-native workers perform:

- source admission and graph publication;
- deterministic package envelope validation;
- target builds;
- test and example execution in declared worlds;
- semantic compatibility comparison;
- documentation and search projection generation;
- provenance/attestation generation;
- benchmark execution only under explicit evidence policy.

A JavaScript or Python host shim may remain temporarily for infrastructure integration, but it cannot own registry semantics. Its deletion condition is an admitted Idol native/Wasm boundary for the same operation.

### 11.3 Package envelope

The immutable `.idpkg` envelope contains or references:

```text
canonical package descriptor projection
source tree
semantic graph bundle
public export index
documentation projection
checksums
signatures and attestations
world/capability requirements
optional target artifacts
```

The envelope is deterministic and content-addressed. Compression and archive layout are physical choices and do not become semantic identity.

## 12. Authentication, organizations, and publishing security

### 12.1 Web authentication

- passkeys/WebAuthn as the preferred sign-in and publishing confirmation method;
- GitHub OIDC as a convenient verified identity/linking option;
- recovery codes and explicit account recovery policy;
- email used for notification/recovery, not as package identity;
- publishing-sensitive accounts require a second factor or passkey confirmation.

### 12.2 CLI authentication

`idol auth login` uses a browser/device-code flow. The CLI receives a revocable, scoped token. It never stores a web password.

Token scopes include:

```text
read packages
publish selected package or organization
manage owners
manage webhooks
read private packages
admin organization
```

Tokens have expiration, last-used metadata, explicit names, and immediate revocation.

### 12.3 Roles

Organizations and packages support:

- owner;
- maintainer;
- publisher;
- auditor;
- read-only member.

Critical package ownership changes require confirmation by more than one owner when organization policy enables it.

### 12.4 Supply-chain security

- release signatures and publisher identity;
- source repository and CI provenance attestations;
- transparency/audit log;
- content and graph hashes;
- reproducible-build comparisons;
- dependency advisory scanning;
- suspicious-name and takeover protections;
- package quarantine without erasing the historical record;
- explicit world/capability disclosure;
- no implicit install-time code execution;
- sandboxed and granted build/generator execution.

## 13. Cross-platform installation and toolchain lifecycle

### 13.1 Copyable installation

The website exposes copy controls for:

```sh
curl -fsSL https://idol.id/install | sh
```

```powershell
irm https://idol.id/install.ps1 | iex
```

The scripts are also downloadable for inspection, version-pinnable, and accompanied by checksums/signatures. CI documentation prefers pinned versions rather than an unpinned pipe-to-shell command.

### 13.2 Supported target matrix

Initial official binary targets:

- macOS arm64;
- macOS x86_64;
- Linux x86_64 glibc;
- Linux x86_64 musl;
- Linux arm64 glibc;
- Linux arm64 musl;
- Windows x86_64;
- Windows arm64 when the native compiler artifact is admitted;
- WASI/browser artifacts where appropriate.

Secondary packaging follows after the signed binary channel is stable:

- Homebrew;
- winget and/or Scoop;
- apt/rpm repositories;
- container image;
- GitHub Action/setup action;
- Nix flake/package.

All channels resolve to the same signed release manifest and artifact identities.

### 13.3 Installer behavior

The bootstrap installer:

1. detects OS, architecture, libc where relevant, and shell;
2. downloads the signed release manifest;
3. selects an exact target artifact;
4. verifies digest and Ed25519 signature using an embedded public key;
5. extracts into a temporary directory;
6. atomically installs to a user-local directory by default;
7. reports or performs a safe PATH update with explicit user control;
8. installs shell completion metadata;
9. verifies `idol authority` and `idol doctor` before reporting success;
10. emits exact uninstall and rollback instructions.

Default locations:

- Unix-like systems: `~/.idol/bin` and `~/.idol/toolchains`;
- Windows: `%LOCALAPPDATA%\Idol\bin` and `%LOCALAPPDATA%\Idol\toolchains`.

Root/admin privileges are not required for the default installation.

### 13.4 One lifecycle CLI

The installed `idol` command owns the lifecycle:

```text
idol self update
idol self uninstall
idol toolchain install stable|beta|nightly|<version>|<commit>
idol toolchain list
idol toolchain default <channel>
idol doctor

idol search <query>
idol info owner/name
idol add owner/name@<constraint>
idol remove owner/name
idol sync
idol graph owner/name
idol why owner/name
idol diff owner/name@a owner/name@b
idol audit
idol publish
idol yank
idol deprecate
idol owner ...
idol auth ...
```

The CLI prints the selected package/version/projection/artifact witness when requested, rather than hiding resolver decisions.

### 13.5 Project files and lockfile

- The package/project descriptor is authored as an Idol descriptor under upstream syntax authority.
- `idol.lock` is a generated deterministic projection containing exact package release identity, content/graph hashes, selected projection, target artifact/source-build choice, compiler authority, and provenance.
- The global cache is content-addressed and safe to share across projects.
- Offline installs resolve only from the lockfile and cache and fail clearly when an artifact is missing.

## 14. API design

The public API is versioned and serves the same semantic facts used by the UI and CLI.

Representative endpoints:

```text
GET  /v1/packages
GET  /v1/packages/:owner/:name
GET  /v1/packages/:owner/:name/versions
GET  /v1/packages/:owner/:name/:version
GET  /v1/packages/:owner/:name/:version/graph
GET  /v1/packages/:owner/:name/:version/artifacts
GET  /v1/packages/:owner/:name/:version/attestations
GET  /v1/packages/:owner/:name/compare/:from/:to
POST /v1/resolve
POST /v1/publish
POST /v1/packages/:owner/:name/:version/yank
POST /v1/auth/device
POST /v1/auth/token
GET  /v1/search
GET  /v1/advisories
```

HTTP JSON is a transport projection. Package and resolver semantics remain in the Idol core.

## 15. Performance and accessibility budgets

### 15.1 Web budgets

- initial shared JavaScript, excluding optional Wasm: ≤ 90 KiB compressed;
- initial shared CSS: ≤ 30 KiB compressed;
- no framework runtime or virtual DOM dependency;
- token selection to all linked surfaces: one animation frame for already loaded facts;
- mobile interaction readiness on a representative mid-range device: target ≤ 1.5 s on a warm CDN path;
- graph modules and lowering views lazy-load;
- package lists virtualize above the visible threshold;
- large artifacts stream and do not block initial page interaction.

These are acceptance targets, not claims about the current implementation.

### 15.2 Accessibility

- WCAG 2.2 AA contrast and keyboard reachability;
- semantic HTML and accessible names;
- full functionality without hover;
- reduced-motion mode;
- high-contrast mode;
- visible focus states;
- graph nodes/edges available as a navigable list/tree alternative;
- screen-reader description of selected application, edge, world, and lowering facts;
- text zoom to 200% without loss of functionality.

## 16. Testing and evidence

### 16.1 UI and semantic tests

- exact token-span binding;
- lexical fallback visibly marked and replaced after analysis;
- every token class clickable;
- token ↔ graph node ↔ edge ↔ inspector ↔ lowering synchronization;
- no name-based semantic fallback;
- semantic history and deep-link restoration;
- graph lenses and edge inspection;
- native/Wasm/C range cross-highlighting;
- mobile/touch bottom-sheet workflows;
- keyboard-only workflows;
- reduced motion and high contrast;
- all eight production host surfaces.

### 16.2 Registry tests

- immutable publish;
- version conflict/refusal;
- yanking and existing lockfile behavior;
- deprecation and replacement;
- organization roles and token scopes;
- device login and revocation;
- deterministic package envelope;
- content/graph hash validation;
- dependency resolution witness;
- projection conflict refusal;
- target artifact selection and source fallback;
- offline lockfile resolution;
- advisory propagation and affected-version calculation;
- no implicit lifecycle script execution;
- explicit world grants for builders/generators.

### 16.3 Installer tests

- each target triple in clean CI/VM images;
- signature failure and corrupt download refusal;
- atomic update and rollback;
- no-root install;
- PATH handling for supported shells;
- Windows path and PowerShell behavior;
- proxy, TLS, and offline archive behavior;
- install, update, doctor, and uninstall round-trip.

### 16.4 Performance evidence

The platform may compare itself with React, Preact, Solid, Svelte, npm, and crates.io only through published, reproducible harnesses. Required web cases include:

- cold payload and startup;
- first render;
- single-signal update;
- keyed list insertion/removal;
- graph selection and filter;
- package search and detail navigation;
- memory use;
- mobile CPU and battery-sensitive traces.

No architecture-only statement is promoted to a performance claim.

## 17. Rollout and implementation decomposition

The work is implemented as coordinated, independently reviewable programs.

### Program A — Design system and responsive shell

- body switches to sans-serif;
- Iosevka applies to code and machine facts only;
- responsive pane/drawer/bottom-sheet system;
- semantic color/shape tokens;
- command palette and selection history shell;
- mobile and accessibility baselines.

### Program B — Exact compiler semantic bundle

- upstream/compiler endpoint publishes exact token spans and semantic IDs;
- versioned web projection;
- no heuristic graph binding after analysis;
- source, graph, references, facts, and lowering share one selection store.

### Program C — Observatory graph and lowering

- deterministic lenses;
- edge inspection;
- semantic ribbon and transformation lineage;
- multi-target synchronized lowering;
- large-graph performance path.

### Program D — Registry data model and read experience

- package/version/projection/artifact identities;
- package pages, search, semantic filters, version diff, dependents, builds, docs, security;
- mobile registry workflows;
- migrate existing homes/worlds into the package model without losing provenance.

### Program E — Auth and publish pipeline

- passkeys/GitHub identity;
- organizations/roles;
- device CLI login and scoped tokens;
- immutable publish, yanking, deprecation, audit log;
- signatures, attestations, quarantine, advisory model.

### Program F — Resolver and package CLI

- Idol-native/Wasm resolver;
- package descriptor projection;
- deterministic lockfile;
- add/remove/sync/search/info/why/diff/audit/publish commands;
- projection and world-aware resolution.

### Program G — Cross-platform toolchain distribution

- signed release manifest;
- Unix and PowerShell installers;
- official target matrix;
- atomic update/rollback/uninstall;
- secondary package-manager channels;
- install page and copy controls.

### Program H — Native/Wasm convergence

- move registry validation, resolution, compatibility, and search semantics into Idol;
- compile the same core to Worker/browser Wasm and native build workers;
- retain only minimal platform host shims;
- track every temporary Python/JavaScript semantic bridge with an explicit deletion gate.

Each program receives its own implementation plan, tests, and merge gate. Programs A and D may begin with transport placeholders, but no placeholder may claim semantic authority.

## 18. Acceptance criteria

The design is complete when all of the following are true:

1. UI/prose uses sans-serif and all code/machine facts use Iosevka.
2. Every token is clickable on desktop and touch devices.
3. Post-analysis token binding is exact or explicitly absent; no name heuristic is presented as truth.
4. One selection highlights source, graph, edges, references, representations, transformations, and lowering ranges.
5. Graph edges and application roles are individually inspectable and deep-linkable.
6. The interface is fully usable at 320 px width and at large desktop sizes.
7. `lib.idol.id` provides immutable packages, versions, search, docs, dependencies/dependents, semantic diff, target artifacts, builds, provenance, advisories, owners/orgs, auth, tokens, webhooks, yanking, and deprecation.
8. Dependency resolution understands semantic identities, projections, worlds, targets, and exact provenance and emits a witness.
9. Package installation executes no implicit package code.
10. `idol` provides toolchain, package, auth, publish, audit, and self-update commands.
11. Unix and PowerShell copyable installers select and verify signed target artifacts and install without root/admin by default.
12. A push to `idol-id/main` continues to test/build/deploy the root and all seven subdomain faces from one authority.
13. Registry semantic operations run from admitted Idol native/Wasm code; remaining host bridges are explicit and deletion-gated.
14. Performance comparisons are reproducible measurements, not architectural assertions.

## 19. Explicit non-goals

- Replacing `clpi/idol` as language or grammar authority.
- Inventing a parallel package-language syntax in the web repository.
- Recreating React, npm lifecycle scripts, or cargo build scripts unchanged.
- Treating package names, source spellings, URLs, hashes alone, or UI node IDs as semantic identity.
- Claiming the web bridge or registry is faster than competitors before evidence exists.
- Shipping decorative complexity that does not improve semantic understanding or developer leverage.

## 20. Design decision summary

The platform converges on one idea:

```text
source/package spelling
→ canonical semantic identities and facts
→ selectable projections and worlds
→ exact graph, registry, and lowering evidence
→ target-specific realization
```

The interface makes that chain visible and actionable. The registry stores and resolves the same chain. The installer and CLI reproduce it on every supported platform. No subsystem is permitted to regain meaning from text after the compiler or registry already knows the semantic fact.
