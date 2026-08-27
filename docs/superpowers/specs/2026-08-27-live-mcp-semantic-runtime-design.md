# Idol Live and MCP semantic runtime design

## Boundary

`live.idol.id` and `mcp.idol.id` are projections of one standardized Idol
semantic graph. They are not new language authorities and do not copy compiler
semantics into web code.

- `clpi/idol` owns language and graph meaning.
- `clpi/idol-native` owns native/Wasm realization evidence.
- `live.idol.id` owns presentation of collaboration truth.
- `mcp.idol.id` owns stateless agent transport over exact graph projections.
- `clpi/idol-id` owns HTTP, asset, browser, Worker, and deployment realization.

## One runtime document

A canonical Idol program emits a bounded runtime document describing:

- exact authority revisions;
- semantic graph schema and structural roles;
- Live history/frontier/state laws;
- MCP tool identities and read-only capability status;
- Wasm source/compiler/artifact provenance;
- explicit unsupported capabilities.

CI compiles that source with the pinned Idol bootstrap seed to native WebAssembly,
runs `_start` through the same minimal WASI adapter used by browsers and Workers,
and compares stdout byte-for-byte with the committed projection.

## Standard graph contract

The graph contract admits exact identities and facts for source, binding, value,
relation, application, subject, operands, results, projection, descriptor,
world, demand, witness, transformation, realization, target, origin, and
provenance.

The structural edge role set is:

```text
binding
capture
demand
descriptor
member
operand
origin
projection
provenance
relation
result
subject
target
witness
```

`read`, `write`, `parse`, `compile`, `execute`, `dispatch`, and `transform` are
relation identities, never structural edge roles. Reverse traversal is derived.
Names, paths, hashes, spans, host enums, and representations are provenance or
physical indexes, never semantic identity.

## Live model

```text
History H
    immutable causal truth

Frontier F subset H
    one causally closed normative selection

State S
    materialize(H, F)
```

The initial deployment publishes the model and an exact, immutable bootstrap
snapshot. It does not claim a realtime operation store, Git roundtrip, scheduler,
claims, context leases, or admission service.

## MCP model

The primary protocol is MCP `2026-07-28`:

- no handshake or protocol sessions;
- required per-request `_meta` identity/version/capabilities;
- `server/discover` support;
- `Mcp-Method` and `Mcp-Name` routing headers;
- strict header/body agreement;
- deterministic, cacheable list results;
- request Origin validation;
- read-only tools in the first slice.

The endpoint may later expose explicit state handles, but it never hides semantic
state inside a transport session.

## Wasm runtime

The native Idol Wasm emitter exports `memory` and `_start` and imports the WASI
`fd_write` and `proc_exit` functions for this pure program subset. The shared
adapter grants only those two operations, captures stdout, and records exit.
No filesystem, network, process, secret, repository, or world authority is
available to the module.

## Failure model

Every boundary fails closed:

- missing or invalid runtime projection: 5xx with exact path;
- unsupported protocol version: explicit protocol error;
- missing/mismatched MCP routing headers: 4xx;
- unexpected Origin: 403;
- unknown tool/lens/role: structured refusal;
- absent Wasm: exact unavailable state, no JavaScript substitution;
- invalid or overlapping semantic identities: refusal, never first-match choice.
