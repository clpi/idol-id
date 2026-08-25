# idol-id — one edge deployment for every idol.id face

`clpi/idol-id` is the canonical web-platform repository. One build and one Cloudflare Worker version serve every public face:

| face | hostnames | application |
|---|---|---|
| site | `idol.id` | landing and project status |
| docs | `docs.idol.id` | law, graph, world and platform references |
| registry | `lib.idol.id` | published worlds, source, graph and provenance |
| api | `api.idol.id` | compiler/registry HTTP console |
| graph | `graph.idol.id`, `r8a.idol.id`, `r8b.idol.id`, `r16.idol.id` | explorer, lowering and architecture projections |

A push to `main` runs tests, builds every surface once, validates the Worker bundle, and deploys the same immutable version across all routes.

## authority

The deployment manifest pins:

- language and semantic authority: `clpi/idol@f33bb3773484e7d954a2975211e683dfa89edab5`
- native realization/evidence: `clpi/idol-native@932a3ade3fa40c0653242559305fb67ffa142e84`

Source spelling and hostname are provenance. They do not mint relation, application, value, world, demand or realization identity.

## architecture

```text
browser request
    -> one Cloudflare Worker
    -> host selects one static face
    -> /api/* preserves the existing Cloudflare Tunnel compiler origin
    -> exact deployment/authority/runtime manifests remain inspectable
```

Current static faces remain in:

```text
apps/{site,docs,lib,api,graph}/index.html
shared/{theme.css,shell.js,idol.js,graph.js,web.js,wasm.js}
content/docs/*.md
```

The legacy Python server remains the dynamic compiler and R2-registry origin. The Worker is deployed as a Cloudflare **route**, not a Custom Domain, so `fetch(request)` continues to reach that existing tunnel origin for `/api/*`, `/health`, `/info`, and non-static fallbacks.

## idol web runtime

`shared/web.js` is a small dependency bridge for current browser surfaces. It tracks exact reads and updates only subscribed projections; it does not build a virtual DOM or run a tree diff.

`shared/wasm.js` exposes the admitted Wasm artifact when one is supplied at build time:

```sh
IDOL_WASM_PATH=/path/to/idol-web.wasm npm run build
```

The build publishes `/runtime/manifest.json`, including authority commit, artifact hash, bytes, and whether Wasm is actually present. No React/Wasmtime/other performance claim is valid unless this manifest proves the intended artifact was deployed and a benchmark records startup, payload, update work, memory, runtime and compile cost.

## local verification

```sh
npm test
npm run build
npx --yes wrangler@4.125.0 deploy --dry-run
```

Local Worker development:

```sh
npm run dev
```

The tunnel-backed Python origin can still be run directly:

```sh
python3 server.py --app graph --port 8080
python3 server.py --app api   --port 8081
python3 server.py --app lib   --port 8082
python3 server.py --app docs  --port 8084
python3 server.py --app site  --port 8090
```

## continuous deployment

GitHub Actions requires two repository or production-environment secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The token must be scoped to the relevant Cloudflare account and `idol.id` zone with Worker script and route editing permission. Never commit it.

The hostnames must retain proxied DNS records pointing at the existing Cloudflare Tunnel origin. The Worker route then serves static surfaces at the edge and delegates dynamic compiler/registry requests to that origin.

## deployment evidence

Every deployed version exposes:

- `/__idol/version`
- `/__idol/health`
- `/__idol/manifest`
- `/runtime/manifest.json`

`/health` and `/info` deliberately remain origin checks so existing compiler monitoring does not become a false edge-only green.

## legacy host deployment

`deploy/` contains the prior systemd installer and registry seeding tools. They remain useful for maintaining the tunnel origin, but they are no longer the public static deployment authority. Public static deployment is owned by `.github/workflows/deploy.yml`, `wrangler.jsonc`, `worker/index.js`, and `scripts/build.mjs`.
