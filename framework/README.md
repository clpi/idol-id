# idol web

`idol-id` is the one web-platform projection of canonical Idol semantics.

The framework is intentionally not a React-compatible component runtime. Its durable model is:

```text
semantic value / application / demand
    -> exact observable web projections
    -> html, dom, worker, wasm and network realizations
```

The current deployment contains two deliberately separated layers:

1. `shared/web.js` — a compact dependency bridge used by current browser faces.
2. `/runtime/idol-web.wasm` — the preferred compute realization when an admitted artifact built by `clpi/idol` is supplied through `IDOL_WASM_PATH`.

The bridge must never be cited as proof that Idol-Wasm beats another framework. Runtime, startup, payload, memory, update work and compile cost require exact benchmark evidence. The deployment manifest exposes whether the Wasm artifact is actually present.

## one deployment

One Cloudflare Worker serves all root/subdomain faces and proxies compiler/registry API requests to the existing Cloudflare Tunnel origin:

- `idol.id`
- `docs.idol.id`
- `lib.idol.id`
- `api.idol.id`
- `graph.idol.id`
- `r8a.idol.id`
- `r8b.idol.id`
- `r16.idol.id`

A push to `main` builds once and deploys that one version across every route.
