import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve("dist");
const artifacts = resolve(".artifacts/browser-smoke");
const port = Number(process.env.IDOL_BROWSER_SMOKE_PORT || 41739);
const debugPort = Number(process.env.IDOL_BROWSER_DEBUG_PORT || 9229);
const origin = `http://127.0.0.1:${port}`;
const mime = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

function json(response, value, status = 200) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
  response.end(body);
}
function exactWord(source, word) {
  const expression = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "g");
  return [...source.matchAll(expression)].map((match) => [match.index, match.index + match[0].length]);
}
function exactToken(source, start, end, value, sourceFace, semanticId, links = {}) {
  const prefix = source.slice(0, start);
  const line = prefix.split("\n").length;
  const column = start - prefix.lastIndexOf("\n");
  return {
    token_id: `token:${sourceFace}:${start}:${end}`,
    span: [start, end],
    lexical_identity: "name",
    source_face: sourceFace,
    semantic_id: semanticId,
    line,
    column,
    provenance: { source: { path: "browser-smoke.id", start, end, line, column } },
    ...links,
  };
}
function firstSpan(source, word) {
  return exactWord(source, word)[0] || [0, 0];
}
function analyzeFixture(source) {
  const tokens = [];
  const specs = Object.freeze({
    body: ["subject", "value:body", { graph_ids: ["value:body"], application_ids: ["application:weight", "application:mass"], world_ids: ["world:current"], definition_ids: ["definition:body"], reference_ids: ["reference:body:weight", "reference:body:mass"] }],
    weight: ["relation", "relation:weight", { graph_ids: ["relation:weight"], application_ids: ["application:weight"], projection_ids: ["projection:weight:kg"], derivation_ids: ["derivation:weight"], transformation_ids: ["transformation:weight:specialize"], witness_ids: ["witness:weight"], demand_ids: ["demand:weight"], realization_ids: ["realization:weight:native"], definition_ids: ["definition:weight"], reference_ids: ["reference:weight:application"], lowering: [{ id: "lowering:weight:1", semantic_id: "relation:weight", application_id: "application:weight", realization_id: "realization:weight:native", target: "native", range: { start: 0, end: 3 } }] }],
    kg: ["projection", "unit:kg", { graph_ids: ["unit:kg"], application_ids: ["application:weight"], projection_ids: ["projection:weight:kg"], definition_ids: ["definition:kg"] }],
    factor: ["operand", "value:factor", { graph_ids: ["value:factor"], application_ids: ["application:weight"], demand_ids: ["demand:weight"], definition_ids: ["definition:factor"], reference_ids: ["reference:factor:mul"] }],
    mass: ["relation", "relation:mass", { graph_ids: ["relation:mass"], application_ids: ["application:mass"], derivation_ids: ["derivation:mass"], witness_ids: ["witness:mass"], reference_ids: ["reference:mass:application"] }],
  });
  for (const [word, [face, semanticId, links]] of Object.entries(specs)) {
    for (const [start, end] of exactWord(source, word)) tokens.push(exactToken(source, start, end, word, face, semanticId, links));
  }
  tokens.sort((left, right) => left.span[0] - right.span[0] || left.span[1] - right.span[1]);

  const nodes = [
    { id: "application:weight", kind: "application", name: "weight occurrence" },
    { id: "relation:weight", kind: "relation", name: "weight" },
    { id: "value:body", kind: "value", name: "body" },
    { id: "unit:kg", kind: "descriptor", name: "kg" },
    { id: "value:factor", kind: "value", name: "factor" },
    { id: "application:mass", kind: "application", name: "mass occurrence" },
    { id: "relation:mass", kind: "relation", name: "mass" },
    { id: "value:mass", kind: "value", name: "mass result" },
    { id: "value:result", kind: "value", name: "weight result" },
    { id: "world:current", kind: "world", name: "current world" },
    { id: "witness:weight", kind: "witness", name: "weight specialization witness" },
    { id: "demand:weight", kind: "demand", name: "weight tail demand" },
    { id: "realization:weight:native", kind: "realization", name: "native realization" },
  ];
  const edges = [
    { id: "edge:weight:relation", from: "application:weight", to: "relation:weight", role: "relation" },
    { id: "edge:weight:subject", from: "application:weight", to: "value:body", role: "subject" },
    { id: "edge:weight:projection", from: "application:weight", to: "unit:kg", role: "projection" },
    { id: "edge:weight:operand", from: "application:weight", to: "value:factor", role: "operand", position: 0 },
    { id: "edge:weight:result", from: "application:weight", to: "value:result", role: "result", position: 0 },
    { id: "edge:weight:witness", from: "application:weight", to: "witness:weight", role: "witness" },
    { id: "edge:weight:demand", from: "application:weight", to: "demand:weight", role: "demand" },
    { id: "edge:weight:target", from: "application:weight", to: "realization:weight:native", role: "target" },
    { id: "edge:weight:world", from: "application:weight", to: "world:current", role: "witness" },
    { id: "edge:mass:relation", from: "application:mass", to: "relation:mass", role: "relation" },
    { id: "edge:mass:subject", from: "application:mass", to: "value:body", role: "subject" },
    { id: "edge:mass:result", from: "application:mass", to: "value:mass", role: "result" },
  ];
  return {
    authority: { repository: "clpi/idol", commit: "browser-smoke-authority" },
    tokens,
    graph: {
      schema: "idol.graph.browser-smoke.v1",
      nodes,
      edges,
      applications: [
        { id: "application:weight", application: "application:weight", relation: "relation:weight", subject: "value:body", arguments: ["value:factor"], results: ["value:result"], world: "world:current" },
        { id: "application:mass", application: "application:mass", relation: "relation:mass", subject: "value:body", arguments: [], results: ["value:mass"], world: "world:current" },
      ],
      worlds: [{ id: "world:current", stage: "runtime", authority: "not-published" }],
      projections: [{ id: "projection:weight:kg", source: "relation:weight", target: "unit:kg", role: "specialization", identity_preserved: true }],
      derivations: [{ id: "derivation:weight", from: "relation:weight", to: "application:weight", witness_id: "witness:weight" }, { id: "derivation:mass", from: "relation:mass", to: "application:mass" }],
      transformations: [{ id: "transformation:weight:specialize", from: "application:weight", to: "realization:weight:native", witness_id: "witness:weight", semantic_identity_preserved: true }],
      witnesses: [{ id: "witness:weight", supports: "application:weight", depends: ["relation:weight", "unit:kg"], status: "published" }, { id: "witness:mass", supports: "application:mass", status: "published" }],
      demands: [{ id: "demand:weight", target: "value:result", occurrence: "application:weight", observation: "tail result" }],
      realizations: [{ id: "realization:weight:native", application: "application:weight", target: "native", status: "browser-smoke-evidence" }],
      definitions: [{ id: "definition:weight", semantic_id: "relation:weight", span: firstSpan(source, "weight") }, { id: "definition:body", semantic_id: "value:body", span: firstSpan(source, "body") }, { id: "definition:kg", semantic_id: "unit:kg", span: firstSpan(source, "kg") }, { id: "definition:factor", semantic_id: "value:factor", span: firstSpan(source, "factor") }],
      references: [{ id: "reference:weight:application", semantic_id: "relation:weight", span: firstSpan(source, "weight") }, { id: "reference:body:weight", semantic_id: "value:body", span: firstSpan(source, "body") }, { id: "reference:mass:application", semantic_id: "relation:mass", span: firstSpan(source, "mass") }, { id: "reference:factor:mul", semantic_id: "value:factor", span: exactWord(source, "factor").at(-1) || [0, 0] }],
    },
    explain: { schema: "idol.explain.browser-smoke.v1", knowledge_snapshot: { entities: nodes.map((node) => ({ id: node.id, knowledge: "published" })) } },
    check: { ok: true, output: "" },
    source_hash: "browser-smoke-source",
  };
}

async function staticResponse(response, pathname) {
  const requested = pathname === "/" ? "/apps/graph/index.html" : pathname;
  const relative = normalize(requested).replace(/^[/\\]+/, "");
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
    const body = Buffer.from(`window.IDOL=Object.freeze({app:"graph",surface:"graph",origin:true,authority:"browser-smoke-authority"});\n`);
    response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
    response.end(body);
    return;
  }
  if (request.method === "GET" && ["/health", "/__idol/health"].includes(url.pathname)) { json(response, { status: "healthy", edge: url.pathname.startsWith("/__idol") }); return; }
  if (request.method === "POST" && ["/api/analyze", "/api/lower"].includes(url.pathname)) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (url.pathname === "/api/analyze") json(response, analyzeFixture(String(input.source || "")));
    else json(response, { ok: true, target: "native", emit: "asm", text: "; browser smoke physical evidence\nload mass(body)\nmul factor\nreturn result" });
    return;
  }
  if (await staticResponse(response, url.pathname)) return;
  json(response, { error: "not found", path: url.pathname }, 404);
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
  async close() { this.socket.close(); }
}

async function waitFor(url, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
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
async function screenshot(cdp, path) {
  const result = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path, Buffer.from(result.data, "base64"));
}
async function navigate(cdp, width, height) {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 760, screenWidth: width, screenHeight: height });
  await cdp.call("Page.navigate", { url: origin });
  await waitExpression(cdp, `document.readyState==="complete"&&document.querySelectorAll(".semantic-token").length>0`);
}

async function mobileFlow(cdp, exceptions) {
  await navigate(cdp, 390, 844);
  const initial = await evaluate(cdp, `(()=>{document.querySelector(".semantic-token").click();document.querySelector('[data-mobile-mode="facts"]').click();return {tokens:document.querySelectorAll(".semantic-token").length,lexical:document.querySelector("#rail-content").textContent.toLowerCase().includes("semantic identity not published")};})()`);
  await evaluate(cdp, `(()=>{document.querySelector('[data-mobile-mode="source"]').click();document.querySelector("#analyze").click();return true;})()`);
  await waitExpression(cdp, `document.querySelector("#capability").textContent.includes("remote-native")`);
  const exact = await evaluate(cdp, `(()=>{const token=document.querySelector('[data-semantic-id="relation:weight"]');token.click();document.querySelector('[data-mobile-mode="facts"]').click();const relation=document.querySelector("#rail-content").textContent.includes("relation:weight");document.querySelector('[data-mobile-mode="graph"]').click();const node=document.querySelector(".graph-node");const edge=document.querySelector(".graph-edge");node?.dispatchEvent(new MouseEvent("click",{bubbles:true}));edge?.dispatchEvent(new MouseEvent("click",{bubbles:true}));const controls=[...document.querySelectorAll(".observatory-mobile-nav button")].map(n=>n.getBoundingClientRect().height);return {relation,nodes:document.querySelectorAll(".graph-node").length,edges:document.querySelectorAll(".graph-edge").length,controls,width:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,appError:window.__QA_APP_ERROR||null};})()`);
  if (!initial.tokens || !initial.lexical || !exact.relation || !exact.nodes || !exact.edges || exact.width > exact.clientWidth || exact.controls.some((height) => height < 44) || exact.appError || exceptions.length) throw new Error(`mobile browser gate failed: ${JSON.stringify({ initial, exact, exceptions })}`);
  await screenshot(cdp, join(artifacts, "observatory-mobile.png"));
  return { ...initial, ...exact };
}

async function desktopFlow(cdp, exceptions) {
  await navigate(cdp, 1440, 900);
  await evaluate(cdp, `document.querySelector("#analyze").click()`);
  await waitExpression(cdp, `document.querySelector("#capability").textContent.includes("remote-native")`);
  const result = await evaluate(cdp, `(async()=>{document.querySelector('[data-semantic-id="relation:weight"]').click();const lenses={};for(const lens of ["identity","edges","occurrences","worlds","projection","witness","realization","raw"]){document.querySelector('[data-lens="'+lens+'"]').click();lenses[lens]=document.querySelector("#rail-content").textContent.trim().length>0;}document.querySelector('[data-lens="identity"]').click();document.querySelector("#compare-selection").click();document.querySelector('[data-semantic-id="value:factor"]').click();document.querySelector("#compare-selection").click();const compare=document.querySelector("#rail-content").textContent.toLowerCase().includes("compare selection");document.querySelector("#history-back").click();document.querySelector("#history-forward").click();document.querySelector("#realize").click();const started=Date.now();while(Date.now()-started<10000&&!document.querySelector("#rail-content").textContent.includes("browser smoke physical evidence"))await new Promise(r=>setTimeout(r,50));return {lenses,compare,realize:document.querySelector("#rail-content").textContent.includes("browser smoke physical evidence"),nodes:document.querySelectorAll(".graph-node").length,edges:document.querySelectorAll(".graph-edge").length,width:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,appError:window.__QA_APP_ERROR||null};})()`);
  if (!Object.values(result.lenses).every(Boolean) || !result.compare || !result.realize || !result.nodes || !result.edges || result.width > result.clientWidth || result.appError || exceptions.length) throw new Error(`desktop browser gate failed: ${JSON.stringify({ result, exceptions })}`);
  await screenshot(cdp, join(artifacts, "observatory-desktop.png"));
  return result;
}

async function main() {
  await rm(artifacts, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  const server = createServer((request, response) => { requestHandler(request, response).catch((error) => json(response, { error: error.message }, 500)); });
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolveListen); });
  const profile = await mkdtemp(join(tmpdir(), "idol-browser-smoke-"));
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
    const mobile = await mobileFlow(cdp, exceptions);
    exceptions.length = 0;
    const desktop = await desktopFlow(cdp, exceptions);
    const report = { ok: true, chrome: version.Browser, origin, mobile, desktop };
    await writeFile(join(artifacts, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`browser smoke passed: ${report.chrome}`);
  } finally {
    try { await cdp?.close(); } catch {}
    chrome.kill("SIGTERM");
    server.close();
    await rm(profile, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(artifacts, "failure.txt"), `${error.stack || error}\n`);
  console.error(error.stack || error);
  process.exitCode = 1;
});
