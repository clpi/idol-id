import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve("dist");
const artifacts = resolve(".artifacts/public-browser-smoke");
const port = Number(process.env.IDOL_PUBLIC_SMOKE_PORT || 41749);
const debugPort = Number(process.env.IDOL_PUBLIC_SMOKE_DEBUG_PORT || 9239);
const origin = `http://127.0.0.1:${port}`;
const viewports = [[320, 568], [390, 844], [430, 932], [768, 1024], [1440, 900]];
const mime = Object.freeze({
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".wasm": "application/wasm", ".woff": "font/woff", ".woff2": "font/woff2",
});

function json(response, value, status = 200) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
  response.end(body);
}
async function staticResponse(response, pathname) {
  const requested = pathname === "/" ? "/apps/site/index.html" : pathname;
  const relative = normalize(requested).replace(/^[/\\]+/, "");
  const candidate = resolve(root, relative);
  if (!candidate.startsWith(root)) return false;
  try {
    const body = await readFile(candidate);
    response.writeHead(200, { "content-type": mime[extname(candidate).toLowerCase()] || "application/octet-stream", "content-length": body.length, "cache-control": "no-cache" });
    response.end(body);
    return true;
  } catch { return false; }
}
async function requestHandler(request, response) {
  const url = new URL(request.url, origin);
  if (request.method === "GET" && url.pathname === "/config.js") {
    const body = Buffer.from('window.IDOL=Object.freeze({app:"site",surface:"site",origin:true,authority:"cb2199dff026c1b2d3fbd0caa04d6d323370a9e8"});\n');
    response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
    response.end(body); return;
  }
  if (request.method === "GET" && ["/health", "/__idol/health"].includes(url.pathname)) { json(response, { status: "healthy" }); return; }
  if (request.method === "POST" && ["/api/run", "/api/analyze", "/api/lower"].includes(url.pathname)) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (url.pathname === "/api/run") json(response, { ok: true, stdout: String(input.source || "").includes("Hello") ? "Hello\n" : "42\n" });
    else if (url.pathname === "/api/lower") json(response, { ok: true, text: "; exact smoke realization\nmov x0, #42\nret\n" });
    else json(response, {
      authority: { repository: "clpi/idol", commit: "cb2199dff026c1b2d3fbd0caa04d6d323370a9e8" },
      graph: {
        nodes: [
          { id: "application:print:1", kind: "application", name: "print occurrence" },
          { id: "relation:print", kind: "relation", name: "print" },
          { id: "value:hello", kind: "value", name: "Hello" },
          { id: "result:stdout", kind: "result", name: "stdout observation" }
        ],
        edges: [
          { id: "edge:print:relation", from: "application:print:1", to: "relation:print", role: "relation" },
          { id: "edge:print:operand:0", from: "application:print:1", to: "value:hello", role: "operand", position: 0 },
          { id: "edge:print:result:0", from: "application:print:1", to: "result:stdout", role: "result", position: 0 }
        ]
      },
      check: { ok: true }
    });
    return;
  }
  if (await staticResponse(response, url.pathname)) return;
  json(response, { error: "not found", path: url.pathname }, 404);
}

class Cdp {
  constructor(socket) {
    this.socket = socket; this.nextId = 1; this.pending = new Map(); this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`)); else pending.resolve(message.result); return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
  }
  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, reject) => { this.pending.set(id, { resolve: resolveCall, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
  }
  on(method, listener) { const listeners = this.listeners.get(method) || []; listeners.push(listener); this.listeners.set(method, listeners); }
  async close() { this.socket.close(); }
}
async function waitFor(url, attempts = 120) {
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
async function screenshot(cdp, path) { const result = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(path, Buffer.from(result.data, "base64")); }
async function waitForExit(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolveExit) => { const timer = setTimeout(() => resolveExit(false), timeout); child.once("close", () => { clearTimeout(timer); resolveExit(true); }); child.once("error", () => { clearTimeout(timer); resolveExit(false); }); });
}
async function terminate(chrome, cdp) {
  try { await cdp?.close(); } catch {}
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  chrome.kill("SIGTERM"); if (await waitForExit(chrome, 4000)) return; chrome.kill("SIGKILL"); await waitForExit(chrome, 2000);
}

async function exercise(cdp, width, height, exceptions) {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 760, screenWidth: width, screenHeight: height });
  await cdp.call("Page.navigate", { url: origin });
  await waitExpression(cdp, `document.readyState==="complete"&&document.querySelector("#source-editor")&&document.querySelector("#install-command")`);
  const baseline = await evaluate(cdp, `(()=>{const text=document.body.innerText;const controls=[...document.querySelectorAll("button,.button,.nav-toggle")].filter(n=>getComputedStyle(n).display!=="none").map(n=>n.getBoundingClientRect().height);return {h1:document.querySelector("h1")?.innerText,stale:/\\b(?:Idsem|Duo|Duon)\\b/i.test(text),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,short:controls.filter(height=>height < 44),install:Boolean(document.querySelector("#install-command")),nav:Boolean(document.querySelector(".nav-toggle"))};})()`);
  if (!baseline.h1?.includes("Dynamic by default") || baseline.stale || baseline.scrollWidth > baseline.clientWidth || baseline.short.length || !baseline.install) throw new Error(`baseline failed at ${width}x${height}: ${JSON.stringify(baseline)}`);
  if (width <= 900) {
    const nav = await evaluate(cdp, `(()=>{document.querySelector(".nav-toggle").click();const panel=document.querySelector("#idol-nav-panel");const open=!panel.hidden&&panel.classList.contains("open");document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));return {open,closed:panel.hidden};})()`);
    if (!nav.open || !nav.closed) throw new Error(`mobile navigation failed at ${width}x${height}: ${JSON.stringify(nav)}`);
  }
  await evaluate(cdp, `document.querySelector('[data-action="run"]').click()`);
  await waitExpression(cdp, `document.querySelector("#playground-output").textContent.includes("Hello")`);
  await evaluate(cdp, `document.querySelector('[data-action="analyze"]').click()`);
  await waitExpression(cdp, `document.querySelector("[data-edge-id]")`);
  const exact = await evaluate(cdp, `(()=>{const edge=document.querySelector("[data-edge-id]");edge.click();return {edge:edge.dataset.edgeId,fact:document.querySelector("#fact-record").textContent,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};})()`);
  if (!exact.edge || !exact.fact.includes(exact.edge) || exact.scrollWidth > exact.clientWidth || exceptions.length) throw new Error(`compiler flow failed at ${width}x${height}: ${JSON.stringify({ exact, exceptions })}`);
  await screenshot(cdp, join(artifacts, `idol-public-${width}x${height}.png`));
  return { width, height, baseline, exact };
}

async function main() {
  await rm(artifacts, { recursive: true, force: true }); await mkdir(artifacts, { recursive: true });
  const server = createServer((request, response) => requestHandler(request, response).catch((error) => json(response, { error: error.message }, 500)));
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolveListen); });
  const profile = await mkdtemp(join(tmpdir(), "idol-public-smoke-"));
  const chrome = spawn(await chromePath(), ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let cdp;
  try {
    const version = await (await waitFor(`http://127.0.0.1:${debugPort}/json/version`)).json();
    const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveSocket, reject) => { socket.addEventListener("open", resolveSocket, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    cdp = new Cdp(socket); const exceptions = [];
    cdp.on("Runtime.exceptionThrown", (params) => exceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "runtime exception"));
    cdp.on("Runtime.consoleAPICalled", (params) => { if (["error", "warning"].includes(params.type)) exceptions.push(params.args?.map((arg) => arg.value || arg.description).join(" ") || params.type); });
    await cdp.call("Page.enable"); await cdp.call("Runtime.enable");
    const results = [];
    for (const [width, height] of viewports) { exceptions.length = 0; results.push(await exercise(cdp, width, height, exceptions)); }
    const report = { ok: true, chrome: version.Browser, origin, results };
    await writeFile(join(artifacts, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`public browser smoke passed: ${version.Browser}`);
  } finally {
    await terminate(chrome, cdp);
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch(async (error) => { await mkdir(artifacts, { recursive: true }); await writeFile(join(artifacts, "failure.txt"), `${error.stack || error}\n`); console.error(error.stack || error); process.exitCode = 1; });
