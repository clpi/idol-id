import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve("dist");
const artifacts = resolve(".artifacts/browser-smoke");
const port = Number(process.env.IDOL_LIVE_BROWSER_SMOKE_PORT || 41740);
const debugPort = Number(process.env.IDOL_LIVE_BROWSER_DEBUG_PORT || 9230);
const origin = `http://127.0.0.1:${port}`;
const mime = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".id": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

const project = Object.freeze({
  schema: "idol.web.live.project.v1",
  id: "lp_abcdefghijkl",
  name: "Idol",
  slug: "idol",
  summary: "One canonical collaboration history.",
  visibility: "private",
  semantic_id: null,
  identity_status: "not-published",
  universe_view_id: "uv_abcdefghijkl",
  world_binding: Object.freeze({ kind: "operational-projection-reference", authority_grant: "none", semantic_universes: 1 }),
  boundary: Object.freeze({ semantic_universes: 1, accepted_frontiers: 1, world_authority_grant: "none", dispatcher_access: false }),
  created_at: "2026-08-28T20:00:00.000Z",
  updated_at: "2026-08-28T20:00:00.000Z",
});
const graph = Object.freeze({
  schema: "idol.web.live.graph.v1",
  semantic_authority: false,
  project,
  boundary: project.boundary,
  nodes: Object.freeze([
    Object.freeze({ id: "ln_goalabcdefgh", category: "goal", label: "one graph", summary: "semantic graph sovereignty", semantic_id: null, identity_status: "not-published", data: {} }),
    Object.freeze({ id: "ln_taskabcdefgh", category: "task", label: "publish facts", summary: "publish exact application facts", semantic_id: null, identity_status: "not-published", data: {} }),
    Object.freeze({ id: "la_applicationab", category: "application", label: "requires", summary: "application of requires", semantic_id: null, identity_status: "not-published", data: {} }),
    Object.freeze({ id: "relation:requires", category: "relation", label: "requires", summary: "relation identity", semantic_id: null, identity_status: "not-published", data: {} }),
  ]),
  applications: Object.freeze([
    Object.freeze({ id: "la_applicationab", project_id: project.id, relation: "requires", subject: "ln_taskabcdefgh", target: "ln_goalabcdefgh", operands: [], results: [], worlds: [], witnesses: [], demand: {}, provenance: { origin: "browser-smoke" }, semantic_id: null, identity_status: "not-published" }),
  ]),
  edges: Object.freeze([
    Object.freeze({ id: "la_applicationab:relation:0", application_id: "la_applicationab", source: "la_applicationab", target: "relation:requires", role: "relation", semantic_authority: false }),
    Object.freeze({ id: "la_applicationab:subject:0", application_id: "la_applicationab", source: "la_applicationab", target: "ln_taskabcdefgh", role: "subject", semantic_authority: false }),
    Object.freeze({ id: "la_applicationab:target:0", application_id: "la_applicationab", source: "la_applicationab", target: "ln_goalabcdefgh", role: "target", semantic_authority: false }),
  ]),
  history: Object.freeze([
    Object.freeze({ id: "le_abcdefghijkl", project_id: project.id, kind: "attempted", predecessor_ids: [], intent_id: null, application_ids: ["la_applicationab"], payload: { note: "first exact attempt" }, semantic_id: null, identity_status: "not-published", created_at: "2026-08-28T20:00:00.000Z" }),
  ]),
  frontier: Object.freeze({
    decisions: Object.freeze([Object.freeze({ id: "lf_abcdefghijkl", project_id: project.id, event_id: "le_abcdefghijkl", state: "admitted", reason: "browser-smoke witness", created_at: "2026-08-28T20:00:01.000Z" })]),
    admitted_event_ids: Object.freeze(["le_abcdefghijkl"]),
    causally_closed: true,
  }),
  indexes: Object.freeze({ incoming: {}, outgoing: {} }),
});

function sendJson(response, value, status = 200) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
  response.end(body);
}
async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
async function staticResponse(response, pathname) {
  const relative = normalize(pathname).replace(/^[/\\]+/, "");
  const candidate = resolve(root, relative);
  if (!candidate.startsWith(root)) return false;
  try {
    const body = await readFile(candidate);
    response.writeHead(200, { "content-type": mime[extname(candidate).toLowerCase()] || "application/octet-stream", "content-length": body.length, "cache-control": "no-store" });
    response.end(body);
    return true;
  } catch { return false; }
}
async function requestHandler(request, response) {
  const url = new URL(request.url, origin);
  if (request.method === "GET" && url.pathname === "/config.js") {
    const body = Buffer.from("window.IDOL=Object.freeze({app:'live',surface:'live',origin:false,commit:'browser-smoke',authority:'browser-smoke-authority'});\n");
    response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
    response.end(body);
    return;
  }
  if (request.method === "GET" && ["/health", "/__idol/health"].includes(url.pathname)) { sendJson(response, { status: "healthy", edge: true }); return; }
  if (request.method === "GET" && url.pathname === "/v1/live/browser/session") {
    sendJson(response, { profile: { subject: "browser-smoke", email: "browser@example.test", display_name: "Browser Smoke" }, authority: "transport identity only; no Idol world grant" });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/live/browser/projects") {
    sendJson(response, { projects: [{ id: project.id, name: project.name, slug: project.slug, summary: project.summary, visibility: project.visibility, universe_view_id: project.universe_view_id, frontier_admitted_count: 1, created_at: project.created_at, updated_at: project.updated_at }] });
    return;
  }
  if (request.method === "GET" && url.pathname === `/v1/live/browser/projects/${project.id}`) { sendJson(response, project); return; }
  if (request.method === "GET" && url.pathname === `/v1/live/browser/projects/${project.id}/graph`) { sendJson(response, graph); return; }
  if (["POST", "PUT", "PATCH"].includes(request.method) && url.pathname.startsWith("/v1/live/browser/projects")) {
    const body = await readBody(request);
    sendJson(response, { ...body, id: body.id || "ln_createdabcd", project_id: project.id, semantic_id: null, identity_status: "not-published", authority_grant: "none" }, request.method === "POST" ? 201 : 200);
    return;
  }
  if (request.method === "POST" && url.pathname === "/mcp") {
    const document = await readBody(request);
    if (document.method === "server/discover") {
      sendJson(response, { jsonrpc: "2.0", id: document.id, result: { protocolVersion: "2026-07-28", supportedProtocolVersions: ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"], serverInfo: { name: "idol-hosted-mcp", version: "browser-smoke" }, capabilities: { tools: { listChanged: false } }, cacheScope: "private", ttlMs: 30000, toolNamespace: "idol", semanticAuthority: false } });
      return;
    }
    if (document.method === "tools/list") {
      sendJson(response, { jsonrpc: "2.0", id: document.id, result: { tools: [
        { name: "idol.live.projects.list", description: "List subject-owned projects.", requiredScopes: ["mcp:connect", "live:read"], inputSchema: { type: "object" } },
        { name: "idol.live.project.create", description: "Create one project.", requiredScopes: ["mcp:connect", "live:write"], inputSchema: { type: "object" } },
      ], cacheScope: "private", ttlMs: 30000 } });
      return;
    }
    sendJson(response, { jsonrpc: "2.0", id: document.id, error: { code: -32601, message: "method not found" } });
    return;
  }
  if (await staticResponse(response, url.pathname)) return;
  sendJson(response, { error: "not found", path: url.pathname }, 404);
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
  }
  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, reject) => {
      this.pending.set(id, { resolve: resolveCall, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }
  close() { this.socket.close(); }
}
async function waitFor(url, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`timed out waiting for ${url}`);
}
async function chromePath() {
  for (const candidate of [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean)) {
    try { await access(candidate, constants.X_OK); return candidate; } catch {}
  }
  throw new Error("Chrome/Chromium executable not found");
}
async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
  return result.result?.value;
}
async function waitExpression(cdp, predicate, timeout = 15000) {
  return evaluate(cdp, `(async()=>{const started=Date.now();while(Date.now()-started<${timeout}){if(${predicate})return true;await new Promise(r=>setTimeout(r,50));}throw new Error(${JSON.stringify(`timed out: ${predicate}`)});})()`);
}
async function screenshot(cdp, name) {
  const result = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(artifacts, name), Buffer.from(result.data, "base64"));
}
async function navigate(cdp, path, width, height, ready) {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 700, screenWidth: width, screenHeight: height });
  await cdp.call("Page.navigate", { url: `${origin}${path}` });
  await waitExpression(cdp, `document.readyState==="complete"&&(${ready})`);
}
async function viewport(cdp, controls, required) {
  return evaluate(cdp, `(()=>{const heights=[...document.querySelectorAll(${JSON.stringify(controls)})].filter(node=>node.offsetParent!==null).map(node=>node.getBoundingClientRect().height);return{required:document.querySelectorAll(${JSON.stringify(required)}).length,width:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,small:heights.filter(height => height < 44).length};})()`);
}

async function liveFlow(cdp, exceptions) {
  await navigate(cdp, "/apps/live/index.html", 390, 844, `document.querySelectorAll('#live-node-grid .live-record').length>0&&document.querySelectorAll('#live-edge-list .live-edge').length>0`);
  const mobile = await evaluate(cdp, `(()=>{document.querySelector('#live-node-grid .live-record').click();document.querySelector('[data-mobile-view="facts"]').click();const inspector=document.querySelector('#live-inspector-record').textContent.toLowerCase();const form=document.querySelector('#live-node-form');form.querySelector('[name="category"]').value='task';form.querySelector('[name="label"]').value='browser qa';form.querySelector('[name="summary"]').value='exercise the mutation path';form.requestSubmit();return{facts:inspector.includes('not published'),authority:inspector.includes('none granted')};})()`);
  await waitExpression(cdp, `document.querySelector('#live-node-form [name="label"]').value===""`);
  const mobileViewport = await viewport(cdp, ".live-mobile-nav button,.live-button,.live-tab,.live-project,.live-record,.live-edge,.live-event,.live-frontier-row,.live-field input,.live-field select,.live-field textarea", "#live-node-grid .live-record");
  if (!mobile.facts || !mobile.authority || !mobileViewport.required || mobileViewport.width > mobileViewport.clientWidth || mobileViewport.small || exceptions.length) throw new Error(`Live mobile browser gate failed: ${JSON.stringify({ mobile, mobileViewport, exceptions })}`);
  await screenshot(cdp, "live-mobile.png");

  exceptions.length = 0;
  await navigate(cdp, "/apps/live/index.html", 1440, 900, `document.querySelectorAll('#live-edge-list .live-edge').length>0`);
  const desktop = await evaluate(cdp, `(()=>{document.querySelector('#live-edge-list .live-edge').click();document.querySelector('[data-live-lens="history"]').click();return{edge:document.querySelector('#live-inspector-record').textContent.includes('application_id'),history:document.querySelectorAll('#live-history-list .live-event').length,frontier:document.querySelectorAll('#live-frontier-list .live-frontier-row').length};})()`);
  const desktopViewport = await viewport(cdp, ".live-button,.live-tab,.live-project,.live-record,.live-edge,.live-event,.live-frontier-row,.live-field input,.live-field select,.live-field textarea", "#live-history-list .live-event");
  if (!desktop.edge || !desktop.history || !desktop.frontier || desktopViewport.width > desktopViewport.clientWidth || desktopViewport.small || exceptions.length) throw new Error(`Live desktop browser gate failed: ${JSON.stringify({ desktop, desktopViewport, exceptions })}`);
  await screenshot(cdp, "live-desktop.png");
}

async function mcpFlow(cdp, exceptions) {
  exceptions.length = 0;
  await navigate(cdp, "/apps/mcp/index.html", 390, 844, `document.querySelector('#mcp-discover')`);
  await evaluate(cdp, `(()=>{document.querySelector('#mcp-token').value='idol_pat_browser_smoke';document.querySelector('#mcp-discover').click();return true;})()`);
  await waitExpression(cdp, `document.querySelector('#mcp-raw').textContent.includes('2026-07-28')`);
  await evaluate(cdp, `document.querySelector('#mcp-tools').click()`);
  await waitExpression(cdp, `document.querySelectorAll('#mcp-tool-grid .tool').length>=2`);
  const mobileViewport = await viewport(cdp, ".button,.field input", "#mcp-tool-grid .tool");
  if (!mobileViewport.required || mobileViewport.width > mobileViewport.clientWidth || mobileViewport.small || exceptions.length) throw new Error(`MCP mobile browser gate failed: ${JSON.stringify({ mobileViewport, exceptions })}`);
  await screenshot(cdp, "mcp-mobile.png");

  exceptions.length = 0;
  await navigate(cdp, "/apps/mcp/index.html", 1440, 900, `document.querySelector('#mcp-tools')`);
  await evaluate(cdp, `(()=>{document.querySelector('#mcp-token').value='idol_pat_browser_smoke';document.querySelector('#mcp-tools').click();return true;})()`);
  await waitExpression(cdp, `document.querySelectorAll('#mcp-tool-grid .tool').length>=2`);
  const desktopViewport = await viewport(cdp, ".button,.field input", "#mcp-tool-grid .tool");
  if (desktopViewport.width > desktopViewport.clientWidth || desktopViewport.small || exceptions.length) throw new Error(`MCP desktop browser gate failed: ${JSON.stringify({ desktopViewport, exceptions })}`);
  await screenshot(cdp, "mcp-desktop.png");
}

async function waitForExit(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolveExit) => {
    const timer = setTimeout(() => resolveExit(false), timeout);
    child.once("close", () => { clearTimeout(timer); resolveExit(true); });
  });
}
async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolveClose) => server.close(resolveClose));
}
async function main() {
  await mkdir(artifacts, { recursive: true });
  const server = createServer((request, response) => requestHandler(request, response).catch((error) => sendJson(response, { error: error.message }, 500)));
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolveListen); });
  const profile = await mkdtemp(join(tmpdir(), "idol-live-browser-smoke-"));
  const chrome = spawn(await chromePath(), ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let cdp;
  try {
    const version = await (await waitFor(`http://127.0.0.1:${debugPort}/json/version`)).json();
    const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveSocket, reject) => { socket.addEventListener("open", resolveSocket, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    cdp = new Cdp(socket);
    const exceptions = [];
    cdp.on("Runtime.exceptionThrown", (params) => exceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "runtime exception"));
    cdp.on("Runtime.consoleAPICalled", (params) => { if (["error", "warning"].includes(params.type)) exceptions.push(params.args?.map((arg) => arg.value || arg.description).join(" ") || params.type); });
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await liveFlow(cdp, exceptions);
    await mcpFlow(cdp, exceptions);
    const report = { ok: true, chrome: version.Browser, origin, viewports: [[390, 844], [1440, 900]], artifacts: ["live-mobile.png", "live-desktop.png", "mcp-mobile.png", "mcp-desktop.png"] };
    await writeFile(join(artifacts, "live-mcp-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Live/MCP browser smoke passed: ${report.chrome}`);
  } finally {
    try { cdp?.close(); } catch {}
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGTERM");
      if (!(await waitForExit(chrome, 5000))) chrome.kill("SIGKILL");
    }
    await closeServer(server);
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch(async (error) => {
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(artifacts, "live-mcp-failure.txt"), `${error.stack || error}\n`);
  console.error(error.stack || error);
  process.exitCode = 1;
});
