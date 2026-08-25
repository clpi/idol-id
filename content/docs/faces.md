# Source faces

Canonical faces of Idol source. One spelling, one meaning, everywhere —
names, paths, and spellings are provenance; identity is the graph id.

## Delimiters

```id
value = table[key]        -- [] computed or indexed projection
thing.member              -- .  exactly one static projection
source:read()             -- :  subject-oriented relation face
env["HOME"]               -- projection of a home
@member                   -- @  current-world access
@{ stage = compile }      -- derived world with an exact fact delta
```

- `()` — ordinary relation application, grouping, operand/result boundaries.
  It never means table indexing.
- `[]` — computed or indexed projection. Reads and writes are demand-selected
  faces of the same projected place/value relation.
- `{}` — structured pack, table, descriptor structure.
- `.` — exactly one statically known projection. Never dynamic method search,
  namespace fallback, or computed access.
- `:` — orients an existing relation around its genuine semantic subject.
- `@` — the current world: access, injection, or world qualification.

## Ordinary application

```id
add = (a, b) a + b
x: i64 = add(20, 22)
stdout:write(x)
```

Operation-first and subject-first faces that denote the same application share
one occurrence identity. Source orientation disappears after resolution.

## Declaration-side specialization

Declaration heads specialize by the same algebra as invocation faces
(`law.subject.declaration`):

```id
weight = (body, factor)        -- generic relation
  body:mass() * factor

weight(kg) = (body, factor)    -- relation specialization: unit fixed, subject open
  ...

body:weight = (factor)         -- subject specialization: subject fixed
  :mass() * factor

body:weight(kg) = (factor)     -- subject + semantic-level specialization
  :mass()

body: {                        -- home-compressed: subject supplied by the home
  weight(kg) = (factor)
    :mass()
}
```

Each head level is a semantic fact — subject constraint, descriptor, unit,
encoding, law, stage, target, world, witness — never a nested runtime closure.
Normalization is relation identity + subject constraint + specialization facts
+ implementation witness. Payload stays in the operand pack: `body:move(10) = …`
is refused. There is no anonymous self slot `(:)` and no pipeline operator
`|>`; chaining is subject/relation chaining through demanded results.

## Binding and descriptors

```id
x = value
x: descriptor = value
clamp = (v: f64, lo: f64, hi: f64)
  if v < lo then lo
  elseif v > hi then hi
  else v
```

## Control

```id
sum = 0
for i = 1, 10 do
  sum = sum + i
end

larger = (a, b)
  if a > b then a else b
```

## Stage

```id
magic = @(40 + 2)
```

`@(expr)` is the current world applied to an expression — exactly
`expr@{ stage = compile }`. It is not a compiler directive and not a fourth
use of the sigil.

## What never exists

No `std.*`, `lib.*`, `core.*` namespace. No import/module/require ceremony —
a resolved reference contributes its dependency. Layout-projected homes
(`fs`, `json`, `os`, `io`) with subject-first relations carry initial
discovery provenance only.
