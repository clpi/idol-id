# Semantic Instrument Design

## Status

Approved direction for the next Idol web-system convergence pass.

This design replaces the current visual treatment of `idol.id` with a system-wide visual and interaction language derived from Idol's own architecture: one semantic identity, many projections; minimal concepts; dense information; explicit authority; progressive revelation; and no presentation-layer invention of semantic facts.

It applies first to the root Studio and then becomes the shared visual law for Graph, Worlds/Lib, Registry, Docs, Platform, Live, Repository, API/MCP, and authenticated management surfaces. Hermes and OpenClaw remain operationally isolated and are not visually or architecturally folded into the public product unless later work explicitly defines a shared projection boundary.

## Objective

The site must feel like an instrument for navigating a semantic universe rather than a collection of SaaS dashboards.

The target experience is:

- more minimal than the current Studio;
- visually unmistakable without decorative excess;
- denser and faster to scan than conventional compiler explorers;
- more explorable than Godbolt because identity persists across source, graph, facts, demand, transforms, realization, machine representation, provenance, worlds, and evidence;
- more coherent than cloud consoles because management operations project over the same semantic model rather than creating unrelated resource taxonomies;
- honest about authority and unavailable evidence;
- usable from mobile through large desktop without reducing mobile to compressed desktop panels.

The UI should express the same convergence pressure as Idol itself: fewer permanent concepts, stronger semantic relationships, and representation chosen according to context.

## Core visual invariant

Every permanent UI element must communicate at least one of:

1. identity;
2. state;
3. action;
4. hierarchy;
5. provenance/authority.

If it communicates none of these, remove it.

The visual system may not add decorative boxes, labels, dividers, badges, gradients, or colors merely to make the interface appear designed.

## Information architecture

### One workspace, not a page directory

The root opens directly into the semantic workspace. Marketing copy is not a persistent first-class layer.

Persistent shell:

- `IDOL` identity;
- current semantic path / authority context;
- compact projection control;
- global command access;
- authentication/account context only where required.

Everything else is contextual.

The current semantic selection is the stable axis of the interface. The user changes projections around the selection instead of navigating to disconnected pages that reproduce the same entity.

### Canonical projections

The workspace recognizes these projection families:

- Source
- Graph
- Facts
- Demand
- Transform
- Realization
- Machine
- Provenance / Evidence
- Worlds / Universe
- Registry / Distribution
- Operations / Live

They are not required to appear simultaneously. The projection system must favor progressive disclosure and preserve selection when switching projections.

### Route compatibility

Existing public route contracts remain valid where they carry product meaning. Routes may become deep links into a common workspace rather than separate visual applications.

Compatibility aliases must not manufacture a second ontology. For example, a Worlds alias that resolves to a library/world projection remains a projection entrypoint, not a separate source of identity.

## Visual language

### Base field

Default dark surface:

- near-black background, not pure black where tonal separation is needed;
- warm or neutral off-white primary text;
- low-contrast neutral secondary text;
- structural separation primarily through spacing, alignment, typography, and subtle tonal planes rather than borders.

A light mode may exist later, but the first convergence pass should optimize and fully admit the dark instrument rather than splitting effort across two incomplete themes.

### Color algebra

Color is semantic state, not decoration.

#### Gold: canonical authority / current locus

Idol gold marks:

- canonical or explicitly pinned authority;
- the current semantic locus;
- the active authoritative projection or selection anchor.

Gold must not be used as a generic button color or repeated across every interactive element.

#### Identity hue: semantic continuity

A selected semantic identity receives a restrained identity hue when color materially improves cross-projection tracking. The same hue follows that identity through source highlight, graph node, facts, transform lineage, realization, and provenance views.

Identity hues are assigned deterministically from stable semantic IDs. They do not encode type categories by themselves and must remain legible with color-blindness constraints.

#### Derived hue: transformation

Derived/transformed artifacts may shift toward a related cool hue while retaining a visible relation to the originating identity. The UI must visually distinguish "same identity in another projection" from "new artifact derived from this identity."

#### Green: realized/live

Green is reserved for evidence that something is actually realized, running, admitted, or successfully materialized. It is not a generic success accent.

#### Red: law/refusal/error

Red is reserved for:

- violated law;
- refused operation;
- unavailable required evidence when the action cannot proceed;
- execution or admission failure.

It is never decorative and never used for ordinary warnings that do not block meaning or action.

#### Neutral gray

Neutral gray handles inactive chrome, auxiliary metadata, secondary provenance, and non-selected structural context.

### Color constraints

- No rainbow graph taxonomy.
- No permanent multicolor navigation.
- No decorative gradients.
- No color without a semantic explanation.
- Every color-coded distinction must also have a non-color cue.
- The palette must satisfy WCAG contrast requirements for interactive and textual states.

## Typography

Use typography to separate semantic levels rather than making every surface look like terminal output.

- Sans-serif: shell, navigation, explanatory text, human-facing labels, controls.
- Monospace: source, semantic IDs, facts, values, machine representations, exact provenance coordinates, compiler diagnostics.

Monospace must not leak into general navigation merely to signal "developer tool."

Hierarchy should rely on scale, weight, spacing, and density. All-caps micro-labels are permitted only where they act as compact metadata, not as a substitute for clear layout.

## Spatial system

### Remove panel chrome

The current bordered-dashboard composition is not canonical.

Replace most bordered cards/panels with:

- continuous workspace regions;
- subtle background plane changes;
- alignment lines only where they communicate shared coordinates;
- transient separators when resizing or comparing projections.

Rounded rectangles are reserved for actual controls, transient overlays, or bounded artifacts where containment is semantically meaningful.

### Desktop

Desktop prioritizes simultaneous comparison when it creates leverage.

Default Studio composition:

- compact top shell;
- primary source/graph workspace occupying nearly all remaining viewport;
- contextual projection rail or compact switcher;
- inspectable details revealed on selection without permanently shrinking the primary workspace;
- optional split comparison for source ↔ graph, graph ↔ transform, or source ↔ machine.

The large hero headline is removed from the persistent working state. If onboarding copy appears for a first visit, it must collapse into the workspace immediately and never reserve recurring vertical space.

### Mobile

Mobile is a single semantic viewport, not stacked desktop panels.

Requirements:

- one primary projection visible at a time;
- persistent current semantic path/selection;
- bottom or thumb-reachable projection control;
- horizontal gesture/explicit controls for adjacent projections where appropriate;
- contextual inspector as sheet/overlay, not a permanent side panel;
- all primary touch targets at least 44 CSS px;
- no horizontal document overflow;
- no essential information accessible only through hover.

Selection must persist while moving Source → Graph → Facts → Transform → Realization.

### Tablet

Tablet may use a temporary two-projection split when width permits, but must degrade to the mobile single-viewport model before controls become compressed or clipped.

## Interaction model

### Selection is global

The currently selected semantic entity is a first-class workspace state. Every projection receives the same selection context and either:

- renders the corresponding representation;
- renders an explicitly related derived artifact;
- or truthfully states that no compiler-published representation exists.

The frontend may not fabricate semantic correspondences.

### Projection switching

Projection switching should feel like rotating one object rather than opening another app.

Required behaviors:

- preserve semantic selection;
- preserve authority/provenance context;
- preserve relevant zoom/position where meaningful;
- animate only enough to communicate continuity;
- respect `prefers-reduced-motion`;
- permit keyboard navigation and command-palette access.

### Progressive disclosure

Permanent chrome is minimized. Secondary operations appear through:

- command palette;
- contextual action menus;
- inspector sheets;
- keyboard shortcuts;
- direct manipulation where discoverable.

Important capabilities must remain discoverable without memorizing shortcuts. Minimal does not mean hidden.

### Graph interaction

Graph exploration is a primary product capability, not a decorative visualization.

Minimum interaction contract:

- pan/zoom without fighting browser scrolling;
- select exact compiler-published nodes/relations;
- jump to exact source span;
- inspect identity, role, facts, demand, transforms, realization, and provenance;
- expand neighborhood according to published graph relations;
- filter projection without mutating semantic identity;
- compare two representations or derivation states;
- share/deep-link a semantic locus using stable IDs where available.

Operation words remain relations/identities according to compiler law; the visualization must not invent edge kinds from surface vocabulary.

## Authority and evidence

The UI must make authority visible without overwhelming the workspace.

Every rendered semantic artifact must be traceable to at least one of:

- compiler-published semantic graph evidence;
- source authority coordinates;
- registry provenance;
- explicitly identified foreign origin;
- live realization evidence.

When evidence is absent:

- show an explicit unavailable/refused state;
- explain the missing evidence briefly;
- offer valid next actions where possible;
- do not synthesize plausible-looking graph content.

Staleness is a release-blocking defect. Public surfaces must not show superseded names, concepts, syntax, authority claims, or cached explanatory content that conflicts with current canonical sources.

## Component architecture

The visual system should converge into a small set of semantic primitives rather than page-specific components.

### `InstrumentShell`

Owns:

- brand identity;
- semantic breadcrumb/path;
- projection switching;
- command entry;
- responsive shell behavior.

Does not own page-specific data semantics.

### `SemanticSelection`

Shared state contract containing stable semantic identity, source authority coordinates, selected projection, and available published evidence references.

All projection views consume this contract instead of inventing local selection state.

### `ProjectionView`

Common contract for source, graph, facts, demand, transforms, realization, machine, provenance, worlds, registry, and live projections.

Each projection declares:

- what evidence it requires;
- how it renders absence/refusal;
- which actions it exposes;
- how it maps the shared selection without changing identity.

### `SemanticInspector`

Contextual detail surface for the current selection. Responsive implementation differs by viewport, but information architecture remains one component contract.

### `AuthorityMark`

Small, reusable authority/provenance indicator. It uses the gold authority semantics and provides exact details on demand rather than repeating verbose authority prose throughout the interface.

### `SemanticState`

Central token/state mapping for authority, identity continuity, derived artifacts, realized state, refusal/error, and neutral context. Individual pages may not introduce ad-hoc semantic colors.

### `CommandSurface`

One command vocabulary shared across routes. Navigation, projection changes, search, graph actions, world operations, and evidence actions should converge here where appropriate.

## Worlds and management UX

World management should inherit the same workspace grammar rather than becoming a conventional cloud dashboard.

A World is explored as a semantic/provenance object with projections for:

- identity/origin;
- composition;
- dependencies/relations;
- authority boundaries;
- foreign candidates;
- realizations/deployments;
- revisions/history;
- evidence;
- permitted mutations.

CRUD should be expressed as graph/world operations with previewable consequences where possible. Mutation flows should show what semantic/provenance relationships will change before commit.

Long-term management ambitions may exceed the first visual pass, but the component and route architecture must not force a future return to resource-card dashboards.

## Registry UX

Registry/package data is a provenance and distribution projection, not semantic authority.

The registry must visually distinguish:

- published record;
- source/home provenance;
- version/artifact coordinates;
- world membership/projection;
- semantic identities from compiler evidence.

Package coordinates may navigate to semantic content, but must never visually imply they are the semantic identity itself.

## Docs UX

Documentation should use the same semantic navigation model where canonical IDs/evidence exist.

Examples and explanations may link directly into live source/graph/projection loci. Docs remain explanatory content; they do not become a second semantic authority.

## Live and operations UX

Live surfaces retain operational evidence and authenticated boundaries.

The visual system should map operational states onto the same color algebra:

- gold for authoritative current context;
- green only for admitted/realized live state;
- red for failed/refused operations;
- identity hues for semantic continuity where live artifacts correspond to graph identities.

Operational records remain evidence, not language law.

## Motion

Motion communicates projection and continuity only.

Allowed:

- restrained projection transitions;
- graph expansion/collapse;
- selection continuity;
- inspector reveal;
- realization/transform lineage transitions.

Disallowed:

- ambient decorative motion;
- looping gradients;
- parallax unrelated to semantic structure;
- animations that delay access to information.

Default durations should be short. All nonessential motion must disable under `prefers-reduced-motion`.

## Accessibility

Release admission requires:

- keyboard access to all primary workspace actions;
- visible focus state that follows the color algebra without relying on color alone;
- screen-reader names for graph controls and projection switches;
- semantic alternatives for graph-only information;
- WCAG AA text/control contrast at minimum;
- color-blind-safe identity tracking;
- reduced-motion support;
- mobile touch targets >= 44 CSS px;
- no hover-only required actions.

## Performance

The visual reset must not trade semantic density for frontend cost.

Targets:

- shell and initial source projection usable immediately after critical data arrives;
- graph rendering virtualized/canvas/SVG strategy chosen according to measured node scale, not visual fashion;
- no full-workspace re-render when only selection changes where avoidable;
- projection modules lazy-loaded where they are not part of initial interaction;
- animation implemented with transform/opacity where possible;
- avoid heavy UI frameworks or visualization dependencies unless measurement demonstrates net benefit;
- no visual effect whose runtime cost is disproportionate to semantic value.

## Responsive admission

The existing real-Chrome viewport gate remains mandatory and is expanded to verify the Semantic Instrument invariants.

Required viewport set:

- 320 × 568
- 390 × 844
- 430 × 932
- 768 × 1024
- 1440 × 900

Assertions:

- no horizontal document overflow;
- no clipped persistent controls;
- mobile touch targets >= 44 px;
- projection switching preserves selection;
- command surface opens/closes and is keyboard accessible;
- authority context remains visible or one action away;
- refused compiler analysis does not create graph nodes;
- semantic colors appear only in valid states;
- no stale/legacy public identity or vocabulary;
- no browser exceptions;
- screenshots generated for visual review.

Additional desktop admission should exercise split projection comparison and graph/source synchronized selection.

## Staleness and legacy gate

The deployment gate must scan public assets/content for known retired project identities and explicitly retired vocabulary. The exact denylist remains data-driven and must be updated from current authority rather than hard-coded forever into page components.

A stale public term is treated as a production defect even when the page otherwise works.

## Migration sequence

### Phase 1 — tokens and shell

- establish semantic color/token system;
- simplify typography and spacing;
- replace current shell with `InstrumentShell`;
- remove permanent hero and excess labels;
- preserve all admitted route contracts.

### Phase 2 — Studio convergence

- source and graph become primary continuous workspace;
- shared `SemanticSelection` introduced;
- projection switcher/rail added;
- facts/demand/transform/realization/machine become contextual projections;
- desktop split comparison and mobile single-viewport behavior implemented.

### Phase 3 — Graph depth

- exact node/source synchronization;
- neighborhood exploration;
- provenance/authority inspection;
- derivation/realization lineage;
- deep links to stable semantic loci.

### Phase 4 — Worlds/Registry/Platform convergence

- replace dashboard/card taxonomies with semantic projection patterns;
- unify world operations, registry provenance, and management history around shared selection/provenance components;
- retain authentication and mutation safety boundaries.

### Phase 5 — Docs/Live/API/MCP visual convergence

- adopt shell/tokens/component contracts;
- maintain their distinct authority roles;
- remove duplicate navigation and page-local vocabularies.

Hermes/OpenClaw remain outside these phases unless explicitly scoped later.

## Testing strategy

### Unit/component tests

Test:

- semantic color/state mapping;
- projection availability/refusal;
- selection persistence;
- route-to-projection mapping;
- responsive state transitions;
- authority marks and provenance disclosure.

### Browser tests

Test real interactions at admitted viewports:

- source selection → graph projection;
- graph selection → exact source span;
- selection preserved through projection changes;
- refusal does not fabricate evidence;
- command palette projection navigation;
- world/registry deep-link continuity;
- mobile inspector and projection navigation;
- keyboard-only core flow.

### Visual regression

Keep canonical screenshots for at least:

- desktop source/graph workspace;
- desktop selected identity across projections;
- mobile source projection;
- mobile graph projection;
- refused evidence state;
- world management projection.

Visual review checks hierarchy, density, semantic color discipline, clipping, accidental card proliferation, and stale terminology.

## Non-goals for the first implementation pass

- redesigning Hermes or OpenClaw;
- inventing frontend semantic inference to fill compiler gaps;
- adding a second light theme before dark-mode convergence is admitted;
- reproducing every long-term cloud-management feature immediately;
- replacing working backend/authentication infrastructure merely for aesthetic consistency;
- adding decorative 3D/WebGL effects without semantic leverage;
- creating new product nouns where existing semantic projections suffice.

## Acceptance criteria

The redesign is accepted when:

1. The root no longer reads visually as a collection of bordered compiler panels or a marketing page.
2. The current semantic selection is visibly continuous across projections.
3. Gold, identity hues, green, red, and neutral states obey the defined semantic color algebra.
4. The persistent shell contains only identity, authority/path, projections, command access, and required account context.
5. Mobile behaves as a native single-projection semantic instrument with persistent selection.
6. Graph/source navigation is bidirectional where compiler-published coordinates exist.
7. Missing evidence produces explicit refusal/absence rather than invented content.
8. Existing admitted route/authentication contracts continue to work.
9. Public surfaces contain no stale Idol predecessor identities or retired canonical terminology covered by the current authority denylist.
10. All unit, browser, responsive, accessibility, deployment, and staleness gates pass on the exact deployable commit.

## Design principle in one sentence

**Idol's UI should make one semantic identity feel continuously explorable through many representations, while every pixel earns its existence by communicating identity, state, action, hierarchy, or authority.**
