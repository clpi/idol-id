# Source faces

> **Status: bounded projection of current compact law.** `clpi/idol` owns source
> and semantic law. This page neither completes the generated grammar nor claims
> that the current production parser realizes every lawful face. When this page
> diverges from the compact law, the compact law wins.

Canonical source spells only distinctions that cannot be recovered uniquely.
Names, paths, spans, hashes, and spellings remain provenance or indexes; exact
semantic identity comes from resolution and is carried forward.

## Permanent delimiters

```id
value = table[key]
table[key] = replacement
encoded = codec.encode(source)
read = source:read()
current = @member
compiled = thing@{ stage = compile }
```

- `()` is ordinary relation application, grouping, and operand/result boundary.
  It never means table indexing.
- `[]` is computed or indexed projection. Read and write are demand-selected
  observations of the same projected value or place.
- `{}` is structured pack, table, or descriptor structure.
- `.` is exactly one statically known projection. It is never dynamic method
  search, namespace fallback, recursive lookup, world fallback, or computed
  access.
- `:` orients an existing relation around its genuine semantic subject. The
  subject is a semantic role, never mechanically operand zero.
- `@` is the current world: exact member access, closed world derivation, or
  qualification under a world. It is not a compiler-directive namespace.

## Ordinary application and tail demand

```id
add = (a, b)
    a + b

weight = (body, factor)
    body:mass()
        * factor
```

The final demanded expression supplies the callable result. The second example
is direct relation and result composition. It does not construct a pipeline,
pipeline value, hidden receiver, or one-use bridge binding.

## Static projection and subject orientation are different

```id
encoded = codec.encode(source)
encoded = codec:encode(source)
```

The first statically projects `encode` from `codec`, then applies the resulting
value. The second resolves the relation identity `encode`, binds `codec` to its
semantic subject role, and places `source` in the ordinary operand pack. Source
syntax does not assume these are equivalent.

A file or plain table home never becomes an implicit subject merely because a
relation is reached through it. `home != subject`, `home != world`, and
`path != identity` remain absolute.

## Declaration-side specialization

Current law admits these declaration heads:

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

They normalize to one relation identity plus applicable semantic facts:

```text
relation identity       weight
subject constraint      body, where written or supplied by the qualified home
projection fact         kg, when relation law establishes its semantic role
ordinary operand        factor
implementation witness  indented body
```

A declaration level admits only a stable semantic axis such as descriptor, unit,
encoding, law, stage, target, world, or witness. Runtime payload stays after `=`
in the ordinary operand pack. Compile-time knowledge at an application may
specialize that application without minting a declared axis.

These heads are not nested functions, bound methods, partial applications,
automatic currying, or closures. A projection pack is not a curry stage. An
intermediate callable exists only when evaluation genuinely produces a callable
semantic value.

## One-subject projection sections

Where a consuming relation demands exactly one recoverable subject, current law
admits compressed forms such as:

```id
match = users:find(.id == id)
```

The section creates no lexical `self` or `it` binding and no mandatory runtime
closure. Zero candidates fail with the missing fact; multiple candidates fail
with ambiguity.

## Stage is a world fact

```id
magic = @(40 + 2)
```

`@(expr)` is `expr` evaluated under the current world with the compile-stage
fact, equivalently `expr@{ stage = compile }`. It is not a separate compile-time
language or directive system.

## Explicit refusals

The following are negative controls, not alternative Idol syntax:

```text
(:)
|>
body:move(10) = implementation
@.member
@:member
break()
continue()
```

- There is no anonymous receiver slot, ambient `self`, or first-operand receiver
  convention.
- There is no pipeline operator or pipeline ontology; use direct
  subject/relation/result chaining.
- Ordinary runtime payload does not become a declaration specialization merely
  because it is constant.
- Current-world access is `@member`.
- Empty structural exits are `break` and `continue`, not applications.

## Source-law and implementation status

Semantic law may be ahead of parser, formatter, LSP, lowering, or backend
implementation. A lawful-but-unimplemented face must be reported as such with an
exact open gap. It must never be replaced by invented redundant syntax, silently
presented as executable, or inferred from historical compatibility code.
