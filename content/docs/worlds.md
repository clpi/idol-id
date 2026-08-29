# Worlds

A world is the closed semantic table under which meaning is resolved.

## Never conflate

```text
home     where meaning lives / provenance context
reach    whether meaning resolves here
subject  value/place an application is about
world    facts and authority under which it is interpreted
place    observable storage/location identity
```

Absolute:

```text
home != world
home != subject
path != identity
package provenance != authority
value != place
binding != place
world witness != relation/protocol witness
```

## The sigil

`@` is the current world.

- `@member` — exact current-world member
- `@{ k = v }` — closed world with an exact fact delta
- `thing@world` — evaluate or qualify under that world
- `@(expr)` — the world resolving `expr`, with the compile-stage fact

Injection does not mutate its source world and cannot manufacture authority.

## Places

A place exists only when mutation, alias, address, lifetime, persistence, volatile or device behavior, or an ABI boundary makes location observable. Scalars, parameters, homes, and immutable determined values are not places merely because a compiler stores them somewhere.

## Public projections

The canonical public world product is Lib:

```text
https://lib.idol.id/             published admitted-world records
https://lib.idol.id/atlas        world and foreign-origin projection atlas
https://lib.idol.id/?set=homes   source homes and reach provenance
https://lib.idol.id/universe     public operational Universe views
```

`worlds.idol.id` is a path-preserving compatibility alias to `lib.idol.id`. New links and documentation use the canonical Lib routes directly.

The Atlas is a compiler-published projection browser. It may display:

- published world facts;
- provenance-qualified foreign candidates;
- explicit uncertainty;
- integration obligations;
- refusal records;
- artifact evidence when actually published.

The Atlas does not mint semantic identity, prove equivalence, grant authority, infer compatibility from names, or import a foreign project merely because a candidate is visible.

## Registry boundary

Published records carry source, graph facts, and provenance together. A version is a sealed source snapshot, not a namespace and not an authority grant. Dependency is contributed by resolved reference, never by import ceremony.

A package coordinate is provenance. A home is reach and provenance. Neither is a world identity.

## Foreign candidates

A foreign-origin record retains its foreign source law and origin. Native Idol correspondence requires an explicit equivalence witness. Import planning remains plan-only until every required source-law, identity, ABI, ownership, effect, world, authority, and evidence obligation is satisfied.

The deterministic planning endpoint is:

```text
POST https://api.idol.id/v1/world/import-plan
```

Planning does not fetch, execute, transform, publish, grant authority, or claim equivalence.
