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
