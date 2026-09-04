# Hermes incident — 2026-09-04

Status: NOT REPAIRED. This is an observation record, not proof of application health or completed failover.

## Evidence

The existing production environment's Cloudflare credential was used without printing its value. Public HTTP checks were unauthenticated.

- Initial check: Actions run 33930393390, job 101207620153, observed 23:40:44–47 UTC.
- Ingress inspection: Actions run 33930642174, job 101208355287, observed 23:45:03–04 UTC.
- Final repeat: Actions run 33930393390, job 101208799477, observed 23:47:39–41 UTC (16:47 PDT).

The raw job logs are accessible through the repository's Actions UI. Initial and final public checks both returned:

| Host | GET / | GET /login |
|---|---:|---:|
| hermes-gb.idol.id | 302 to login | 200, title Idol dev — Sign in |
| hermes-mm.idol.id | 502 | 502 |
| hermes.idol.id | 502 | 502 |

A different runner/request-default combination returned 403 for all three login URLs during the intervening ingress check. The reason is unresolved; it does not establish a particular WAF or browser fault.

## Cloudflare mapping

All three were proxied CNAMEs to these healthy tunnels:

| Host | Tunnel UUID | Name | Config source |
|---|---|---|---|
| hermes-gb.idol.id | ca26286a-3fbc-4f5d-9d04-72dc8d715903 | claw | cloudflare v6 |
| hermes-mm.idol.id | 7bdd234f-8ed1-415c-bf69-8ba37ead86d4 | mm-hermes-openclaw | cloudflare v1 |
| hermes.idol.id | 88f6065d-bd0e-44f2-beb0-a6b0613d02db | mm-hermes-openclaw4 | local v1 |

Each regular WebUI route targets http://127.0.0.1:8787 on its connector host. The primary's API-visible hostname is capitalized Hermes.idol.id; this has not been established as the cause of its 502. Physical host placement was not independently verified.

The Grok rules to port 18889 match /mcp and /mcp/*, not /login. Do not delete them as an alleged login collision.

r16-new (f43607fc-f26b-4fdc-b3b0-85f1bfc006e1) was healthy and still had hermes.idol.id ingress on port 8787 in remote configuration version 39. Canonical DNS did not target that tunnel. Its Hermes process, credentials, and recoverable work state were not checked.

## Conclusions and limits

Healthy connectors plus repeated 502 responses direct investigation toward the origin/service path. Exact process-level cause remains unverified: no host shell or origin error logs were obtained. Grok's served login page does not establish successful authentication, Hermes identity, or ongoing work.

No password was tested or changed. Follow-up proposed password-verification and origin-log workflows were blocked before file creation and execution. They are not part of this branch.

The only repository changes made by this investigation are this record and the two read-only diagnostic workflows on ops/hermes-readonly-diagnostic-20260904. The investigation did not edit main, production DNS/tunnel configuration, services, queues, claims, or worktrees. No recurring monitor was installed. All observed diagnostic jobs completed.

Cross-device checkpoint replication, shared sessions, claim fencing, host failover, provider fallback in the deployed fleet, and fresh graph presence/witness projections remain unverified. Restore and verify the actual services and shared authentication before switching traffic. A configured alternate route and a green tunnel are insufficient completion witnesses.
