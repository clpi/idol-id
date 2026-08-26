# Program M — Repository Observation, Scaffold Preview, and Bootstrap Distribution

**Repository:** `clpi/idol-id`  
**Base:** exact current `main`  
**Authority:** `runtime/authority.json`  
**Status:** implementation plan

## Goal

Add a protected Repository Observatory at `platform.idol.id/repo` that can inspect the public metadata/tree projection of an exact GitHub, GitLab, or Bitbucket revision, persist a provenance-qualified observation, and generate a review-only Idol adoption scaffold. Ship copyable macOS/Linux and Windows installers that build the exact pinned Zig bootstrap seed without claiming self-hosting.

## Authority boundary

Repository URL, provider coordinate, branch, commit, path, file extension, build marker, generated patch, and observation ID are provenance or operational records. They do not mint semantic identity, establish an Idol world, prove behavior/equivalence, or grant repository/world authority.

The first slice is deliberately bounded:

- public repository metadata and tree entries only;
- exact resolved revision recorded before analysis;
- no provider credentials, checkout, archive download, source-file contents, submodule traversal, package execution, build, test, benchmark, repository write, branch, commit, or PR creation;
- candidate language/build/test/bench facts are explicitly observations with uncertainty;
- scaffold output is a downloadable preview/patch only;
- API tokens use explicit `repository:read`, `repository:observe`, and `repository:scaffold` scopes;
- every stored observation and scaffold is subject-owned and audited;
- the installer builds the pinned S0 Zig seed and records `self_hosted: false`.

## Vertical slice

1. Parse and admit only canonical public GitHub/GitLab/Bitbucket coordinates.
2. Resolve the requested ref through the provider API and pin an exact revision.
3. Fetch a bounded recursive tree projection with redirects disabled.
4. Publish deterministic inventory facts: paths, bytes, language candidates, build-system markers, CI, test and benchmark evidence.
5. Persist the observation in D1 under the authenticated subject and append audit metadata.
6. Generate selected scaffold capabilities: authority pin, project projection, build/test/bench/graph entry contract, and review-only CI.
7. Persist and display the scaffold with file tabs, unified patch, JSON export, and explicit `repository_written: false`.
8. Expose browser and scoped API transports.
9. Protect `/repo*` and `/v1/repository/browser/*` with a dedicated exact-owner Cloudflare Access application.
10. Package the new app, scripts, migrations, runtime contract, and corresponding navigation/page entries in the one immutable build.
11. Serve `/install`, `/install.sh`, and `/install.ps1` from the edge.
12. A push to `main` provisions Access/D1, applies migrations, builds, validates, deploys all pages, and emits deployment evidence.

## Routes

```text
GET  platform.idol.id/repo
GET  platform.idol.id/repo/observation/:id
GET  platform.idol.id/repo/scaffold/:id
GET  platform.idol.id/v1/repository/status
GET  platform.idol.id/v1/repository/browser/observations
POST platform.idol.id/v1/repository/browser/observe
GET  platform.idol.id/v1/repository/browser/observations/:id
POST platform.idol.id/v1/repository/browser/observations/:id/scaffolds
GET  platform.idol.id/v1/repository/browser/scaffolds
GET  platform.idol.id/v1/repository/browser/scaffolds/:id

GET/POST api.idol.id/v1/repository/api/*

GET idol.id/install
GET idol.id/install.sh
GET idol.id/install.ps1
```

## Data

`platform_repository_observation` stores the exact provider/revision plus the bounded immutable observation JSON. `platform_repository_scaffold` stores the selected capability set, generated files, patch, refusal or preview status, and source observation identity. Both are keyed by the platform subject and append audit events.

## UI

Desktop uses observation history, a central evidence workspace, and an exact-fact rail. Mobile uses list/detail/scaffold destinations, 44px targets, safe-area padding, no hover-only behavior, and reduced-motion support. Product prose is sans-serif; paths, hashes, patches, commands, and exact facts use Iosevka.

## Tests

- locator/SSRF and ref validation;
- bounded provider responses and redirect refusal;
- exact resolved revision and public-only refusal;
- deterministic inventory and scaffold generation;
- conflict refusal and no repository mutation;
- subject isolation and audit events;
- browser Access/origin proof and API scope separation;
- D1 encoding/decoding;
- build packaging, route mapping, Access destination reconciliation, installer exposure, and runtime contract;
- installer authority pin, no sudo/admin elevation, checkout verification, and honest bootstrap status;
- full `npm run check`, Wrangler dry-run, merged-main deployment, and live endpoint probes.

## Deferred

Private/provider-connected repositories, OAuth secrets, source-content ingestion, submodules/LFS, native runners, build/test/bench execution, semantic graph publication, generated foreign bindings, repository mutation, branches/PRs, transactional migration, equivalence witnesses, world publication, and self-hosted binary distribution remain later admitted programs.
