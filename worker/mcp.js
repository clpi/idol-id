import { bearerToken } from "../shared/platform-auth.js";
import { createD1PlatformRepository } from "../shared/platform-d1.js";
import { createPlatformService, PlatformError } from "../shared/platform.js";
import { createD1LiveStore } from "../shared/live-d1.js";
import { createLiveService } from "../shared/live-service.js";
import { catalogUniverseWorlds } from "../shared/universe.js";
import { createD1UniverseStore } from "../shared/universe-d1.js";
import { createUniverseService } from "../shared/universe-service.js";
import {
  MCP_CURRENT_PROTOCOL,
  MCP_PROTOCOLS,
  MCP_TOOLS,
  MCP_TOOL_INDEX,
  mcpDiscovery,
  mcpToolError,
  mcpToolPublic,
  mcpToolResult,
} from "../shared/mcp.js";

const BODY_LIMIT = 64 * 1024;
const RESULT_LIMIT = 4 * 1024 * 1024;
const SOURCE_LIMIT = 512 * 1024;
const encoder = new TextEncoder();
const CATALOG_CACHE = new Map();

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function transportError(code, detail, status) { return json({ error: { code, detail } }, status); }
function rpcResult(id, result) { return json({ jsonrpc: "2.0", id, result }); }
function rpcError(id, code, message, data = undefined, status = 200) {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } }, status);
}
function textBytes(value) { return encoder.encode(String(value)).byteLength; }
function supportedProtocol(value) {
  const protocol = String(value || "").trim();
  return MCP_PROTOCOLS.includes(protocol) ? protocol : null;
}
function admittedOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === "https://mcp.idol.id";
}
function routeHeadersMatch(request, document, protocol) {
  if (protocol !== MCP_CURRENT_PROTOCOL) return true;
  const method = request.headers.get("mcp-method");
  if (!method || method !== document.method) return false;
  const name = request.headers.get("mcp-name");
  if (document.method === "tools/call") return Boolean(name && name === document.params?.name);
  return !name;
}
async function readDocument(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json")) throw Object.assign(new Error("application/json request required"), { code: "MCP_JSON_REQUIRED", status: 415 });
  const announced = Number(request.headers.get("content-length") || 0);
  if (announced > BODY_LIMIT) throw Object.assign(new Error("MCP request body is too large"), { code: "MCP_BODY_TOO_LARGE", status: 413 });
  const raw = await request.text();
  if (textBytes(raw) > BODY_LIMIT) throw Object.assign(new Error("MCP request body is too large"), { code: "MCP_BODY_TOO_LARGE", status: 413 });
  let document;
  try { document = JSON.parse(raw); } catch { throw Object.assign(new Error("MCP request body must be valid JSON"), { code: "MCP_INVALID_JSON", status: 400 }); }
  if (!document || typeof document !== "object" || Array.isArray(document) || document.jsonrpc !== "2.0" || typeof document.method !== "string") {
    throw Object.assign(new Error("invalid JSON-RPC request"), { code: "MCP_INVALID_REQUEST", status: 400 });
  }
  return document;
}
function platform(env, dependencies) {
  if (dependencies.platformService) return dependencies.platformService;
  const repository = dependencies.platformRepository || (env.PLATFORM_DB?.prepare ? createD1PlatformRepository(env.PLATFORM_DB) : null);
  if (!repository) throw Object.assign(new Error("platform token storage unavailable"), { code: "MCP_STORAGE_UNAVAILABLE", status: 503 });
  return createPlatformService({ repository, now: dependencies.now, randomBytes: dependencies.randomBytes });
}
async function assetJson(request, env, path) {
  if (!env.ASSETS?.fetch) throw Object.assign(new Error(`asset unavailable: ${path}`), { code: "MCP_PROJECTION_UNAVAILABLE", status: 503 });
  const url = new URL(path, request.url);
  const response = await env.ASSETS.fetch(new Request(url, { headers: { accept: "application/json" } }));
  if (!response.ok) throw Object.assign(new Error(`asset unavailable: ${path}`), { code: "MCP_PROJECTION_UNAVAILABLE", status: 503 });
  return response.json();
}
async function catalogs(request, env, dependencies) {
  if (dependencies.catalogs) return dependencies.catalogs;
  const key = `${env.IDOL_COMMIT || "deployment"}:${env.IDOL_AUTHORITY || "authority"}`;
  if (!CATALOG_CACHE.has(key)) {
    CATALOG_CACHE.set(key, Promise.all([
      assetJson(request, env, "/runtime/worlds.json"),
      assetJson(request, env, "/runtime/foreign.json"),
    ]).then(([worldManifest, foreignManifest]) => catalogUniverseWorlds(worldManifest, foreignManifest)));
  }
  try { return await CATALOG_CACHE.get(key); } catch (error) { CATALOG_CACHE.delete(key); throw error; }
}
async function universe(request, env, dependencies) {
  if (dependencies.universeService) return dependencies.universeService;
  if (!env.PLATFORM_DB?.prepare || !env.PLATFORM_DB?.batch) throw Object.assign(new Error("Universe storage unavailable"), { code: "MCP_STORAGE_UNAVAILABLE", status: 503 });
  return createUniverseService({ store: createD1UniverseStore(env.PLATFORM_DB), catalogs: await catalogs(request, env, dependencies), now: dependencies.now, randomBytes: dependencies.randomBytes });
}
async function live(request, env, dependencies) {
  const store = dependencies.liveStore || (env.PLATFORM_DB?.prepare ? createD1LiveStore(env.PLATFORM_DB) : null);
  if (!store) throw Object.assign(new Error("Live storage unavailable"), { code: "MCP_STORAGE_UNAVAILABLE", status: 503 });
  return createLiveService({ store, universe: await universe(request, env, dependencies), now: dependencies.now, randomBytes: dependencies.randomBytes });
}
function requireScopes(principal, required) {
  const missing = required.find((scope) => !principal.scopes.includes(scope));
  if (missing) throw Object.assign(new Error(`API token lacks scope ${missing}`), { code: "API_TOKEN_SCOPE_REFUSED", status: 403 });
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function auditId(dependencies) {
  if (dependencies.idFactory) return String(dependencies.idFactory());
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = (dependencies.randomBytes || ((length) => crypto.getRandomValues(new Uint8Array(length))))(16);
  return `mcp_${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
async function appendToolAudit(env, dependencies, principal, toolName, args) {
  const repository = dependencies.platformRepository || (env.PLATFORM_DB?.prepare ? createD1PlatformRepository(env.PLATFORM_DB) : null);
  if (!repository?.appendAudit) return;
  const metadata = { tool: toolName };
  if (toolName === "idsem.analyze") {
    metadata.source_bytes = textBytes(args.source || "");
    metadata.source_hash = await sha256(args.source || "");
  }
  await repository.appendAudit({
    id: auditId(dependencies),
    subject: principal.subject,
    actor_email: principal.email,
    type: "mcp.tool.called",
    target: toolName,
    metadata,
    created_at: dependencies.now ? new Date(dependencies.now()).toISOString() : new Date().toISOString(),
  });
}
async function analyze(source, dependencies) {
  if (typeof source !== "string" || !source || textBytes(source) > SOURCE_LIMIT) throw Object.assign(new Error("source must contain 1 to 524288 UTF-8 bytes"), { code: "MCP_TOOL_INPUT_INVALID", status: 422 });
  const init = {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-idol-request": "hosted-mcp-analysis" },
    body: JSON.stringify({ source }),
    redirect: "manual",
  };
  const fetcher = dependencies.analyzeFetcher || fetch;
  let response;
  try {
    response = dependencies.analyzeFetcher
      ? await fetcher("https://api.idol.id/api/analyze", init)
      : await fetcher(new Request("https://api.idol.id/api/analyze", init));
  } catch {
    throw Object.assign(new Error("compiler analysis unavailable"), { code: "MCP_ANALYSIS_UNAVAILABLE", status: 502 });
  }
  if (response.status >= 300 && response.status < 400) throw Object.assign(new Error("compiler analysis redirect refused"), { code: "MCP_ANALYSIS_REDIRECT_REFUSED", status: 502 });
  if (!response.ok) throw Object.assign(new Error(`compiler analysis refused (${response.status})`), { code: "MCP_ANALYSIS_REFUSED", status: 502 });
  const raw = await response.text();
  if (textBytes(raw) > RESULT_LIMIT) throw Object.assign(new Error("compiler analysis result too large"), { code: "MCP_ANALYSIS_RESULT_TOO_LARGE", status: 502 });
  try {
    const result = JSON.parse(raw);
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    return result;
  } catch {
    throw Object.assign(new Error("compiler analysis result is invalid"), { code: "MCP_ANALYSIS_INVALID", status: 502 });
  }
}
async function executeTool(name, args, principal, request, env, dependencies) {
  const tool = MCP_TOOL_INDEX[name];
  if (!tool) throw Object.assign(new Error(`unknown tool: ${name}`), { code: "MCP_TOOL_NOT_FOUND", status: 404 });
  requireScopes(principal, tool.scopes);
  const input = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  let result;
  switch (name) {
    case "idsem.authority": result = await assetJson(request, env, "/runtime/authority.json"); break;
    case "idsem.profile": result = principal; break;
    case "idsem.worlds.list": result = {
      published: await assetJson(request, env, "/runtime/worlds.json"),
      foreign: await assetJson(request, env, "/runtime/foreign.json"),
      authority_grant: "none",
    }; break;
    case "idsem.universe.list": result = { views: await (await universe(request, env, dependencies)).listViews(principal, Number(input.limit || 50)) }; break;
    case "idsem.live.projects.list": result = { projects: await (await live(request, env, dependencies)).listProjects(principal, Number(input.limit || 50)) }; break;
    case "idsem.live.project.create": result = await (await live(request, env, dependencies)).createProject(principal, input); break;
    case "idsem.live.project.get": result = await (await live(request, env, dependencies)).getProject(principal, input.project_id); break;
    case "idsem.live.graph.get": result = await (await live(request, env, dependencies)).graph(principal, input.project_id); break;
    case "idsem.live.node.create": result = await (await live(request, env, dependencies)).createNode(principal, input.project_id, input); break;
    case "idsem.live.application.create": result = await (await live(request, env, dependencies)).createApplication(principal, input.project_id, input); break;
    case "idsem.live.event.append": result = await (await live(request, env, dependencies)).appendEvent(principal, input.project_id, input); break;
    case "idsem.live.frontier.set": result = await (await live(request, env, dependencies)).setFrontier(principal, input.project_id, input); break;
    case "idsem.live.world.bind": result = await (await live(request, env, dependencies)).bindUniverseView(principal, input.project_id, input.universe_view_id); break;
    case "idsem.analyze": result = await analyze(input.source, dependencies); break;
    default: throw Object.assign(new Error(`unknown tool: ${name}`), { code: "MCP_TOOL_NOT_FOUND", status: 404 });
  }
  await appendToolAudit(env, dependencies, principal, name, input);
  return result;
}

export async function handleMcpTransport(request, env, pathname, info, dependencies = {}) {
  if (pathname !== "/mcp") return null;
  if (info.surface !== "mcp") return transportError("MCP_HOST_REQUIRED", "hosted MCP is available only at mcp.idol.id", 404);
  if (request.method !== "POST") return transportError("MCP_METHOD_REFUSED", "hosted MCP requires POST", 405);
  if (!admittedOrigin(request)) return transportError("MCP_ORIGIN_REFUSED", "request Origin is not admitted", 403);

  let document;
  try { document = await readDocument(request); }
  catch (error) { return transportError(error.code || "MCP_INVALID_REQUEST", error.message, error.status || 400); }

  const requestedProtocol = request.headers.get("mcp-protocol-version") || document.params?.protocolVersion;
  const protocol = supportedProtocol(requestedProtocol);
  if (!protocol) return transportError("MCP_PROTOCOL_UNSUPPORTED", "supported MCP protocol version required", 400);
  if (!routeHeadersMatch(request, document, protocol)) return transportError("MCP_ROUTING_MISMATCH", "MCP routing headers do not match the JSON-RPC request", 400);

  const token = bearerToken(request);
  if (!token) return transportError("API_TOKEN_REQUIRED", "Bearer API token required", 401);
  let principal;
  try { principal = await platform(env, dependencies).authenticateApiToken(token, ["mcp:connect"]); }
  catch (error) {
    if (error instanceof PlatformError) return transportError(error.code, error.message, error.status);
    return transportError("MCP_AUTHENTICATION_FAILED", "MCP authentication failed closed", 500);
  }

  const id = document.id ?? null;
  try {
    if (document.method === "server/discover") return rpcResult(id, mcpDiscovery());
    if (document.method === "initialize") {
      if (protocol === MCP_CURRENT_PROTOCOL) return rpcError(id, -32601, "initialize is not used by MCP 2026-07-28");
      return rpcResult(id, { protocolVersion: protocol, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "idsem-hosted-mcp", version: "0.1.0" } });
    }
    if (document.method === "notifications/initialized") return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
    if (document.method === "ping") return rpcResult(id, {});
    if (document.method === "tools/list") return rpcResult(id, { tools: MCP_TOOLS.map(mcpToolPublic), cacheScope: "private", ttlMs: 30_000 });
    if (document.method === "tools/call") {
      const name = String(document.params?.name || "");
      try {
        const value = await executeTool(name, document.params?.arguments, principal, request, env, dependencies);
        return rpcResult(id, mcpToolResult(value));
      } catch (error) {
        return rpcResult(id, mcpToolError(error.code || "MCP_TOOL_FAILED", error.message || "MCP tool failed"));
      }
    }
    return rpcError(id, -32601, "method not found");
  } catch (error) {
    return rpcError(id, -32603, "internal error", { code: error.code || "MCP_INTERNAL_ERROR" });
  }
}
