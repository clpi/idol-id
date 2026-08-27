# Idol Live and MCP semantic runtime implementation plan

> Status: implementation plan. `clpi/idol` remains semantic authority. This
> repository owns deployment and transport projections only.

## Objective

Deploy `live.idol.id` and `mcp.idol.id` as two originless faces of one immutable
Idol web version. Both consume the current standardized semantic-graph contract.
The browser and Worker execute the same admitted Idol-produced WebAssembly
artifact when present; JavaScript is limited to HTTP, WASI framing, asset loading,
and presentation.

## Invariants

1. Live owns collaboration truth, never language truth.
2. MCP projects exact graph identities and facts; it never infers identities from names.
3. Structural edge roles are finite and versioned. Operation words remain relation identities.
4. History is immutable, frontier is one causally closed accepted selection, and state is materialized from both.
5. Wasm absence or refusal is explicit. JavaScript cannot impersonate an Idol realization.
6. Every runtime document carries current Idol and idol-native provenance.
7. MCP `2026-07-28` is stateless, self-describing, deterministic, cacheable, and header-routable.
8. Every unsupported mutation, authority grant, realtime store, Git roundtrip, or scheduler capability remains visibly false.

## Delivery sequence

1. Add failing host, build, graph, Live, MCP, and Wasm transport tests.
2. Add canonical `.id` runtime source and exact generated/projection documents.
3. Add the shared browser/Node/Worker WASI runner.
4. Add Live and MCP application faces.
5. Add stateless MCP discovery, deterministic tools/list, and read-only tools/call.
6. Add host routing, local development routing, custom domains, immutable manifest entries, and navigation.
7. Compile the canonical Idol runtime to WebAssembly in CI from the pinned compiler authority; run it and compare its stdout to the committed native runtime projection.
8. Run the full test/build/Wrangler suite, review, merge, deploy, and probe both hosts.

## Initial tool surface

- `idol.orientation`
- `idol.authority`
- `idol.graph.contract`
- `idol.graph.query`
- `idol.live.status`
- `idol.live.project`
- `idol.wasm.status`
- `idol.wasm.run`

All tools are read-only. Exact mutation/admission/claim/delegation APIs follow only
when persistent Live history/frontier storage and world grants are implemented.

## Explicit open gaps after this slice

- realtime convergent operation store;
- persistent Live identities and causal history service;
- Git bidirectional roundtrip and forge injection;
- semantic scheduler, claims, context leases, and admission;
- browser-callable multi-export Idol Wasm ABI;
- MCP write tools and human confirmation flows;
- compiler-B/self-hosted runtime.
