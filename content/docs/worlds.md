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
- `thing@world` — evaluate/qualify under that world
- `@(expr)` — the world resolving `expr`, with the compile-stage fact

Injection does not mutate its source world and cannot manufacture authority.

## Places

A place exists only when mutation, alias, address, lifetime, persistence,
volatile/device behavior, or an ABI boundary makes location observable.
Scalars, parameters, homes, and immutable determined values are not places
merely because a compiler stores them somewhere.

## Registry

Published worlds on `lib.idol.id` carry source, graph facts, and provenance
together. A version is a sealed source snapshot — not a namespace, not an
authority grant. Dependency is contributed by resolved reference, never by
import ceremony.
