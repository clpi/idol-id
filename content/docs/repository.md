# Repository Observatory

`platform.idol.id/repo` is the protected repository-observation and adoption-scaffold surface.

It admits only public, credential-free GitHub, GitLab, and Bitbucket coordinates. The provider resolves the requested ref to an exact revision; the platform records bounded repository metadata and tree entries, then derives presentation facts such as language candidates, build-system markers, CI, tests, and benchmark evidence.

```text
repository URL/ref
→ admitted provider coordinate
→ exact provider revision
→ bounded public tree projection
→ provenance-qualified observation
→ optional review-only scaffold
```

The observation is not a semantic graph, world, equivalence witness, or repository authority. Paths, extensions, manifests, branches, and commit hashes remain provenance. Source contents are not fetched in Program M.

Scaffolds can preview authority, build, test, benchmark, CI, and graph integration files. They are downloadable JSON/patches with `repository_written: false`; the service does not create a branch, commit, pull request, or provider webhook.

Browser operations require the exact-owner Cloudflare Access identity, same-origin browser proof, D1 persistence, and audit. API operations require explicit Idol token scopes:

```text
repository:read
repository:observe
repository:scaffold
```

## Installation

```sh
curl -fsSL https://idol.id/install | sh
```

```powershell
irm https://idol.id/install.ps1 | iex
```

These scripts install the exact pinned Zig-built bootstrap seed in a user-local prefix. They verify the Git checkout and write an authority record with `self_hosted: false`. No production self-hosted compiler release is claimed.
