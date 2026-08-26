# Program N — Derived-world transformation previews

**Status:** RED contracts committed; implementation absent

## Goal

Ship the first honest Program N vertical slice on `platform.idol.id/repo`: convert one exact, subject-owned repository scaffold into a persisted derived-world transformation **preview**.

The preview is a reviewable semantic/provenance envelope around an existing patch. It does not execute a metaprogram, mutate the source world, write a repository, create a branch or pull request, publish a world, or claim semantic identity/equivalence.

## Invariants

1. The parent is one exact repository observation and one exact scaffold owned by the authenticated subject.
2. Only files already present in the scaffold may be selected.
3. The selected patch is deterministic and receives a SHA-256 digest.
4. `semantic_id` remains `null`; `identity_status` remains `not-published`.
5. Source world, derived world, transformation, authority, grants, evidence, and repository transport remain distinct facts.
6. Every capability required for execution or publication is represented as `not-granted`.
7. `executed`, `source_world_mutated`, `repository_written`, and `world_published` remain `false`.
8. Preview/refusal records and their audit events commit atomically.
9. History endpoints return bounded summaries; exact detail is fetched separately.
10. Browser writes require verified Access identity and same-origin proof. API writes require `repository:transform`.
11. No Grok, Hermes, Telegram, ntfy, dispatcher, agent queue, or host-process surface is touched.

## Data contract

`idol.web.repository.transformation.v1`

- observation/scaffold provenance
- parent exact revision
- selected files and deterministic patch
- patch SHA-256
- transformation face and non-published identity
- candidate derived-world facts
- required-but-ungranted worlds/capabilities
- requested and unresolved evidence
- exact refusal when the scaffold cannot be transformed
- explicit non-execution/non-mutation booleans

A separate `idol.web.repository.transformation.summary.v1` projection is used for list/history responses.

## Storage

Migration `0005_repository_transformation.sql` creates a new append-only table with:

- subject ownership
- observation and scaffold references
- status
- selected-file count
- evidence status
- refusal code
- full document
- creation time

D1 and the local memory store expose atomic commit, bounded list, and exact get operations.

## Transport

Browser/API routes:

```text
GET  transformations
GET  transformations/:id
POST scaffolds/:id/transformations
```

API token scope:

```text
repository:transform
```

## UI

The Repository Observatory gains a fourth `Transform` lens and exact transformation deep links. It can:

- choose scaffold files;
- state an intent;
- request build/test/bench/graph/semantic-diff evidence;
- create a preview;
- inspect parent/derived-world separation, grants, evidence, patch digest, and exact delta;
- download the transformation envelope and patch.

Program N on `platform.idol.id` is marked **preview live**, not fully implemented.

## Tests and landing

1. Commit RED contracts first.
2. Implement core projection, storage, service, transport, scope, UI, docs, runtime manifest, and migrations.
3. Pass focused authority/transport tests, the full suite/build, and Wrangler dry-run.
4. Complete review; resolve every finding with regression evidence.
5. Merge to `main`.
6. Observe migration/deployment and probe all ten live hosts plus Program N endpoints.
