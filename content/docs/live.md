# Idol Live

> **Status: separate flagship product thesis. Implementation is not claimed.**
> Idol Live is not part of the Idol compiler and this web repository does not
> contain a completed Live kernel, realtime protocol, Git remote, agent scheduler,
> or collaboration service.
>
> **Pinned research source:** `Idol-live.md`, SHA-256
> `af5084dd85b5b82e603245c965788bfb2e9e0e8e11ee4c13933bbc8c3d6fdc75`.

## Product thesis and boundary

Idol Live should become the continuous coordination, authorship, intent,
history, delegation, review, and canonical source-state substrate for human and
agentic software work. Git remains a fully supported but necessarily lossier
compatibility projection.

```text
Git made snapshots distributed.
Live makes software work itself continuously coordinated.
```

Live owns **collaboration truth**, not language truth:

```text
Idol compiler
    language semantics
    descriptors
    applications
    worlds and effects
    dependencies
    lowering and realization

Proof
    witnesses
    evidence quality
    admission-policy reasoning

Live
    goals and tasks
    attempts and intentions
    causal operation history
    canonical accepted frontier
    realtime source
    authorship and delegation
    coordination
    Git compatibility projection

Studio
    human interaction surfaces
```

Live consumes semantic interfaces from Idol and evidence interfaces from Proof.
It must not copy their authority into a source-control ontology, parser,
“semantic manager,” or independent type/world system.

## Progressive semantic enrichment

The lowest layer must work for arbitrary artifacts without pretending to know
their meaning:

```text
text operations
    insert
    remove
    replace
    move

causality
    actor
    observation
    predecessor
    intent
    timestamp
```

Adapters then add structure only where evidence exists:

```text
unknown artifact
    bytes or text

parsed foreign language
    token and syntax structure under exact foreign source law

foreign semantic adapter
    symbols, references, descriptors, effects, and provenance

native Idol
    persistent semantic identities
    descriptors
    applications
    worlds and effects
    projections and witnesses
    machine lineage
```

A character CRDT, OT engine, event graph, or another convergence algorithm is a
possible physical realization. None is the product ontology. Rich source
coordination requires semantic operations above character convergence, explicit
claims and context, goals, provenance, worlds, evidence, and admission law.

## The three-state law

Live separates immutable factual history, normative acceptance, and
materialized state:

```text
History H
    every observation, attempt, operation, rejection, admission,
    review, witness, reversal, and external injection

Frontier F ⊆ H
    causally closed selection currently accepted into canonical source

State S
    materialization of accepted history

S = materialize(H, F)
```

An attempted edit does not require a branch and does not automatically enter
canon:

```text
H
├── attempt A
│   ├── operation a1
│   └── operation a2
├── attempt B
│   └── operation b1
├── reject a2
├── admit a1
└── admit b1

F = {a1, b1}
S = materialize(H, F)
```

Rejected, failed, superseded, and reversed work remains immutable historical
truth and organizational memory. There is exactly one logical accepted source
frontier per Live space. Physical admission and storage can be causally sharded;
one canon does not mean one global keystroke lock.

## Projection algebra

Let `G` be persistent semantic facts, `H` causal operation history, `F` the
accepted frontier, and `D` demanded facts. A projection is a derived
representation:

```text
π : (G, H, F, D) → Representation
```

Useful projections include:

```text
π.source
π.filesystem
π.git
π.text-diff
π.semantic-diff
π.authorship
π.goal
π.task
π.review
π.world
π.effect
π.api
π.risk
π.machine
π.performance
π.audit
π.release
π.agent-context
```

Projections compose. Conceptually:

```text
π.diff
    ∘ π.goal(payment-refactor)
    ∘ π.actor(agent-17)
    ∘ π.world(production)
```

asks for changes attributable to an actor, serving a goal, that alter
production-world semantics. The source, goal, task, review, world, audit, Git,
and agent views are not disconnected dashboards; they are projections of one
causal and semantic substrate.

Projection purity is absolute: a projection cannot mutate semantic authority or
invent an identity. When the target representation cannot express a native
fact, the projection emits machine-readable loss rather than silently dropping
it.

## Injection algebra

Projection interprets outward. Injection mediates foreign events into Live:

```text
ι_origin :
    ForeignEvent
    × ForeignProvenance
    × Lawset
    → ProposedGraphTransaction
```

Sources include editors, agents, Git, GitHub, GitLab, CI, runtime systems,
deployments, issue trackers, compilers, and benchmarks.

An injection records:

```text
origin
observed facts
inferred candidates with confidence
proposed graph transaction
required validation and admission
```

It never silently becomes native truth. Exact foreign origin is preserved,
semantic correspondence requires evidence, and external state enters canon only
through validation and admission.

Core laws include identity preservation, provenance preservation, causal
closure, one-canon canonicality, non-destructive history, projection purity,
injection mediation, explicit loss, stable semantic identity, world
accountability, witness dependency, context consistency, lower-level fallback,
Git round-trip, and Git-lineage preservation.

## One-canon realtime coordination

Realtime collaboration does not mean every keystroke becomes unquestionable
canon. Safety also must not recreate branches under a new name. Live uses
policy-selected transactional admission:

```text
observe
    ↓
declare intent or claim
    ↓
attempt
    ↓
operations
    ↓
validate semantic preconditions
    ↓
produce demanded witnesses
    ↓
admit | hold | reject | supersede
    ↓
advance canonical frontier
```

Trusted ordinary typing may be admitted almost immediately. An autonomous agent
changing production authorization may remain proposed until stronger review and
evidence arrive. Both participate in the same history and target the same canon.

Operation granularity forms a fallback ladder:

```text
semantic transformation
    rename exact identity
    alter descriptor
    move relation
    change dependency or policy
        ↓
structured source transformation
    replace syntax node
    insert declaration
    move syntax region
        ↓
text transformation
    insert
    remove
    replace span
```

The text layer ensures universal interoperability. Higher layers preserve more
intent, enable semantic commutation, and reduce false conflicts.

## Semantic read sets and context leases

A serious attempt records the facts that mattered to its reasoning:

```text
attempt A
    observed
        Payment descriptor v81
        authorize law requires-authentication
        payment-denied evidence pass

    proposes
        operation O1
```

Before admission, Live validates those observations. If `authorize` changed but
the other facts did not, the attempt receives the exact semantic delta rather
than blindly completing from stale repository text.

A context lease is:

```text
context C91
    valid while semantic facts {A, B, C, D} remain unchanged
```

An unrelated edit to `Z` does not invalidate the lease. A change to `B` marks
only dependent reasoning stale. This generalizes file-level consistency to
semantic-fact consistency, reducing token waste and false invalidation.

Each agent receives the smallest useful demand projection:

```text
goal and task
constraints and non-goals
authoritative contracts
semantic dependency neighborhood
active claims
recent relevant changes
rejected attempts
required witnesses
applicable worlds
observations and delta cursor
budget
```

## Claims and true conflicts

Claims advertise semantic intent before expensive work begins:

```text
claim
    actor agent-12
    task migrate-auth
    target identity AuthToken
    mode advisory
    intent remove legacy representation
```

Claims may be observe-only, advisory, coordination-required, or exclusive. Hard
locks are exceptional; work proven to commute remains parallel.

Live does not promise to eliminate real disagreement. It eliminates accidental
divergence and late textual reconciliation while exposing genuine
incompatibility earlier. Conflict classes include text, structure, identity,
descriptor/API, dependency, behavior, world/effect, data/schema, goal,
authority, witness, resource, temporal, and policy conflicts.

A conflict object identifies actors, goals, observations, semantic entities,
incompatible claims, relevant worlds and witnesses, and lawful resolution
options. It is not merely a region of conflict-marker text.

## Goal, delegation, and scheduling graph

The native hierarchy is:

```text
business outcome
    ↓
product goal
    ↓
milestone
    ↓
workstream
    ↓
task
    ↓
attempt
    ↓
intent
    ↓
operations
    ↓
witnesses
    ↓
admission
    ↓
artifact and runtime outcome
```

Relations include `requires`, `blocks`, `enables`, `verifies`, `covers`,
`conflicts`, `duplicates`, `supersedes`, `derived-from`, `delegated-to`,
`owned-by`, `observed-by`, `reviewed-by`, and `admitted-by`.

Delegation is itself an auditable transaction with principal, delegate, goal,
semantic scope, required witnesses, forbidden changes, world grants, resource
budget, expiration, and completion predicate. Subdelegation preserves the full
authority chain.

Scheduling optimizes useful admitted work per wall time while minimizing semantic
overlap, context transfer, duplicate exploration, witness duplication, human
review load, and external-world contention. More agents are not inherently
better. Dependency cut weight, historical contention, graph centrality,
resident context, permissions, claims, critical path, uncertainty, budget, and
review capacity determine useful parallelism.

## Intent and authorship

Every change carries structured purpose, usually captured from delegation,
compiler facts, tools, and runtime rather than typed manually:

```text
identity
goal and task
principal, delegate, and run
requested outcome
expected user-visible and semantic effect
non-goals, constraints, and tradeoffs
observations and assumptions
alternatives and rejected alternatives
semantic and source scope
worlds observed, requested, and changed
risk and confidence
operations and dependencies
required witnesses and produced evidence
review, admission, and result
```

Authorship is a lattice, not one commit field. Separate lenses answer origin,
latest physical touch, surviving semantic contribution, intent, principal,
delegate, exact model/tool run, formatter/codemod/generator transform, review,
witness, admission, and current ownership.

A formatter does not erase meaning authorship. A codemod does not become the
sole author of transformed semantics. An agent run remains linked to the human
or organization that delegated authority.

Semantic history becomes negative knowledge as well as surviving code. From one
identity Live can answer why it exists, prior faces, originating goals, active
consumers, incidents, failed replacement attempts, rejected alternatives,
world history, performance evidence, reviewers, and current constraints.

## Semantic reversal and continuous review

`reverse intent X` computes an inverse against current semantic state, falling
back from semantic inverse to structured source inverse to causal text-operation
inverse. Reversal adds facts; it never erases historical occurrence.

Review attaches to exact semantic claims and dependencies:

```text
review
    reviewer Alice
    covers
        Payment descriptor
        production world delta
        no-unauth-capture invariant
    valid while
        relevant dependency facts unchanged
```

An unrelated README edit does not invalidate the review. A changed payment
invariant does. Reviewer policy can target semantic identities, APIs, effects,
worlds, data classifications, and business domains rather than paths alone.

Witness inputs are exact semantic dependencies. Unaffected evidence remains
valid, reducing merge-queue and CI rerun amplification.

## Git compatibility projection

Git compatibility is permanent and bidirectional:

```text
Git ←→ Live
```

Operating modes include observe, coexist, Live-canonical, standard Git remote,
and forge bridge.

Git injection preserves exact object ID, tree, parents, author, committer,
message, signature, and timestamps. Textual operations, moves, semantic
continuity, task references, and probable intent are inferred separately with
confidence and raw Git provenance retained.

Imported branches are foreign named frontiers, not native Live branches. An
external push becomes a proposed Live transaction derived from old and new Git
trees, semantically retargeted and validated against current canon. Independent
work can proceed; stale assumptions receive exact invalidation; true conflicts
become conflict objects.

Live-to-Git export may group admissions by intent, task, review unit, milestone,
or configured time window. The mapping remains explicit:

```text
Live event and intent identities
    → Git commit object

Git commit identity != Live transformation identity
```

Rebase, squash, cherry-pick, or history re-expression may create new Git objects
without creating false new Live meaning.

Every projection reports loss, for example collapsed character provenance,
omitted rejected attempts, collapsed delegation, omitted semantic read sets,
omitted world evidence, or collapsed reviews. Git trailers, notes, signed
manifests, Live identities, or sidecars may retain pointers, but Git notes never
become correctness-critical authority.

Required round-trip laws include exact untouched-object preservation where
possible, stock Git readability of Live exports, recognition of projected
ancestry on reinjection, semantic lineage across rebase/cherry-pick, and
machine-readable loss for unrepresentable native facts.

GitHub and GitLab PRs, reviews, checks, issues, releases, and statuses inject as
foreign facts and can be projected back. A company can adopt Live without first
moving repository hosting.

## Native product surface

Native users navigate intent and meaning rather than VCS mechanics:

```text
live status
live work
live history
live diff
live why
live undo
live review
live goal
live delegate
live agents
```

They do not need checkout, stash, rebase, reset, cherry-pick, or force-push in
the native mental model.

Studio projections include Canon, Work, Live Map, Diff, History, Why, Review,
Risk, Git, and Evidence. The Live Map shows which humans and agents are reading,
claiming, changing, reviewing, or waiting on semantic identities while work is
forming, rather than after isolated branches collide.

Long-term projections can forecast conflicts, estimate context-transfer cost,
find goal drift and orphaned rationale, surface forgotten rejected approaches,
report review coverage and world deltas, materialize counterfactual frontiers,
compute semantic inverses and ownership, measure coordination tax, expose
knowledge risk, generate evidence-grounded release notes, traverse incidents,
collapse representation-only transforms without deleting history, replay work,
and teach future agents project-specific laws and negative knowledge.

## Repository and system boundary

A first implementation should remain one repository while the foundational laws
change. Major units are kernel, text convergence, graph/domain descriptors,
projection, injection, worlds, coordination, agent protocol, Git interoperability,
sync, storage, service, CLI, SDK, Studio, law tests, chaos tests, Git conformance,
and coordination benchmarks.

Live owns operation history, collaboration, source canonicality, goals/tasks,
authorship, context, agent coordination, and Git projection. The Idol compiler
owns language semantics, descriptors, dependencies, world/effect inference,
lowering, and realization. Proof owns evidence evaluation and policy reasoning.
Studio owns interaction. Live consumes those interfaces without copying their
semantic authority.

## Delivery and evidence gates

Implementation should retire risks in order:

1. **Causal source foundation:** two realtime editors, one canonical source,
   immutable operations, attribution, reconnect, causal undo, snapshots,
   compaction, and stock Git import/export. Prove convergence, no lost updates,
   provenance, recovery, Git metadata round-trip, and interactive latency.
2. **Agent coordination:** actors, principals, goals/tasks, attempts, claims,
   semantic read sets, context leases, delegation, budgets, transactional writes,
   and agent API. Compare against one agent, isolated Git worktrees, and shared
   text convergence without coordination under equal model/compute budgets.
3. **Semantic adapter:** persistent Idol identities, descriptor/dependency/world
   diffs, semantic moves and inverses, semantic contention, and semantic read
   sets. Test formatting-only changes, renames, moves, authority expansion,
   cross-line incompatibility, and text overlap that commutes semantically.
4. **Evidence and review:** facts changed → witnesses demanded → evidence →
   review obligations → admission. Measure review invalidation precision.
5. **Git conformance:** clone, fetch, push, branches, tags, merges, rebases,
   force pushes, cherry-picks, reverts, signatures, submodules, LFS, attributes,
   ignore rules, modes, symlinks, partial history, and forge objects.
6. **Scale:** one logical canon with causal sharding and demand-materialized
   semantic neighborhoods, not a global sequence lock or full monorepo checkout.
7. **Enterprise/security:** cryptographic identity, delegation certificates,
   world grants, secret policy, retention, tamper evidence, SSO, residency,
   on-premises operation, federation, legal hold, and compliance projections.

Business evaluation measures useful admitted semantic change, waiting,
stale-context recomputation, duplicate work, integration repair, review delay,
CI invalidation, rework, rationale coverage, negative-knowledge reuse, useful
work per compute and review minute, goal-to-admission time, deployment time, and
failure/reversal rate.

## Adoption and commercial wedge

The initial wedge is agent-heavy engineering organizations, not developers who
only want easier Git commands:

```text
run many coding agents against one software program
without creating equally many isolated histories,
PR coordination packets, and human integration work
```

Adoption remains gradual:

```text
Git canonical, Live observes
    ↓
Live coordinates agents, Git exports every result
    ↓
Live and Git coexist
    ↓
Live canonical, Git continuously projected
    ↓
Git invisible except for ecosystem compatibility
```

The success criterion is not “more VCS features than Git.” It is that software
work no longer has to be reconstructed from branches, commits, PRs, issues,
chat, CI, blame, agent transcripts, deployment logs, and human memory.

Live’s central abstraction is:

```text
purposeful transformations
of a continuously shared semantic system
performed by accountable actors
under explicit authority
coordinated through goals and dependencies
justified by evidence
materialized into demanded representations,
including Git
```

That is the Idol-native opportunity. It remains a product thesis until the
causal, convergence, Git, semantic, security, and scale gates above are executed
and evidenced.
