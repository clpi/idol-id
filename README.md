# idol-id — one edge deployment for every idol.id face

`clpi/idol-id` is the canonical web-platform repository. One build and one Cloudflare Worker version serve every public face:

| face | hostnames | application |
|---|---|---|
| site | `idol.id` | landing, installation and project status |
| docs | `docs.idol.id` | law, graph, world and platform references |
| registry | `lib.idol.id` | published packages/worlds, source, graph and provenance |
| api | `api.idol.id` | compiler/registry HTTP console |
| graph | `graph.idol.id`, `r8a.idol.id`, `r8b.idol.id`, `r16.idol.id` | explorer, lowering and architecture projections |
| worlds | `worlds.idol.id` | public World Atlas and exact registry-manifest comparison |
| platform | `platform.idol.id` | honest public frontier for the authenticated platform programs |

A push to `main` runs tests, builds every surface once, validates the Worker bundle, snapshots the public world projection, and deploys the same immutable version across all ten hosts.

## authority

The authority manifest pins:

- language and semantic authority: `clpi/idol@f33bb3773484e7d954a2975211e683dfa89edab5`
- native realization/evidence: `clpi/idol-native@d422ef33c88811b99523ef0cc19a03bd158dd3c0`

Source spelling, package coordinates and hostnames are provenance. They do not mint relation, application, value, world, demand or realization identity.

## architecture

```text
browser request
    -> one Cloudflare Worker
    -> host selects one static face
    -> existing Route hosts preserve the Cloudflare Tunnel compiler origin
    -> worlds/platform Custom Domains are Worker-origin static surfaces
    -> exact deployment/authority/runtime/world snapshots remain inspectable
```

Current static faces live in:

```text
apps/{site,docs,lib,api,graph,worlds,platform}/index.html
shared/{theme.css,surface.css,shell.js,idol.js,graph.js,worlds.js,web.js,wasm.js}
content/docs/*.md
runtime/{authority.json,worlds.json}
```

The legacy Python server remains the dynamic compiler and R2-registry origin for the established Route-backed hosts. `/api/*`, `/health`, `/info`, write operations and dynamic fallbacks continue to that Tunnel origin.

`worlds.idol.id` and `platform.idol.id` are Cloudflare Worker Custom Domains. They deliberately have no same-host dynamic origin. The Worker refuses dynamic fallthrough there instead of recursively fetching itself.

## World Atlas boundary

Production deploys refresh `runtime/worlds.json` from the canonical public registry projection at `https://api.idol.id/api/worlds`, then package that immutable snapshot with the same Worker version.

The Atlas exposes exact published fields such as:

```text
name · version · publisher · graph id · source hash
provenance · tags · extent · mirror · publication time
```

Its `provided`, `published` and `foreign` labels are presentation qualifications only. The browser does not infer semantic compatibility, composition, injection witnesses, authority grants or equivalence. Those appear only when an authoritative compiler or registry producer publishes them.

`platform.idol.id` is currently a read-only capability frontier. Account sign-in, API-token creation, provider connection, repository mutation, browser-IDE writes and shell execution are explicitly marked **not yet enabled** rather than simulated.

## idol web runtime

`shared/web.js` is a small dependency bridge for current browser surfaces. It tracks exact reads and updates only subscribed projections; it does not build a virtual DOM or run a component-tree diff.

`shared/wasm.js` exposes the admitted Wasm artifact when one is supplied at build time:

```sh
IDOL_WASM_PATH=/path/to/idol-web.wasm npm run build
```

The build publishes `/runtime/manifest.json`, including authority commit, artifact hash, bytes and whether Wasm is actually present. No React, Wasmtime or other performance claim is valid unless that manifest proves the intended artifact was deployed and a reproducible benchmark records startup, payload, update work, memory, runtime and compile cost.

## local verification

```sh
npm test
npm run build
npx --yes wrangler@4.125.0 deploy --dry-run
```

Local Worker development:

```sh
npm run dev
# Select an originless face without DNS:
# http://localhost:8787/?surface=worlds
# http://localhost:8787/?surface=platform
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

GitHub Actions uses:

- the non-secret Cloudflare account ID in workflow configuration;
- `CLOUDFLARE_API_TOKEN` in the protected production secret store.

The token must be scoped to the relevant Cloudflare account and `idol.id` zone with Worker script, route and Custom Domain permissions. Never commit it.

The established Route hostnames retain proxied DNS records pointing at their Cloudflare Tunnel origins. Wrangler owns the `worlds.idol.id` and `platform.idol.id` Custom Domains, DNS records and certificates.

## deployment evidence

Every deployed version exposes:

- `/__idol/version`
- `/__idol/health`
- `/__idol/manifest`
- `/runtime/manifest.json`
- `/runtime/worlds.json`

On Route-backed hosts, `/health` and `/info` deliberately remain origin checks so compiler monitoring cannot become a false edge-only green. Originless hosts use `/__idol/health` for their edge liveness.

## legacy host deployment

`deploy/` contains the prior systemd installer and registry seeding tools. They remain useful for maintaining the Tunnel origin, but they are no longer the public static deployment authority. Public edge deployment is owned by `.github/workflows/deploy.yml`, `wrangler.jsonc`, `worker/index.js` and `scripts/build.mjs`.
