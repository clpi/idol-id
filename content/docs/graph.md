# The semantic graph

One graph holds exact identities and facts. Everything else — parsers,
formatters, LSP, MCP, this website — consumes projections of it.

## Export

`idol graph file.id` publishes the SIM v0 snapshot:

```text
nodes               func · param · local · value · call · module · world
edges               binding · projection · member · …
applications        relation · subject · operands · results · demand
callable_linkages   origin · exposure · symbol
worlds              home · reach · members
draws               application → world/effect demand
places              shape · region · determinacy · mutation · escape
exact_i64           known exact contents
source_quote        exact source bytes behind a value
```

## Identity

One semantic thing has one exact id. Names, paths, spans, hashes, pointers,
AST nodes, opcodes, slots, host types, source spellings, and representations
are provenance, indexes, or physical encodings only.

## Relations

Edges are structural roles — `subject`, `operand`, `result`, `binding`,
`descriptor`, `projection`, `capture`, `world`, `witness`, `demand`,
`provenance`, `realization`. There are no operational edge kinds (no `call`,
`read`, `write`, `parse`, `lower`, `emit`).

## Demand

Demand is a graph fact identifying which results, members, effects, states,
diagnostics, provenance, or temporal observations must survive. Unobserved
work may be physically absent when an exact witness proves observation
equivalence.

## Realization

`idol explain file.id` publishes knowledge snapshots and optimization
outcomes: what the compiler knows, and the transform lineage
(`call.inline`, `call.specialize`, …) that produced the current realization —
each with input/output hashes and evidence.

## On this site

Every token on every page is bound to its graph node when a graph exists:
hover to see kind, id, scope, relations, applications, world draws, linkage,
knowledge; click to pin; *reveal in graph* opens the explorer with that node
selected.
