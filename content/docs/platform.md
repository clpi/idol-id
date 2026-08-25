# The idol.id platform

One platform, one design, four faces. Every face binds tokens to the same
semantic graph.

| face | where | what |
|---|---|---|
| Explorer | graph.idol.id · r8b · r16 · r8a | editor, token explore, graph, lowering, run, facts |
| Registry | lib.idol.id | homes and published worlds |
| Docs | docs.idol.id | the law and its references |
| API | api.idol.id | the same surface as HTTP |

## API surface

```text
GET  /health                     liveness + compiler presence
GET  /info                       service + authority edition
POST /api/analyze   {source}     graph + explain + check in one pass
POST /api/fmt       {source}     formatter
POST /api/lower     {source, target, emit, opt}   realization text
POST /api/run       {source, args}                native execution
GET  /api/libs                   indexed homes
GET  /api/worlds                 published worlds
GET  /api/lib/:name/detail       source + graph + explain + stats
GET  /api/lib/:name/dependents   reverse references
GET  /api/lib/:name/versions     sealed snapshots
POST /api/publish   {name, version, source}       write token required
GET  /api/whys?subject=X         provenance facts
GET  /api/authority              source-law authority edition
```

Targets for `/api/lower`: `native`, `aarch64-linux`, `aarch64-macos`,
`wasm32-wasi`; emits: `asm`, `c`, `wasm`.

## Auth

Reads are open. Publishes require a bearer write token supplied out-of-band.
No server on this platform reads, sources, or executes secret files.

## Instances

The same codeface serves every subdomain: `r8b`, `r16`, `r8a` carry the
Explorer with their instance name in the status bar; `lib`, `docs`, `api`
carry their faces. The graph explorer on any instance is fully functional —
instance is provenance, not authority.
