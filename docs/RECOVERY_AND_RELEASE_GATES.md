# Recovery and release gates

No finite repository policy can guarantee that software will never contain another bug. The enforceable invariant is that every release requires a pull request, reviewable evidence, and green authority, regression, build, Worker, and production-convergence gates.

## Required pull request path

`main` is the deployment authority. Normal changes must enter through a required pull request. Branch protection or a repository ruleset should require the `verify` job, resolved review conversations, and disallow force pushes and deletion. The repository audit reports whether that external GitHub policy is actually enabled; documentation alone is not enforcement.

## Permanent executable gates

- one `runtime/authority.json` producer owns active authority facts;
- upstream drift is checked without silently accepting a changed source-law edition;
- web examples are bounded authority projections and never semantic authority;
- Wasm is admitted only with an artifact-bound descriptor and digest verification;
- every authored `.id`/`.idol` source has compiler/source-law provenance;
- every configured host is verified after deployment;
- scheduled drift audits open a pull request for commit-only upstream movement.

These controls cannot guarantee a bug-free future. They make known regression classes repeatably detectable and require explicit evidence before deployment.

## Release authority observation

`scripts/check-release-authority.sh` runs in the production job before any
Cloudflare operation, and after reconciliation before the bot proposes a PR.
It requires the existing private upstream read credential, delegates language
commit and law-edition checks to the existing upstream observer, and compares
the exact pinned native manifest with the same language commit and law blobs.
The native manifest is fetched publicly without sending the private credential.
Missing credentials, unreadable manifests and mismatches fail closed. The script
does not create credentials, change pins, enable a workflow or claim that a build,
runtime or performance test passed. It does not substitute latest native main for
the evidence-bound native pin.

`npm run authority:check` checks internal consistency, not upstream freshness.
The private-read preflight is deliberately absent from untrusted pull-request
verification. Its offline process controls run with fake readers and no network:

```sh
python3 test/release-authority-observation.py
```

Restoring the schedule still requires approved private-read access and semantic
review of incompatible authority editions. Changes to the native authority and
its realization evidence belong to the native owner. Do not replace law hashes
or bypass failing web tests merely to make deployment green.

The documented `npm run deploy` entry point also runs the same authority guard
and the full `npm run check` before invoking Wrangler. The guard is part of the
deploy command itself, not an optional npm lifecycle hook. Each failure stops the
following command and its status is preserved. Offline controls execute that
exact package command with recording fake readers, check runner and Wrangler.
They do not authorize or execute a deployment and cannot prevent a privileged
caller from invoking Wrangler or the provider API directly.
