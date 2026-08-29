# Universe Views

Universe Views are saved **operational projections** over exact world records in Idol’s one semantic universe. A Universe View is **not a second semantic universe**. It lets a user preserve a useful constellation, lens, query intent, visibility choice, and evidence policy without manufacturing language authority.

## Product surfaces

- `https://platform.idol.id/universe` manages private and public views under an independently verified Platform identity.
- `https://lib.idol.id/universe/:id` renders a public view as an immutable read-only projection.
- `https://worlds.idol.id/universe/:id` is a path-preserving compatibility alias to the canonical Lib route; it is not an independent product or authority.
- `https://api.idol.id/v1/universe/api/*` provides scoped token transport.

The same `clpi/idol-id/main` build packages and deploys these routes with every other Idol surface.

## Exact selection

A view selects origin-qualified records rather than joining by display name:

```text
published : package-world-name@version
foreign   : provenance slug
```

Published graph identities remain strings. Foreign-origin candidates retain:

```json
{
  "semantic_id": null,
  "identity_status": "not-published"
}
```

Unknown and duplicate references fail closed. A view may contain at most 32 unique selections.

## Lenses

- **constellation** reports the selected records and their published origin/evidence facts;
- **reach** displays only reachability facts that are already published and otherwise reports refusal;
- **authority** displays declared world and capability requirements but does not grant them;
- **projection** displays artifact, evidence, obligation, and refusal facts;
- **security** highlights unpublished identity, unverified projections, uncertainty, and selected policy violations.

A lens is presentation/query state. It is not a new language relation or semantic kind.

## Boundary

Every view publishes the same non-negotiable boundary:

```text
semantic universes    1
view kind             operational-projection
composition           not-proven
reachability          published-facts-only
compatibility         not-proven
equivalence           not-proven
injection             not-proven
authority grant       none
source world mutation false
world publication     false
dispatcher access     false
```

A zero-refusal view does not prove compatibility or composition. It only means none of the selected **view policies** refused the currently published facts.

## Visibility

Private records are owned by the authenticated Platform subject and never appear through the canonical Lib public transport. A public view exposes only the bounded public projection; subject, email, audit metadata, and private operational data are omitted.

Public visibility is not semantic publication. Universe View identities keep:

```json
{
  "semantic_id": null,
  "identity_status": "not-published"
}
```

## API authority

API tokens use exact scopes:

```text
universe:read
universe:write
```

The token authorizes a Platform request. It is not a world grant. Browser mutations additionally require Cloudflare Access identity and same-origin browser proof.

## Persistence and evidence

Universe View records and their audit events commit atomically in D1. Lists return bounded summaries; detail routes return the complete view. Public reads return the public projection only.

The immutable published-world and foreign-candidate snapshots used to resolve selections are packaged with the same web deployment. The view cannot silently resolve against an unrelated catalog revision.

## Mobile and accessibility

The workspace is usable at 320 px width with touch-sized controls, safe-area padding, bottom navigation, keyboard-accessible controls, and reduced-motion support. Product prose uses the shared sans-serif face; exact IDs, graph identities, scopes, and machine facts use Iosevka.

## Deliberately absent

Program O does not add:

- world composition or injection witnesses;
- authority or capability grants;
- repository/provider mutation;
- native build, test, or benchmark execution;
- shell sessions;
- agent dispatch;
- a second universe ontology.

Agent dispatch, Hermes, Telegram, ntfy, polling ownership, and dispatcher topology are outside the Universe View semantic boundary and are not modified by this surface.
