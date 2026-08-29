# HTTP API

`api.idol.id` is an operational transport surface. It exposes deployment identity, compiler-origin endpoints, published registry projections, and bounded world-integration planning. It is not semantic authority and it does not make a capability true merely because an endpoint exists.

## Ownership boundary

| Endpoint family | Owner | Meaning |
|---|---|---|
| `/__idol/*`, `/runtime/*` | idol.id edge deployment | exact deployed web, language, native, source-law, and runtime projection identity |
| `/health`, `/info`, `/api/*` | compiler origin reached through the API host | compiler or registry behavior exactly as returned by the configured origin |
| `/v1/world/*` | idol.id edge deployment | bounded published/foreign world projections and deterministic import planning |

The edge does not reinterpret compiler responses. The browser console does not infer semantic identity from source text, paths, package names, status codes, or JSON field spelling.

## Exact deployment identity

```sh
curl https://api.idol.id/__idol/version
curl https://api.idol.id/runtime/authority.json
curl https://api.idol.id/runtime/manifest.json
```

`/__idol/version` identifies the exact web deployment and the authority editions it projects. `/runtime/authority.json` is the immutable authority document packaged into that deployment.

## Compiler-origin requests

```sh
curl https://api.idol.id/api/analyze \
  -H 'content-type: application/json' \
  --data '{"source":"value = table[key]"}'
```

Lawful source does not imply parser, analysis, lowering, execution, formatting, or target support. Each response is evidence only for the endpoint and deployment that produced it.

The public console intentionally reports:

- HTTP status;
- elapsed time;
- response content type;
- cache policy;
- exact bounded response text.

It does not relabel an error as success or turn a transport response into a semantic witness.

## World projections

```sh
curl https://api.idol.id/v1/world/foreign
curl https://api.idol.id/v1/world/c/integration
```

A foreign-origin world record preserves foreign provenance and explicit uncertainty. It does not inherit Idol identity or authority.

Import planning is deterministic and plan-only:

```sh
curl https://api.idol.id/v1/world/import-plan \
  -H 'content-type: application/json' \
  --data '{"kind":"repository","locator":"https://example.invalid/project","version":"exact-revision"}'
```

The plan does not fetch, execute, transform, publish, grant authority, or prove equivalence.

## Authentication

Some compiler-origin operations, including publication, may require a bearer token. The API console keeps a pasted token only in the current input field. It does not write tokens to local storage, session storage, cookies, IndexedDB, or URLs.

A bearer token is transport authority for the scopes attached to that token. It is not a language-world witness and cannot manufacture semantic authority.

## Limits

The console is a bounded inspection client, not an API gateway implementation. Request and response limits remain owned by the receiving service. The console truncates unusually large rendered output rather than making the browser unresponsive, while preserving the response status and an explicit truncation marker.
