export const MCP_CURRENT_PROTOCOL = "2026-07-28";
export const MCP_PROTOCOLS = Object.freeze([
  MCP_CURRENT_PROTOCOL,
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]);

const OBJECT = Object.freeze({ type: "object", additionalProperties: false, properties: Object.freeze({}) });
function schema(properties = {}, required = []) {
  return Object.freeze({ type: "object", additionalProperties: false, properties: Object.freeze(properties), ...(required.length ? { required: Object.freeze(required) } : {}) });
}
const PROJECT = Object.freeze({ type: "string", pattern: "^lp_[A-Za-z0-9_-]{12,}$" });
const NODE = Object.freeze({ type: "string", pattern: "^ln_[A-Za-z0-9_-]{12,}$" });
const APPLICATION = Object.freeze({ type: "string", pattern: "^la_[A-Za-z0-9_-]{12,}$" });
const EVENT = Object.freeze({ type: "string", pattern: "^le_[A-Za-z0-9_-]{12,}$" });
const TEXT = (maximum = 2048) => Object.freeze({ type: "string", minLength: 1, maxLength: maximum });
const STRING_ARRAY = (maximum = 64) => Object.freeze({ type: "array", maxItems: maximum, items: Object.freeze({ type: "string" }) });

const tools = [
  {
    name: "idol.analyze",
    description: "Analyze bounded Idol source through the fixed canonical compiler-analysis endpoint. Source text is never stored in MCP audit metadata.",
    scopes: ["analysis:read"],
    inputSchema: schema({ source: Object.freeze({ type: "string", minLength: 1, maxLength: 524288 }) }, ["source"]),
  },
  {
    name: "idol.authority",
    description: "Read the immutable Idol language, native, and source-law authority projection for this deployment.",
    scopes: ["profile:read"],
    inputSchema: OBJECT,
  },
  {
    name: "idol.live.application.create",
    description: "Publish one Live collaboration application record. The relation is an operation identity; graph edges remain derived structural roles.",
    scopes: ["live:write"],
    inputSchema: schema({
      project_id: PROJECT,
      relation: TEXT(200),
      subject: NODE,
      target: Object.freeze({ anyOf: [NODE, { type: "null" }] }),
      operands: STRING_ARRAY(64),
      results: STRING_ARRAY(64),
      worlds: STRING_ARRAY(64),
      witnesses: STRING_ARRAY(64),
      demand: Object.freeze({ type: "object" }),
      provenance: Object.freeze({ type: "object" }),
    }, ["project_id", "relation", "subject"]),
  },
  {
    name: "idol.live.event.append",
    description: "Append an immutable causal event to a Live project history.",
    scopes: ["live:write"],
    inputSchema: schema({
      project_id: PROJECT,
      kind: TEXT(40),
      predecessor_ids: STRING_ARRAY(64),
      intent_id: Object.freeze({ anyOf: [NODE, { type: "null" }] }),
      application_ids: Object.freeze({ type: "array", maxItems: 128, items: APPLICATION }),
      payload: Object.freeze({ type: "object" }),
    }, ["project_id", "kind"]),
  },
  {
    name: "idol.live.frontier.set",
    description: "Append a held/admitted/rejected/superseded/reversed frontier decision; admission fails unless predecessors are already admitted.",
    scopes: ["live:write"],
    inputSchema: schema({ project_id: PROJECT, event_id: EVENT, state: Object.freeze({ type: "string", enum: ["held", "admitted", "rejected", "superseded", "reversed"] }), reason: TEXT(2048) }, ["project_id", "event_id", "state", "reason"]),
  },
  {
    name: "idol.live.graph.get",
    description: "Read the exact derived Live collaboration graph, causal history, frontier, and reverse indexes for one subject-owned project.",
    scopes: ["live:read"],
    inputSchema: schema({ project_id: PROJECT }, ["project_id"]),
  },
  {
    name: "idol.live.node.create",
    description: "Create a bounded Live domain node such as a goal, task, attempt, intent, claim, review, witness, or evidence record.",
    scopes: ["live:write"],
    inputSchema: schema({ project_id: PROJECT, category: TEXT(40), label: TEXT(200), summary: TEXT(2048), data: Object.freeze({ type: "object" }) }, ["project_id", "category", "label", "summary"]),
  },
  {
    name: "idol.live.project.create",
    description: "Create one subject-owned Live project with one immutable history and one accepted frontier.",
    scopes: ["live:write"],
    inputSchema: schema({ name: TEXT(120), slug: Object.freeze({ type: "string", pattern: "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$" }), summary: TEXT(1024), visibility: Object.freeze({ type: "string", enum: ["private", "public"] }) }, ["name", "slug", "summary"]),
  },
  {
    name: "idol.live.project.get",
    description: "Read one subject-owned Live project record.",
    scopes: ["live:read"],
    inputSchema: schema({ project_id: PROJECT }, ["project_id"]),
  },
  {
    name: "idol.live.projects.list",
    description: "List bounded summaries of the authenticated subject's Live projects.",
    scopes: ["live:read"],
    inputSchema: schema({ limit: Object.freeze({ type: "integer", minimum: 1, maximum: 100 }) }),
  },
  {
    name: "idol.live.world.bind",
    description: "Bind a subject-owned Universe View to a Live project as an operational projection reference with no authority grant or world publication.",
    scopes: ["live:write", "universe:read"],
    inputSchema: schema({ project_id: PROJECT, universe_view_id: Object.freeze({ type: "string", pattern: "^uv_[A-Za-z0-9_-]{12,}$" }) }, ["project_id", "universe_view_id"]),
  },
  {
    name: "idol.profile",
    description: "Read the authenticated API-token principal and transport-authority boundary.",
    scopes: ["profile:read"],
    inputSchema: OBJECT,
  },
  {
    name: "idol.universe.list",
    description: "List the authenticated subject's operational Universe Views; views do not mint another semantic universe or authority.",
    scopes: ["universe:read"],
    inputSchema: schema({ limit: Object.freeze({ type: "integer", minimum: 1, maximum: 100 }) }),
  },
  {
    name: "idol.worlds.list",
    description: "Read the deployed published and foreign-origin world projections without manufacturing semantic identity or authority.",
    scopes: ["world:read"],
    inputSchema: OBJECT,
  },
].sort((left, right) => left.name.localeCompare(right.name)).map((tool) => Object.freeze({ ...tool, scopes: Object.freeze([...tool.scopes]) }));

export const MCP_TOOLS = Object.freeze(tools);
export const MCP_TOOL_INDEX = Object.freeze(Object.fromEntries(MCP_TOOLS.map((tool) => [tool.name, tool])));

export function mcpToolPublic(tool) {
  return Object.freeze({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    requiredScopes: Object.freeze(["mcp:connect", ...tool.scopes]),
  });
}
export function mcpDiscovery() {
  return Object.freeze({
    protocolVersion: MCP_CURRENT_PROTOCOL,
    supportedProtocolVersions: MCP_PROTOCOLS,
    serverInfo: Object.freeze({ name: "idsem-hosted-mcp", version: "0.1.0" }),
    capabilities: Object.freeze({ tools: Object.freeze({ listChanged: false }) }),
    cacheScope: "private",
    ttlMs: 30_000,
    transport: "streamable-http-stateless",
    endpoint: "https://mcp.idol.id/mcp",
    authentication: "Bearer platform API token with mcp:connect",
    semanticAuthority: false,
  });
}
export function mcpToolResult(value) {
  const structuredContent = value === undefined ? null : value;
  return Object.freeze({
    content: Object.freeze([{ type: "text", text: JSON.stringify(structuredContent) }]),
    structuredContent,
    isError: false,
  });
}
export function mcpToolError(code, message) {
  return Object.freeze({
    content: Object.freeze([{ type: "text", text: `${code}: ${message}` }]),
    structuredContent: Object.freeze({ error: code, detail: message }),
    isError: true,
  });
}
