# Research synthesis: Idol as a projection onto a semantic relation graph

Status: research synthesis, preserved 2026-08-25. Established rows are law
(`docs/spec/law.md`, `law.subject.declaration` and kin). Everything else is an
open research program, not a claim of working compiler code.

## The one-sentence model

Idol is not a conventional language whose AST is later converted into a graph;
it is a language whose **source is a projection onto an underlying semantic
relation graph**. Functions, methods, control flow, currying, modules, foreign
calls, effects, protocols, and machine operations are different source or
lowering projections of a small vocabulary: relations, subjects, operand/result
packs, demand, projections, worlds, witnesses, continuations, descriptors,
representations, and derivations.

## Canonical rulings (now law)

| area | ruling |
|---|---|
| pipeline | no native `\|>`; chaining is relation chaining through demanded results |
| tail return | a callable's demanded tail value supplies its result pack; `return` is an explicit non-tail exit edge |
| `:` | subject orientation / subject-specialized declaration; never an OO receiver |
| `.` | static named projection; does not establish a subject |
| `body:mass(kg)` | complete application: relation `mass`, subject `body`, operand `kg` |
| `mass(kg)` | subject-open specialization when roles are uniquely established |
| partial application | semantic fact saturation, never positional auto-currying |
| `(:)` | rejected — subject qualification and homes already cover it |
| `body:weight = …` / `body:weight(kg) = …` / `body: { weight(kg) = … }` | the declaration-side specialization family (`law.subject.declaration`) |
| file | lexical/provenance partition, never an implicit receiver or namespace |
| control words | `if`/`for`/`break`/`continue`/`return` resolve to ordinary control relations and continuation demands |
| worlds | explicit graph values carrying authority/effect/context facts; omission only under explicit lexical grant |
| protocols | sets of relation requirements, laws, and witnesses; dispatch representation chosen in lowering |
| foreign syntax | parsed under an explicit foreign grammar/world boundary, projected into the same graph with provenance |

## The core graph vocabulary

Applications carry relation, optional subject, operand pack, result pack,
demand, worlds, effects, descriptors, witnesses, and provenance — resolved
before lowering. No downstream stage rediscovers "subject" from argument order
or colon spelling. Control is edges: `if` is a branch relation over demanded
continuations; `for` is an iteration relation with a protocol witness; `break`
is a result-bearing edge into the loop-exit continuation. Specialization
carries bound facts and open roles — there is no `CurriedFunction`,
`BoundMethod`, or `PartialApplication` semantic kingdom.

## The optimization principle

> Do not materialize, distinguish, order, or lower a fact earlier than semantic
> demand requires.

Consequences: receiver placement, closure materialization, control blocks, ABI
representation, protocol dispatch, memory layout, FFI marshaling, and even some
target-world boundaries stay open until demand forces a choice. Projection
algebra treats marshal/unmarshal pairs across foreign boundaries as cancellable
rewrites rather than opaque call edges. World algebra models every world —
POSIX, Python, JVM, Wasm, CUDA, test sandbox, compile-time — as a bundle of
namespace, authority, effects, grammars, ABI, representations, and laws, with
no ambient global authority (capability discipline).

## Open research programs (ranked)

- **P0** demand-driven semantic specialization; zero-materialization relation
  specialization (`things:map(mass(kg))` with no closure); graph-native control
  before CFG lowering; world-aware equality saturation; cross-FFI projection
  cancellation; late representation/layout synthesis.
- **P1** protocol resolution as logic query; semantic-node incremental
  compilation; build/test/runtime as one world graph; structured foreign
  grammar lowering (shell lines → structured executable/argv edges);
  hardware-cost-driven extraction; proof-carrying rewrites; commutativity
  inference for parallel iteration.
- **P2** semantic foreign-name resolution; bidirectional graph↔source
  projections; solver-generated adapters; reversible cross-world
  representations.

## Non-goals and honesty

No new punctuation for these: no `protocol` keyword, no dependency-injection
grammar, no `(:)`, no `|>`. "Implemented" is reserved for what the repository
evidence establishes; this page labels everything else as law, recommended
completion, or open research. Equivalent source faces are tested for graph
equivalence, not merely equal output.
