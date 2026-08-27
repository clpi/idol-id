const PROTOCOL = "2026-07-28";
const BODY_LIMIT = 64 * 1024;
const TTL_MS = 300_000;
const ALLOWED_ORIGINS = new Set([
  "https://mcp.idol.id",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
]);

const TOOL_DEFINITIONS = Object.freeze([
  {
    name: "idol.authority",
    description: "Return the exact pinned Idol language and native realization authority projection.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "idol.graph.contract",
    description: "Return the versioned structural semantic-graph contract consumed by Idol web projections.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "idol.graph.query",
    description: "Check whether a graph edge role is structural. Operation words remain relation identities.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["role"],
      properties: { role: { type: "string", minLength: 1, maxLength: 96 } },
    },
  },
  {
    name: "idol.live.project",
    description: "Return one bounded read-only lens over the current Idol Live bootstrap projection.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["lens"],
      properties: { lens: { type: "string", minLength: 1, maxLength: 64 } },
    },
  },
  {
    name: "idol.live.status",
    description: "Return the exact implemented and unavailable Idol Live capabilities.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "idol.orientation",
    description: "Explain the authority boundary between Idol, idol-native, Idol Live, MCP, and the web projection.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "idol.wasm.run",
    description: "Run the admitted bounded Idol Wasm runtime when one is deployed; otherwise return an exact refusal.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { outputLimit: { type: "integer", minimum: 1, maximum: 1_048_576 } },
    },
  },
  {
    name: "idol.wasm.status",
    description: "Return the deployed Idol Wasm artifact and admission status without inferring availability.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
].sort((left, right) => left.name.localeCompare(right.name)));

function json(value, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}

function rpcResult(id, result) {
  return json({ jsonrpc: "2.0", id, result });
}

function rpcError(id, code, message, data, status = 400) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return json({ jsonrpc: "2.0", id: id ?? null, error }, { status });
}

function cacheable(value) {
  return { resultType: "complete", ...value, ttlMs: TTL_MS, cacheScope: "public" };
}

function textResult(structuredContent, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError,
  };
}

function assetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  return new Request(url, { method: "GET", headers: { accept: "application/json" } });
}

async function readAsset(env, request, pathname) {
  const response = await env.ASSETS.fetch(assetRequest(request, pathname));
  if (!response.ok) throw new Error(`runtime projection unavailable: ${pathname} (${response.status})`);
  try {
    return await response.json();
  } catch {
    throw new Error(`runtime projection is invalid JSON: ${pathname}`);
  }
}

async function readBody(request) {
  const announced = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(announced) && announced > BODY_LIMIT) throw new RangeError("MCP request body too large");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > BODY_LIMIT) throw new RangeError("MCP request body too large");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new SyntaxError("MCP request body is not valid JSON");
  }
}

function validateMeta(body) {
  const meta = body?.params?._meta;
  if (!meta || typeof meta !== "object") throw new TypeError("MCP request params._meta is required");
  if (meta["io.modelcontextprotocol/protocolVersion"] !== PROTOCOL) throw new RangeError("unsupported MCP protocol version");
  const client = meta["io.modelcontextprotocol/clientInfo"];
  if (!client || typeof client.name !== "string" || typeof client.version !== "string") {
    throw new TypeError("MCP clientInfo name and version are required");
  }
  const capabilities = meta["io.modelcontextprotocol/clientCapabilities"];
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    throw new TypeError("MCP clientCapabilities object is required");
  }
}

function validateHeaders(request, body) {
  const version = request.headers.get("mcp-protocol-version");
  if (version !== PROTOCOL) throw new RangeError("unsupported MCP-Protocol-Version header");
  const method = request.headers.get("mcp-method");
  if (!method) throw new TypeError("Mcp-Method header is required");
  if (method !== body.method) throw new TypeError("Mcp-Method header does not match request body");
  if (body.method === "tools/call") {
    const name = request.headers.get("mcp-name");
    if (!name) throw new TypeError("Mcp-Name header is required for tools/call");
    if (name !== body?.params?.name) throw new TypeError("Mcp-Name header does not match request body");
  }
}

function validateRequest(request, body) {
  if (!body || body.jsonrpc !== "2.0" || !("id" in body) || typeof body.method !== "string") {
    throw new TypeError("MCP request must be a JSON-RPC 2.0 request with id and method");
  }
  validateHeaders(request, body);
  validateMeta(body);
}

function orientation(authority) {
  return {
    schema: "idol.mcp.orientation.v1",
    language: { repository: authority.language.repository, commit: authority.language.commit, role: "sole semantic authority" },
    native: { repository: authority.native.repository, commit: authority.native.commit, role: "realization and evidence" },
    live: { role: "collaboration truth", semantic_authority: false },
    mcp: { role: "stateless read-only graph projection", semantic_authority: false },
    web: { repository: "clpi/idol-id", role: "transport and presentation", semantic_authority: false },
  };
}

function graphQuery(graph, argument) {
  const role = String(argument?.role || "");
  const structural = new Set(graph.structural_roles || []);
  const operational = new Set(graph.forbidden_operational_roles || []);
  if (structural.has(role)) return { schema: "idol.mcp.graph-query.v1", role, admitted: true, kind: "structural-role" };
  if (operational.has(role)) {
    return {
      schema: "idol.mcp.graph-query.v1",
      role,
      admitted: false,
      kind: "relation-identity",
      reason: `${role} is an operation/relation identity, not a structural edge role`,
    };
  }
  return {
    schema: "idol.mcp.graph-query.v1",
    role,
    admitted: false,
    kind: "unknown",
    reason: "role is not published by this graph-contract revision",
  };
}

function liveProject(live, argument) {
  const lens = String(argument?.lens || "");
  if (!(live.lenses || []).includes(lens)) {
    return { schema: "idol.mcp.live-project.v1", lens, admitted: false, available: false, reason: "lens is not published" };
  }
  const base = {
    schema: "idol.mcp.live-project.v1",
    lens,
    admitted: true,
    semantic_authority: false,
    canonical_frontiers: live.state?.canonical_frontiers ?? 0,
  };
  if (lens === "history") return { ...base, history: live.history, frontier: live.frontier };
  if (lens === "canon") return { ...base, frontier: live.frontier, state: live.state };
  if (lens === "evidence") return { ...base, evidence: live.evidence || [], capability: live.capabilities?.evidence || false };
  return { ...base, available: false, reason: "lens contract is published; persistent product data is not implemented" };
}

async function callTool(name, argument, env, request) {
  if (!TOOL_DEFINITIONS.some((tool) => tool.name === name)) {
    return textResult({ error: "MCP_TOOL_NOT_FOUND", name }, true);
  }
  try {
    if (name === "idol.authority") return textResult(await readAsset(env, request, "/runtime/authority.json"));
    if (name === "idol.graph.contract") return textResult(await readAsset(env, request, "/runtime/semantic-graph-contract.json"));
    if (name === "idol.graph.query") return textResult(graphQuery(await readAsset(env, request, "/runtime/semantic-graph-contract.json"), argument));
    if (name === "idol.live.status") return textResult(await readAsset(env, request, "/runtime/live.json"));
    if (name === "idol.live.project") return textResult(liveProject(await readAsset(env, request, "/runtime/live.json"), argument));
    if (name === "idol.orientation") return textResult(orientation(await readAsset(env, request, "/runtime/authority.json")));
    if (name === "idol.wasm.status") {
      const manifest = await readAsset(env, request, "/runtime/manifest.json");
      return textResult({ schema: "idol.mcp.wasm-status.v1", ...manifest.wasm });
    }
    if (name === "idol.wasm.run") {
      const manifest = await readAsset(env, request, "/runtime/manifest.json");
      return textResult({
        error: "IDOL_WASM_NOT_ADMITTED",
        available: Boolean(manifest.wasm?.available),
        admitted: false,
        executed: false,
        reason: "no artifact-bound native/Wasm correspondence witness is deployed",
      }, true);
    }
  } catch (error) {
    return textResult({ error: "MCP_PROJECTION_UNAVAILABLE", detail: error.message }, true);
  }
  return textResult({ error: "MCP_TOOL_NOT_IMPLEMENTED", name }, true);
}

async function dispatch(body, env, request) {
  if (body.method === "server/discover") {
    return cacheable({
      supportedVersions: [PROTOCOL],
      capabilities: { tools: { listChanged: false } },
      _meta: { "io.modelcontextprotocol/serverInfo": { name: "idol-semantic-graph", version: "1" } },
      instructions: "Read-only projections of exact Idol authority, graph, Live bootstrap state, and Wasm admission status.",
    });
  }
  if (body.method === "tools/list") return cacheable({ tools: TOOL_DEFINITIONS });
  if (body.method === "tools/call") return callTool(body.params?.name, body.params?.arguments || {}, env, request);
  return null;
}

export async function handleMcpTransport(request, env, pathname, info) {
  if (info?.surface !== "mcp" || pathname !== "/mcp") return null;
  if (request.method !== "POST") return json({ error: "MCP_POST_REQUIRED" }, { status: 405, headers: { allow: "POST" } });

  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "MCP_ORIGIN_REFUSED" }, { status: 403 });
  if (!String(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return rpcError(null, -32600, "Content-Type must be application/json", undefined, 415);
  }

  let body;
  try {
    body = await readBody(request);
    validateRequest(request, body);
  } catch (error) {
    const status = error instanceof RangeError && /too large/i.test(error.message) ? 413 : 400;
    return rpcError(body?.id ?? null, -32600, error.message, undefined, status);
  }

  const result = await dispatch(body, env, request);
  if (result === null) return rpcError(body.id, -32601, `Method not found: ${body.method}`, undefined, 404);
  return rpcResult(body.id, result);
}

export const MCP_PROTOCOL_VERSION = PROTOCOL;
export const MCP_TOOL_DEFINITIONS = TOOL_DEFINITIONS;
