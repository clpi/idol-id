# idol-id — the idol.id platform

One codeface, one design system, four faces, every token explorable.

| face | subdomains | what |
|---|---|---|
| Explorer | `graph.idol.id` · `r8b` · `r16` · `r8a` | editor, token explore, semantic graph, multi-target lowering, run, facts |
| Registry | `lib.idol.id` | layout homes + published worlds; source/graph/provenance together |
| Docs | `docs.idol.id` | the law, faces, graph and world references |
| API | `api.idol.id` | the same surface as HTTP, with a live console |
| Site | `idol.id` | landing |

## Layout

```
server.py            stdlib-only HTTP server (one binary face per instance)
shared/theme.css     the design system
shared/idol.js       lexer · highlighter · editor · token explorer · api client
shared/graph.js      sim-v0 graph renderer (force layout, filter, inspect)
shared/shell.js      common chrome
apps/{graph,lib,docs,api,site}/index.html
content/docs/*.md    documentation content (law is upstream's, pinned)
deploy/              systemd units + installer
```

## Run locally

```
python3 server.py --app graph --port 8080
python3 server.py --app lib   --port 8082   # etc: docs, api, site
```

Requires an `idol` compiler binary (`IDOL_BIN`, default `~/idol`).

## Deploy an instance

On the host (as the service user):

```
git clone https://github.com/clpi/idol-id.git ~/idol-id
sudo sh ~/idol-id/deploy/install.sh graph 8080 "$(hostname -s)"
```

Installs `idol-<app>.service` (working dir `~/idol-id`, exec
`server.py --app <app> --port <port>`), enables and starts it. Cloudflare
tunnel ingress already points each hostname at its localhost port.

Write auth: set `IDOL_WRITE_TOKEN` / `IDOL_ADMIN_TOKEN` in an
`/etc/idol/idol.env` drop-in (see `deploy/units/*.service.d/env.conf`).
Without them, publish endpoints answer 401 and everything else is read-only.

## Law conformance

- Vocabulary is the law's: subject, relation, application, world, demand,
  provenance, realization. No `std`/`lib`/`core` namespace anywhere.
- Spelling-is-provenance is enforced in the UI itself: hover any token to see
  its graph identity, not its text.
- The docs ship the upstream supreme law verbatim (`content/docs/law.md`
  mirrors `clpi/idol` `docs/spec/law.md`; repin it when upstream moves).
