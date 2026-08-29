# MCP

Idol MCP is the stateless Streamable HTTP transport at:

```text
https://mcp.idol.id/mcp
```

It validates MCP framing, protocol version, authentication, per-tool scopes, bounded request bodies, bounded responses, and fixed upstream destinations. It delegates to existing authority-bound services. It does not parse source, own compiler semantics, mint graph identities, publish worlds, or become a second semantic authority.

## Current protocol

The current protocol projection is `2026-07-28`.

Current clients send:

```text
MCP-Protocol-Version: 2026-07-28
Mcp-Method: server/discover | tools/list | tools/call
Mcp-Name: idol.tool.name        # tools/call only
```

The server may report compatible protocol editions through `server/discover`, but no request creates server-side session state.

## Authentication and scopes

Every request requires a Platform API token with:

```text
mcp:connect
```

Each tool also requires its own scopes. Examples include:

```text
analysis:read
profile:read
world:read
universe:read
live:read
live:write
```

`mcp:connect` admits the transport. It does not imply any underlying tool authority.

## Canonical tool namespace

Tool coordinates use the `idol.*` namespace:

```text
idol.analyze
idol.authority
idol.profile
idol.worlds.list
idol.universe.list
idol.live.projects.list
```

Only exact canonical coordinates are accepted and returned. Tool spelling is a transport coordinate; it does not mint an operation identity inside the semantic graph.

## Discovery

```sh
curl https://mcp.idol.id/mcp \
  -H "Authorization: Bearer $IDOL_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: server/discover' \
  --data '{"jsonrpc":"2.0","id":"discover","method":"server/discover","params":{}}'
```

Discovery reports the exact protocol set, server identity, transport, endpoint, authentication boundary, cache scope, and the fact that semantic authority is false.

## Listing tools

```sh
curl https://mcp.idol.id/mcp \
  -H "Authorization: Bearer $IDOL_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/list' \
  --data '{"jsonrpc":"2.0","id":"tools","method":"tools/list","params":{}}'
```

`tools/list` returns canonical names, descriptions, input schemas, and exact required scopes. The public page also reads `/runtime/mcp-tools.json`, which is emitted from the same tool definitions used by the Worker. That projection is documentation, not a separate registry of semantic operations.

## Calling a tool

```sh
curl https://mcp.idol.id/mcp \
  -H "Authorization: Bearer $IDOL_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/call' \
  -H 'Mcp-Name: idol.authority' \
  --data '{"jsonrpc":"2.0","id":"authority","method":"tools/call","params":{"name":"idol.authority","arguments":{}}}'
```

For the current protocol, routing headers and the JSON-RPC body must agree exactly. A mismatched tool name fails before dispatch.

## Source analysis boundary

`idol.analyze` delegates to one fixed compiler-analysis endpoint. Source content is bounded and is not stored in MCP audit metadata. Audit records retain the canonical tool coordinate, source byte count, and source digest. They do not claim that successful transport proves full compiler support.

## Browser token handling

The MCP page keeps a token only in its password field. It does not write tokens to local storage, session storage, cookies, IndexedDB, or the URL. Pressing **Forget** clears the field and rendered response.

## Semantic boundary

MCP tool names are transport coordinates. Operation identities inside a compiler-published semantic graph remain relation identities. Structural edges remain roles such as `relation`, `subject`, `operand`, `result`, `witness`, and `provenance`; MCP never turns tool names into graph edge kinds.
