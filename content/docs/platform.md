# The idol.id platform

One edge deployment, one design system and one authority projection serve ten host surfaces.

| face | where | what |
|---|---|---|
| Site | idol.id | landing, installation and project status |
| Explorer | graph.idol.id · r8a · r8b · r16 | editor, token exploration, graph, lowering, run and facts |
| Registry | lib.idol.id | homes, packages, published worlds, versions and provenance |
| World Atlas | worlds.idol.id | public world facts, foreign-origin candidates, integration obligations and exact refusal |
| Platform | platform.idol.id | verified account profile, scoped API tokens, audit, and the later-work implementation frontier |
| Docs | docs.idol.id | language law and references |
| API | api.idol.id | compiler, registry, public world, and bearer-token transport |

## Routing and origins

The existing root/docs/lib/api/graph/r8 hosts are Cloudflare Worker Routes over proxied Tunnel origins. Static assets are served at the edge; dynamic compiler and registry requests continue to existing services.

`worlds.idol.id` and `platform.idol.id` are Worker Custom Domains. Generic unknown dynamic paths fail closed instead of recursively fetching the Worker.

Explicit `/v1/world/*` and `/v1/platform/*` operations are implemented in the Worker. Every push to `idol-id/main` tests all surfaces, refreshes public projections, provisions the Platform identity boundary, applies D1 migrations, validates Wrangler configuration, and deploys one immutable Worker version.

## World Atlas

`worlds.idol.id` consumes:

```text
/runtime/worlds.json   public registry facts
/runtime/foreign.json  provenance-qualified foreign candidates and integration records
```

The labels `provided`, `published` and `foreign` are presentation qualifications. They do not establish semantic compatibility, equivalence, composition, injection or authority.

The public foreign projection currently covers C17, Wasm/WASI, browser, Python, Rust and Go. Every candidate keeps `semantic_id = null`, publishes uncertainty and obligations, and refuses availability until a content-addressed artifact plus verified evidence exists.

Public world transport:

```text
GET  /v1/world/foreign
GET  /v1/world/:slug/integration
POST /v1/world/import-plan
```

The import-plan operation is deterministic and strictly plan-only. It performs no source fetch, repository checkout, schema dereference, API call, binary execution, transformation, semantic publication, world formation or mutation.

## Platform identity boundary

Program K introduces account and API transport without inventing a password database or treating identity as world authority.

### Browser identity

Cloudflare Access protects only:

```text
platform.idol.id/v1/platform/browser/*
```

The initial provider is one-time PIN, admitted for the bootstrap email domain. Access admission alone is not trusted by application code. The Worker verifies the Access JWT again:

```text
RS256 signature
issuer = https://<team>.cloudflareaccess.com
audience = exact Access application AUD
expiry and not-before
verified email domain
subject and email claims
```

Only after this verification does the Worker create or read a Platform profile.

### Profile

A profile contains:

```text
verified Access subject
verified email
display name
created and updated times
```

The subject and email originate in verified Access claims. The editable display name is presentation only.

### API tokens

A user can create scoped personal API tokens from the Access-protected console.

Token format:

```text
idol_pat_<public-id>.<secret>
```

The plaintext token is returned exactly once. D1 stores only:

```text
token id
owner subject
human name
safe prefix
SHA-256 digest
allowlisted scopes
created / expiry / revocation / last-use times
```

Current scopes:

```text
profile:read
world:read
registry:read
analysis:read
```

Only `profile:read` is consumed by the first bearer endpoint. Reserved scopes grant nothing until an explicit producer consumes them.

A token cannot create another token. It does not grant filesystem, process, network, secret, device, repository, runner or world authority.

### Audit

The following events are appended:

```text
profile.created
profile.updated
token.created
token.used
token.revoked
```

Audit records retain actor email, owner subject, target, exact event type, metadata, and time. Token plaintext and digests are not exposed through the UI or audit API.

## Platform API

Public:

```text
GET /v1/platform/status
```

Access-protected browser endpoints:

```text
GET   /v1/platform/browser/login
GET   /v1/platform/browser/session
GET   /v1/platform/browser/profile
PATCH /v1/platform/browser/profile
GET   /v1/platform/browser/tokens
POST  /v1/platform/browser/tokens
POST  /v1/platform/browser/tokens/:id/revoke
GET   /v1/platform/browser/audit
```

Bearer endpoint:

```text
GET /v1/platform/api/whoami
Authorization: Bearer idol_pat_...
```

Browser mutations require:

```text
verified Access identity
Origin: https://platform.idol.id
X-Idol-Request: browser
application/json when a body is parsed
bounded request body
```

Missing Access configuration, missing D1, invalid JWTs, invalid origins, unsupported scopes, expired credentials and revoked credentials fail explicitly.

## D1 storage

The production migration creates:

```text
platform_profile
platform_token
platform_audit
```

Foreign keys bind credentials and audit to a verified profile. Token digests are unique. Owner, active-token and audit-time indexes support bounded account queries.

## Cloudflare provisioning

The protected production workflow idempotently:

1. creates or reuses D1 database `idol-platform` in western North America;
2. creates or reuses the Zero Trust organization;
3. creates or reuses the one-time-PIN identity provider;
4. creates or reuses the Access application for the browser API path;
5. creates or verifies the bootstrap email-domain Allow policy;
6. generates the production Wrangler configuration with D1 and Access verification facts;
7. applies migrations;
8. deploys the same Worker version across all hosts.

Generated configuration contains only non-secret IDs and verification values. The Cloudflare API token remains in protected CI secret storage.

## Platform UI

The public page remains readable without authentication. Its account console offers:

```text
Access sign-in and sign-out
profile view/edit
API-token creation
one-time plaintext reveal and copy
token list and revocation
audit trail
provisioning status
```

The console is responsive down to 320px, uses touch-sized controls, keyboard panel navigation and reduced-motion support. Product prose uses sans-serif; exact identities, token prefixes, scopes and timestamps use Iosevka.

## Still not enabled

```text
organizations and teams
GitHub / GitLab / Bitbucket connections
provider credential storage
private repositories and workspaces
browser IDE writes
repository import or mutation
foreign probing or binary execution
build/test/benchmark runners
world/universe management writes
remote shell execution
```

Those remain separate programs with their own policy, secret, world-grant, sandbox, transformation and evidence requirements.

## Existing compiler and registry API

```text
GET  /health
GET  /info
GET  /__idol/health
GET  /__idol/version
POST /api/analyze
POST /api/fmt
POST /api/lower
POST /api/run
GET  /api/libs
GET  /api/worlds
GET  /api/lib/:name/detail
GET  /api/lib/:name/dependents
GET  /api/lib/:name/versions
POST /api/publish
GET  /api/whys
GET  /api/authority
```

The existing registry publication token remains provisional and separate from Program K tokens.

## Provenance rule

A hostname, Access subject, email, token ID, provider coordinate, repository path, URL, version or hash can identify a transport or product record. None independently establishes Idol world, relation, package, value or application identity.
