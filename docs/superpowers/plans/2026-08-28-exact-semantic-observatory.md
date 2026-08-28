# Exact Semantic Observatory and product convergence plan

> Execution plan for the approved Semantic Observatory. `clpi/idol` remains the only language and semantic authority; `clpi/idol-id` may render exact compiler projections but may not reconstruct meaning from spelling, paths, adjacency, host enums, or UI records.

## Invariants

1. **Every visible non-whitespace source token is inspectable.** Before compiler analysis it is an exact lexical/provenance token with `semantic_id: null`. After analysis, only exact compiler-published spans may replace or qualify it.
2. **One graph, no browser graph ontology.** Canonical graph rendering uses only published graph nodes and edges. Application records, worlds, projections, derivations, transformations, witnesses, demand, and realization are separate inspectable projections; the browser never manufactures semantic edges.
3. **Structural edges, relation identities.** Edge labels are rendered exactly as published and identify their source field. Operation words are never promoted into browser-owned edge kinds. Reverse traversal is a derived index.
4. **No guessed definitions or references.** Definition/reference panels show only explicitly published definition/reference IDs. Otherwise the UI says `not published`; same-spelling occurrences remain visibly lexical-only.
5. **Identity precision.** IDs remain strings, including values larger than JavaScript's safe integer range. Missing, ambiguous, unpublished, unknown, empty, and false remain distinct.
6. **World and projection boundaries.** Home, world, subject, place, path, package provenance, semantic identity, and authority remain distinct. World, projection, derivation, and witness records are linked only through explicit IDs.
7. **Lib owns the public world-registry product.** A published Lib record is a projection of an admitted world; its package coordinate is provenance, not semantic identity or authority. Atlas and public Universe Views are Lib lenses. `worlds.idol.id` is a compatibility alias preserving path and query.
8. **Responsive by construction.** Desktop exposes source, graph, and semantic rail simultaneously. Phone exposes source, graph, and facts as full-width modes with safe-area navigation and 44-pixel controls. No horizontal product strip, fixed desktop pane, or hover-only action is admitted.
9. **Typography.** Iosevka is limited to source, exact identities, hashes, graph coordinates, lowering, and machine evidence. Product UI and explanatory prose use sans-serif.
10. **Evidence before claims.** The branch must pass authority checks, the complete Node suite, immutable build, Wrangler validation, post-merge all-host convergence, and rendered desktop/mobile interaction QA before completion is claimed.

## Program A — exact semantic bundle and indexes

- Extend `shared/semantic-bundle.js` to preserve exact token links for graph/application/world/projection/derivation/transformation/witness/demand/realization/definition/reference records.
- Preserve additional compiler-published graph collections without assigning semantic meaning to unknown collection names.
- Add `shared/semantic-index.js` with exact ID indexes, derived incoming/outgoing traversal, token occurrence indexes, and selection projections.
- Fail closed on overlapping spans, unsafe numeric identities, duplicate exact IDs, or malformed explicit references.

## Program B — deterministic graph observatory

- Add `shared/graph-model.js` with a deterministic layered layout and a canonical model built only from published nodes and edges.
- Replace force simulation and random seeds. Remove O(n²) repulsion and synthetic application edges.
- Rebuild `shared/graph.js` around selectable SVG nodes and edges, keyboard navigation, graph lenses, search, path-preserving deep links, and exact selection callbacks.
- Keep application/world/projection/derivation/realization overlays visually and semantically distinct from the canonical edge set.

## Program C — every-token source exploration

- Add `shared/semantic-source.js` to render every token as a keyboard-focusable source object.
- Use compiler source-face and lexical-identity fields only when published; never infer a keyword, declaration, subject, descriptor, or relation from spelling.
- Synchronize token selection with graph nodes, graph edges, application occurrences, world records, projections, derivations, witnesses, and lowering ranges.
- Preserve edit mode separately from inspect mode so interactive tokens do not make source editing inaccessible.

## Program D — Semantic Observatory workspace

- Rewrite `apps/graph/index.html` as a responsive three-surface workspace: source, graph, semantic rail.
- Rail lenses: Identity, Edges, Occurrences, Worlds, Projection/Derivation, Demand/Witness, Realization/Lowering, and Raw Record.
- Add explicit empty states such as `semantic identity not published`, `definition not published`, and `world witness not published`.
- Add compare selection, selection history, deep links, command/search surface, and synchronized source/graph highlighting.

## Program E — product convergence and cross-surface adoption

- Make Lib the canonical public registry of admitted world projections; keep homes as reach/provenance and Atlas/Universe as Lib lenses.
- Redirect `worlds.idol.id` to the corresponding Lib path and query without creating a second product ontology.
- Reuse exact token exploration in Lib source views and authority-backed documentation code blocks.
- Publish a non-authoritative runtime product projection that states one semantic universe and the exact product boundaries without declaring compiler graph roles.

## Verification sequence

1. Commit RED contracts and observe the expected failures.
2. Implement one producer at a time.
3. Run focused tests after each producer.
4. Run `npm run check` and Wrangler dry-run on the exact branch head.
5. Review for browser-owned grammar, identity reconstruction, synthetic edges, unsafe IDs, XSS, keyboard/mobile regressions, and stale-response races.
6. Merge only after a green exact-head workflow.
7. Verify the merged commit on every Idol hostname.
8. Exercise desktop and 390×844 mobile flows: load, analyze, token hover/click/keyboard selection, node selection, edge selection, world/projection lenses, history/back, Lib list/detail, compatibility redirect, and console/network health.
