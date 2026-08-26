# Program K — Platform Identity and API Access

**Date:** 2026-08-25  
**Repository:** `clpi/idol-id`  
**Base:** `main@18b5fd296dbb02a9c9a1c81739e951b9f38c4def`  
**Design authority:** `docs/superpowers/specs/2026-08-25-worlds-platform-design-addendum.md`

## Goal

Ship the first production identity/API-access slice for `platform.idol.id` without inventing a password system, leaking provider secrets, or treating an HTTP credential as semantic/world authority.

The slice uses:

- Cloudflare Access as the browser identity ingress;
- explicit JWT verification in the Worker;
- D1 for profiles, API-token digests, and append-only audit events;
- bearer API tokens for non-browser clients;
- a public Platform shell that becomes an authenticated account/token console only after Access admits the request;
- fail-closed behavior when Access or D1 is not provisioned.

## Non-goals

- passkeys as an independent identity provider;
- GitHub/GitLab/Bitbucket repository access;
- provider token storage;
- private repositories or workspaces;
- organization/team policy;
- build/test/transform runners;
- browser IDE writes;
- shell execution;
- any claim that an authenticated account or API token grants an Idol world capability.

## Authority model

```text
Cloudflare Access identity
    -> verified identity provenance
    -> platform profile record

platform profile
    -> may create scoped transport credentials

API token
    -> authorizes one platform HTTP request
    -> does not grant filesystem/network/process/device/world authority
```

The Worker validates Access application JWT signature, issuer, audience, expiry, and email-domain policy before using claims. It never trusts an unverified `Cf-Access-*` header.

## API surface

Public:

```text
GET /v1/platform/status
```

Access-session protected:

```text
GET   /v1/platform/session
GET   /v1/platform/profile
PATCH /v1/platform/profile
GET   /v1/platform/tokens
POST  /v1/platform/tokens
POST  /v1/platform/tokens/:id/revoke
GET   /v1/platform/audit
```

API-token protected:

```text
GET /v1/platform/whoami
```

A token may carry only allowlisted transport scopes. The first slice issues:

```text
profile:read
world:read
registry:read
analysis:read
```

Only `profile:read` is consumed by Program K. Other scopes reserve stable transport vocabulary for later programs and confer no capability until a producer explicitly consumes them.

## Storage

D1 migration `migrations/0001_platform_identity.sql` creates:

- `platform_profile` keyed by verified Access subject;
- `platform_token` containing token ID, owner subject, prefix, SHA-256 digest, scopes, expiry, revocation, and last-use metadata;
- `platform_audit` as append-only events;
- indexes for owner/token/audit queries.

Plaintext API tokens are returned exactly once and never stored.

## Browser security

Browser-authenticated mutation requires:

- a verified Access JWT;
- exact `Origin: https://platform.idol.id`;
- `X-Idol-Request: browser`;
- JSON content type;
- bounded request bodies.

Bearer-token requests do not use browser cookies and therefore do not use the browser mutation path.

## Provisioning

`scripts/provision-platform.mjs` is idempotent and runs only in the protected production deploy job. It:

1. lists or creates D1 database `idol-platform` in western North America;
2. ensures a Zero Trust organization exists;
3. ensures a one-time-PIN identity provider exists;
4. ensures a self-hosted Access application protects `platform.idol.id/v1/platform/*`;
5. ensures an Allow policy for the bootstrap email domain;
6. generates `.wrangler.production.jsonc` with:
   - `PLATFORM_DB` D1 binding;
   - `ACCESS_TEAM_DOMAIN`;
   - `ACCESS_AUD`;
   - `ACCESS_EMAIL_DOMAIN`;
7. emits only non-secret resource identifiers.

The workflow applies D1 migrations, then deploys with the generated config. Provisioning failures stop deployment before the Worker changes.

## Test sequence

1. Commit RED tests for:
   - JWT validation and claim rejection;
   - bearer-token hashing and scope parsing;
   - session/profile/token/audit routes;
   - plaintext token non-persistence;
   - revocation and expiry;
   - CSRF/origin refusal;
   - missing binding and missing Access configuration;
   - build packaging and platform UI controls;
   - provisioning document generation from mocked Cloudflare API responses.
2. Observe RED in Actions.
3. Implement pure auth/token/storage modules and a fake D1 adapter for tests.
4. Implement Worker transport.
5. Add D1 migration and production provisioning.
6. Implement responsive authenticated Platform console.
7. Run full Node suite, immutable build, and Wrangler dry run.
8. Request review and fix all critical/important findings.
9. Merge only after current-main reconciliation and production-resource dry provisioning.
10. Verify live Access challenge, authenticated session, token create/use/revoke, audit entry, and deployment version.

## Acceptance criteria

1. Public Platform remains readable without login.
2. Private platform APIs are protected by Access and independently verify JWTs.
3. Missing/invalid JWTs fail with exact 401/403 outcomes.
4. Profiles derive only from verified identity claims.
5. API tokens are random, prefix-identifiable, SHA-256-digested, scoped, expirable, revocable, and returned plaintext once.
6. Revoked/expired tokens fail closed.
7. Browser mutations require same-origin/custom-header CSRF evidence.
8. Every token/profile mutation appends an audit event.
9. D1 and Access resources are provisioned idempotently from protected deployment credentials.
10. No credential becomes an Idol semantic/world authority.
11. UI works at 320px, touch, keyboard, and reduced motion.
12. All existing ten host surfaces and Program J APIs continue to pass.
