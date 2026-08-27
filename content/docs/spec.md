# Idol specification blueprint

> **Status: non-authoritative architecture blueprint.** This document projects
> and organizes the supplied specification research. It does not own language
> law. **The compact law wins.** The compact law in
> `clpi/idol/docs/spec/law.md` wins over this document, every website, every
> example, every implementation, and every research note.
>
> **Pinned research source:** `Spec.md`, SHA-256
> `0653bf7a543cf399c73b14948dd3b2b87f784d09442fdabe653fc865a2e2fd63`.
>
> **Pinned language authority:** `clpi/idol@f1dfa2c36e1f495f97bd9282b3f93e4cbc812d99`,
> source-law edition
> `95e70291b13062881ebc6c96005c5ad02230bf5b5a7e62ced4f6e8787ab4993b`.

## Authority baseline

The current authority hierarchy is exact:

```text
clpi/idol main
    docs/spec/law.md
        sole supreme compact law

    docs/spec/constitution.md
        structured long-form expansion
        stable law-id owner

    docs/spec/source.md
        non-owning source projection

    docs/spec/AUTHORITY.json
        pinned artifacts and exact source-law edition
```

A web page, fixture, parser branch, host enum, historical token table, generated
artifact, or research document that disagrees with the compact law is wrong or
historical. It cannot amend the language by being executable or frequently used.

Semantic law and implementation support are deliberately separate. Current law
may admit a face that the production parser does not yet recognize completely.
The correct status is **lawful but implementation-blocked**, with the exact gap.
Invented replacement syntax and silent runnable claims are forbidden.

The bootstrap remains incomplete. Idol-owned source ingress, lexical production,
and portions of grammar-fact ownership have crossed the authority boundary, but
host code still owns material parser, semantic-construction, application,
demand, lowering, machine-selection, object-emission, and runtime/link work.
Compiler B and compiler C are not yet established.

## One architecture

The target architecture is:

```text
source bytes + exact source-law edition
    ↓
generated grammar facts
    ↓
minimal source structure + provenance
    ↓
one semantic graph with maximum exact facts
    ↓
occurrence demand
    ↓
witnessed transformations
    ↓
one late realization decision
    ↓
machine / foreign / hardware realization
    ↓
evidence and lineage
```

This is not a permanent `AST → IR → IR → pass pipeline → generic backend`
architecture. Syntax recognition is a projection. The semantic graph owns
resolved meaning. Demand owns required observations. Transformations retain
preconditions and witnesses. Representation remains open until physical choice
is profitable and lawful.

The universal direction is:

```text
MINIMUM SOURCE SPELLING
MAXIMUM SEMANTIC FACTS
MINIMUM PHYSICAL WORK
```

One semantic thing has one identity. Facts qualify that identity. Names, paths,
spans, hashes, source spellings, pointers, AST nodes, host enums, opcodes, and
machine representations are provenance, indexes, or physical encodings only.
Every authoritative fact has one producer and is carried forward rather than
reconstructed downstream.

## Source and delimiter closure

The permanent source faces are:

| Face | Irreducible meaning |
|---|---|
| `()` | ordinary relation application, grouping, operand/result boundaries |
| `[]` | computed or indexed projection |
| `{}` | structured pack, table, or descriptor structure |
| `.` | exactly one static named projection |
| `:` | subject-oriented relation or constraint face |
| `@` | current-world access, closed injection/derivation, or qualification |

Canonical line comments use `#`. Text is double-quoted. Byte sequences are
single-quoted. Blocks close by indentation. A `.id` file is a source partition,
not a module. A directory may contribute discovery/home provenance, never a
namespace object, receiver, world, or authority grant.

The complete generated grammar is not claimed closed. Parser, formatter,
Tree-sitter, LSP, MCP, documentation, and canonicalization must eventually
consume projections from one executable grammar owner. Handwritten spelling and
role tables that merely attempt to agree are second authority.

## Application and projection algebra

Idol has one application algebra. Function-like, subject-oriented, generic,
builtin, foreign, and transformed calls are applications of exact relation or
value identities under exact operand packs, world facts, result demand, and
witnesses.

Static projection and subject orientation remain different:

```id
encoded = codec.encode(source)
encoded = codec:encode(source)
```

The first projects one statically named member, then applies the projected
value. The second resolves relation `encode`, binds `codec` to the semantic
subject role, and puts `source` in the ordinary operand pack. Source syntax does
not assume equivalence.

A resolved application can be described as:

```text
application identity
relation identity
semantic subject, if present
ordinary operand pack
result pack
projection/specialization pack
occurrence demand
effects
world requirement and witness
constraint/protocol witnesses
source law
origin and provenance
```

Structural graph edges name roles such as `relation`, `subject`, `operand`,
`result`, `member`, `binding`, `descriptor`, `projection`, `capture`,
`provenance`, `origin`, `witness`, `demand`, and `target`. Operations such as
`read`, `write`, `parse`, `compile`, or `transform` are relation identities, not
edge labels. Reverse traversal is a derived index, never duplicated truth.

## Declaration specialization, not currying

Current law admits:

```id
weight = (body, factor)
    body:mass()
        * factor

weight(kg) = (body, factor)
    body:mass()
        * factor

body:weight = (factor)
    :mass()
        * factor

body:weight(kg) = (factor)
    :mass()
        * factor

body: {
    weight(kg) = (factor)
        :mass()
            * factor
}
```

These normalize to one relation identity plus semantic facts:

```text
relation identity       weight
subject constraint      body, where supplied
projection fact         kg, where relation law establishes its role
ordinary operand        factor
implementation witness  body
```

A declaration level may fix a stable semantic axis: descriptor, unit, encoding,
law, stage, target, world, or witness. Runtime payload remains in the ordinary
operand pack after `=`. A constant call-site payload may permit application
specialization without becoming a declared axis.

A projection pack is not a curry stage. Declaration-side specialization creates
no nested function, partial application, bound method, or closure. Structural
currying exists only when an application genuinely produces a callable semantic
value. Automatic positional currying is forbidden.

Negative controls include:

```text
(:)
|>
body:move(10) = implementation
@.member
@:member
break()
continue()
```

There is no anonymous receiver, ambient `self`, first-operand receiver rule, or
pipeline ontology. Empty structural exits are `break` and `continue`.

## Tail demand and direct chaining

```id
prepare = (value)
    value:validate():normalize():encode()

score = (x, a, b)
    x
        * a
        + b
```

The final demanded expression supplies the result. Continuation through a prior
result is lawful only when the exact result pack and demand identify one subject.
Ambiguity fails closed. The graph retains the relations and demand while
realization may inline, fuse, vectorize, replace the algorithm, or emit no work
for unobserved facts.

One-subject projection sections such as:

```id
match = users:find(.id == id)
```

are lawful only where the consuming relation establishes exactly one recoverable
subject. They create no lexical `self` or `it` binding and no mandatory runtime
closure.

## Worlds, protocols, and authority

A world is a closed semantic table. It may carry bindings, descriptors,
relations, facts, stage and target facts, authority, requirements, witnesses,
and observer demand. It is not synonymous with authority.

```text
home != world
home != subject
path != identity
package provenance != authority
value != place
binding != place
world witness != relation/protocol witness
```

Current-world faces include:

```id
current = @member
trial = @{ tax = zero }
compiled = thing@{ stage = compile }
```

Injection does not mutate its source world and cannot manufacture authority from
a member name or value. Stage is a world fact; `@(expr)` is evaluation under the
current world with the compile-stage delta, not a directive namespace or second
compile-time language.

A relation is the protocol. A constraint demands an existing relation or fact;
a witness proves satisfaction. No trait/interface/impl/vtable kingdom is needed.
Protocol satisfaction and execution authority remain orthogonal. When subject,
witness, authority, world, and target are sealed, runtime dictionaries, world
lookups, capability registries, and indirect dispatch may disappear entirely.

## Foreign source law and project harnessing

Foreign source law and origin are preserved first. A foreign language is not
automatically an Idol world, module, namespace, relation catalog, or native
semantic identity.

Foreign ingress retains:

```text
foreign identity
exact source law
exact spelling and span
syntax role
signature and descriptor facts, where known
ABI and representation facts
effects and authority facts
origin and provenance
uncertainty
```

Native convergence requires an explicit equivalence witness under exact
conditions. Identifier splitting or naming conventions may generate search
candidates but cannot prove behavior. Renaming a foreign symbol while preserving
its foreign binding and equivalence metadata must change spelling provenance,
not native semantic identity.

The general harness is:

```text
foreign project tree
    ↓ exact source-law ingress
foreign graph facts
    ↓ equivalence / ABI witnesses
Idol graph correspondence
    ↓ build and test worlds
foreign or Idol realization
    ↓
observations and evidence
```

Lua, C ABI, shell, Wasm, LLVM/MLIR, and hardware/RTL remain exact foreign laws or
realizations until witnessed correspondence exists. Command-looking text never
selects shell grammar heuristically. Process authority remains a separate world
fact. Hardware remains target and realization fact space, not a parallel
language universe.

## Demand, transformation, and realization

Demand is occurrence-specific. It identifies which results, members, effects,
states, diagnostics, provenance, temporal observations, or security properties
must survive. Unobserved values, fields, iterations, storage, calls, control
flow, world setup, and even entire algorithms may be physically absent when a
witness proves observation equivalence.

Every transformation carries:

```text
exact input identities
relation laws and preconditions
world/effect/stage/target/observer obligations
replacement and result identities
provenance
verification witness
realization and evidence lineage
```

Transformations form one open architecture: canonicalization, specialization,
quotienting, recurrence contraction, fusion, vectorization, layout change,
devirtualization, foreign projection, superoptimization, and hardware synthesis
are not privileged pass kingdoms.

Semantic values are independent of physical representation. Under exact demand,
a realization may be absent, immediate, register, stack, aggregate, memory,
shared region, SIMD, GPU, Wasm, foreign ABI, hardware, or another target form.
DNIR may encode physical realization over graph identities; it cannot own
semantic application classes, descriptor law, effect law, places, worlds, or
optimization eligibility.

## Performance and evidence

FTCFTW is verified Pareto dominance over the strongest known semantically
equivalent implementation, or equality with a proven physical lower bound where
strict improvement is impossible. Architecture is not evidence.

Each result keeps runtime, throughput, latency, startup, warmup, compile and
incremental work, memory, allocation, traffic, artifact size, loaded bytes,
relocations, syscalls, instructions, branches, misses, spills, energy, and target
constraints visible. A result is WIN, OPTIMAL, or an exact LOSS with causal
decomposition. An algorithmic win never conceals machine/code-generation debt.

High-leverage research directions include:

- incremental relational fact maintenance over source deltas;
- persistent equality/equivalence overlays keyed by existing graph identities;
- algebraic provenance for exact invalidation and diagnostics;
- semantic partial evaluation from known graph facts;
- affine and other recurrence recognition before CFG commitment;
- indexed, sparse/dense, parallel, fused, and communication-avoiding algorithm
  selection;
- late local verified superoptimization;
- translation validation and checked algebraic witnesses;
- demanded security observations such as constant-time or non-interference;
- joint software, Wasm, foreign-library, GPU, and hardware realization search.

The prerequisite order is graph sovereignty, exact fact cardinality,
application closure, occurrence demand, place/lifetime/alias facts,
representation-one, complete effects, and machine provenance. Machine cleverness
cannot repair missing semantic authority.

## Closure roadmap

1. **Authority freeze:** one machine-readable source-law edition, generated
   delimiter/operator/control/declaration grammar, compatibility classification,
   human grammar, Tree-sitter projection, formatter/LSP roles, and adversarial
   differential suites.
2. **Graph sovereignty:** exact typed identities, application occurrences, pack
   cardinality, descriptors, worlds, witnesses, provenance, transformations, and
   realization lineage; no semantic reconstruction from AST tags or spelling.
3. **Projection/world/protocol closure:** graph-equality laws for projection,
   injection, shadowing, subject convergence, specialization commutation,
   protocol witnesses, and ambiguity refusal.
4. **Foreign ingress:** one protocol for source-law identity, foreign identity,
   exact spelling, origin, signature, ABI, effect, authority, and equivalence
   witnesses.
5. **Harness closure:** build, test, compile-fail, benchmark, Wasm, foreign, and
   hardware observations as worlds and demands over one graph, not new language
   kingdoms.
6. **Demand and realization:** vertical scalarization, table fusion,
   world-qualified I/O, numeric/vector, and affine-recurrence kernels with exact
   evidence.
7. **Persistent-graph research:** incremental facts, equivalence overlay, and
   algebraic provenance, each deletable without changing semantic truth.
8. **Verification:** declared validation tiers from graph equality through SMT,
   translation validation, checked laws, differential evidence, security
   refinement, and hardware timing/resource evidence.
9. **Self-host:** compiler B from canonical Idol source, compiler C from B over
   identical source, then reproducible semantic and artifact fixed-point
   evidence.

## Canonical governing laws

The blueprint converges on these law families:

```text
ONE-ID
FACT-ONE
SOURCE-MINIMUM
GRAPH-MAXIMUM
REALIZATION-MINIMUM
RESOLVE-ONCE
APPLICATION-ONE
PACK-ONE
SUBJECT-ROLE
SUBJECT-DECLARATION
NO-ANONYMOUS-SELF
CURRY-STRUCTURAL
NO-AUTOCURRY
PROJECTION-ONE
WORLD-CLOSED
AUTHORITY-SEPARATE
PROTOCOL-RELATION
HOME-NOT-WORLD
HOME-NOT-SUBJECT
FILE-NOT-MODULE
TAIL-DEMAND
CHAIN-DIRECT
PIPELINE-ZERO
INTERMEDIATE-ZERO
PLACE-DEMAND
EDGE-STRUCTURAL
REVERSE-DERIVED
CATALOG-ZERO
BOOLEAN-MIRROR-ZERO
FOREIGN-LAW
FOREIGN-WITNESS
NAME-PROVENANCE
DEMAND-OCCURRENCE
REPRESENTATION-ONE
TRANSFORM-WITNESSED
OPTIMIZATION-OPEN
COST-PARETO
LOWER-BOUND
EVIDENCE-SUBJECT
BRIDGE-DEATH
```

The unifying principle is:

```text
source
→ exact facts
→ occurrence demand
→ proof-preserving choice
→ minimum physical observation
```

Every syntax face must contribute one irreducible distinction. Everything
uniquely recoverable disappears from source. Every semantic fact survives long
enough to justify optimization. Every physical object must justify its
observability. Foreign semantics remain foreign until equivalence is witnessed.
No algorithm, representation, schedule, target, or execution strategy is
privileged when a cheaper lawful realization satisfies exactly the demanded
observations.
