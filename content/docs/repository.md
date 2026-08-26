# Repository Observatory

`platform.idol.id/repo` observes one exact public repository revision and builds review-only Idol adoption artifacts from provider metadata and tree paths.

## Observation boundary

Supported coordinates are credential-free public repositories on:

- GitHub
- GitLab
- Bitbucket

The Observatory resolves the requested ref to an exact provider revision before persisting the observation. It records bounded metadata, file paths, sizes where supplied, language candidates, build-system markers, CI paths, test paths, and benchmark paths.

It does **not** download source-file contents, check out a repository, execute a process, infer semantic identity, grant a world, or prove behavior.

## Review-only scaffolds

A scaffold can project selected capabilities into generated `.idol` authority/project files, documentation, and optional CI. The output is downloadable as JSON or a unified patch.

Scaffolds remain explicit previews:

```text
executed            false
repository_written  false
semantic_id         null
identity_status     not-published
```

Conflicting paths and incomplete provider inventories fail closed rather than overwriting or claiming a path is unused.

## Derived-world transformation previews

Program N can project one exact scaffold delta into an isolated derived-world preview. The user chooses the scaffold files, records a bounded intent, and requests unresolved evidence such as build, test, benchmark, graph, or semantic-diff evidence.

The resulting envelope retains:

```text
parent observation and exact revision
parent scaffold
selected files
filtered deterministic patch
patch SHA-256
transformation face
candidate derived-world facts
required but ungranted worlds/capabilities
requested evidence with status unexecuted
```

A preview never implies execution or authority:

```text
semantic_id          null
identity_status      not-published
executed             false
source_world_mutated false
repository_written   false
world_published      false
```

Filesystem write, process execution, provider write, repository mutation, and world publication remain separate `not-granted` facts. The preview is evidence-ready input for later native runners; it is not itself a migration, equivalence witness, branch, commit, pull request, or published world.

## Authentication and ownership

Browser workflows are protected by Cloudflare Access and require same-origin request proof for writes. Observations, scaffolds, transformations, and audit events are scoped to the verified subject.

API-token scopes are separate:

```text
repository:read
repository:observe
repository:scaffold
repository:transform
```

`repository:transform` authorizes creation of a preview record only. It does not grant any world capability, provider credential, repository write, or execution authority.

## Installation

The root domain provides user-local bootstrap installers:

```sh
curl -fsSL https://idol.id/install | sh
```

```powershell
irm https://idol.id/install.ps1 | iex
```

The installers verify the exact canonical `clpi/idol` checkout and build a Zig `ReleaseFast` bootstrap seed. The authority record states `self_hosted: false`; this is not represented as a signed prebuilt or self-hosted release.
