import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve("dist");
const artifacts = resolve(".artifacts/studio-browser-smoke");
const port = Number(process.env.IDOL_STUDIO_SMOKE_PORT || 41741);
const debugPort = Number(process.env.IDOL_STUDIO_DEBUG_PORT || 9231);
const origin = `http://127.0.0.1:${port}`;
const authorityAsset = JSON.parse(await readFile(join(root, "runtime/authority.json"), "utf8"));
const authority = String(authorityAsset?.language?.commit || "");
if (!/^[0-9a-f]{40}$/.test(authority)) throw new Error("invalid immutable Studio authority");

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
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
  });
  response.end(body);
}

async function staticResponse(response, pathname) {
  const requested = pathname === "/" ? "/apps/site/index.html" : pathname;
  const relative = normalize(requested).replace(/^[/\\]+/, "");
  const candidate = resolve(root, relative);
  if (!candidate.startsWith(root)) return false;
  try {
    const body = await readFile(candidate);
    response.writeHead(200, {
      "content-type": mime[extname(candidate).toLowerCase()] || "application/octet-stream",
      "content-length": body.length,
      "cache-control": "no-store",
    });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

async function requestHandler(request, response) {
  const url = new URL(request.url, origin);
  if (request.method === "GET" && url.pathname === "/config.js") {
    const body = Buffer.from(`window.IDOL=Object.freeze({app:"site",surface:"site",origin:true,authority:"${authority}"});\n`);
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
      "content-length": body.length,
      "cache-control": "no-store",
    });
    response.end(body);
    return;
  }
  if (request.method === "GET" && ["/health", "/__idol/health"].includes(url.pathname)) {
    json(response, { status: "healthy", edge: url.pathname.startsWith("/__idol"), authority });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/libs") {
    json(response, { libs: [] });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/worlds") {
    json(response, { worlds: [] });
    return;
  }
  if (request.method === "POST" && ["/api/analyze", "/api/lower"].includes(url.pathname)) {
    for await (const _ of request) {}
    json(response, { error: "compiler transport deliberately unavailable in Studio browser admission" }, 503);
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
  close() {
    this.socket.close();
  }
}

const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));

async function waitFor(url, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await pause(100);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function chromePath() {
  for (const candidate of [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean)) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  throw new Error("Chrome/Chromium executable not found");
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
  }
  return result.result?.value;
}

async function waitForExpression(cdp, expression, label, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await pause(100);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function screenshot(cdp, name) {
  const result = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(artifacts, name), Buffer.from(result.data, "base64"));
}

async function setViewport(cdp, width, height) {
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 699,
    screenWidth: width,
    screenHeight: height,
  });
}

async function navigate(cdp) {
  await cdp.call("Page.navigate", { url: `${origin}/` });
  await waitForExpression(cdp, 'document.readyState === "complete" && document.querySelector("#studio-editor")', "Studio shell");
  await waitForExpression(cdp, 'document.querySelector("#studio-editor").value.length > 0', "authority-pinned source sample");
  await pause(100);
}

async function inspectViewport(cdp, width, height, exceptions) {
  await setViewport(cdp, width, height);
  await navigate(cdp);
  const metrics = await evaluate(cdp, `(() => {
    const root = document.documentElement;
    const controls = [...document.querySelectorAll("button, select")]
      .filter((node) => getComputedStyle(node).display !== "none" && node.getBoundingClientRect().width > 0)
      .map((node) => Math.round(node.getBoundingClientRect().height));
    return {
      width: innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      title: document.title,
      brand: document.querySelector(".idol-brand-word")?.textContent || "",
      editor: document.querySelector("#studio-editor")?.value.length || 0,
      stale: /\\b(?:idsem|duo|duon)\\b/i.test(document.body.innerText),
      controls,
      mobileTabs: getComputedStyle(document.querySelector(".studio-mobile-tabs")).display,
      menu: getComputedStyle(document.querySelector(".idol-menu")).display,
      appError: globalThis.__idolAppError || null,
    };
  })()`);
  if (metrics.scrollWidth > metrics.clientWidth) throw new Error(`${width} viewport overflows: ${metrics.scrollWidth} > ${metrics.clientWidth}`);
  if (metrics.title !== "Idol Studio — idol.id") throw new Error(`${width} unexpected title: ${metrics.title}`);
  if (metrics.brand !== "IDOL") throw new Error(`${width} missing current Idol brand`);
  if (!metrics.editor) throw new Error(`${width} editor was not seeded from authority-pinned source`);
  if (metrics.stale) throw new Error(`${width} exposes superseded public identity`);
  if (metrics.appError) throw new Error(`${width} app error: ${metrics.appError}`);
  if (exceptions.length) throw new Error(`${width} browser exceptions: ${exceptions.join(" | ")}`);

  if (width <= 699) {
    if (metrics.mobileTabs === "none") throw new Error(`${width} mobile projection tabs are hidden`);
    const short = metrics.controls.filter((heightValue) => heightValue < 44);
    if (short.length) throw new Error(`${width} has controls below 44px: ${short.join(", ")}`);
    await evaluate(cdp, 'document.querySelector(".idol-menu").click()');
    await waitForExpression(cdp, 'document.querySelector("#idol-drawer").classList.contains("open") && !document.querySelector("#idol-drawer").hidden', "mobile navigation drawer");
    await evaluate(cdp, 'document.querySelector(".idol-menu").click()');
  } else {
    await evaluate(cdp, 'document.querySelector(".idol-command").click()');
    await waitForExpression(cdp, '!document.querySelector("#idol-command-backdrop").hidden', "command palette");
    await evaluate(cdp, 'document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
  }

  await evaluate(cdp, 'document.querySelector("[data-action=analyze]").click()');
  await waitForExpression(cdp, 'document.querySelector("#studio-capability").classList.contains("refused")', "explicit analysis refusal");
  const refusal = await evaluate(cdp, `(() => ({
    text: document.querySelector("#studio-capability").textContent,
    nodes: document.querySelectorAll("#studio-graph [data-node-id], #studio-graph .graph-node").length,
    empty: !document.querySelector("#studio-graph-empty").hidden,
  }))()`);
  if (!/analysis refused/i.test(refusal.text)) throw new Error(`${width} did not expose explicit analysis refusal`);
  if (refusal.nodes !== 0 || !refusal.empty) throw new Error(`${width} minted graph presentation after refused analysis`);

  const name = `studio-${width}x${height}.png`;
  await screenshot(cdp, name);
  return { ...metrics, refusal: refusal.text, screenshot: name };
}

async function waitForProcessExit(child, timeout) {
  return new Promise((resolveExit) => {
    let settled = false;
    let timer;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("close", onClose);
      child.off("error", onError);
      resolveExit(exited);
    };
    const onClose = () => finish(true);
    const onError = () => finish(false);
    child.once("close", onClose);
    child.once("error", onError);
    if (child.exitCode !== null || child.signalCode !== null) return finish(true);
    timer = setTimeout(() => finish(false), timeout);
  });
}

async function terminateChrome(chrome, cdp) {
  try { cdp?.close(); } catch {}
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  chrome.kill("SIGTERM");
  if (await waitForProcessExit(chrome, 5000)) return;
  chrome.kill("SIGKILL");
  if (!(await waitForProcessExit(chrome, 2000))) throw new Error("Chrome did not exit after SIGKILL");
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

async function main() {
  await rm(artifacts, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  const server = createServer((request, response) => {
    requestHandler(request, response).catch((error) => json(response, { error: error.message }, 500));
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });

  const profile = await mkdtemp(join(tmpdir(), "idol-studio-smoke-"));
  const chrome = spawn(await chromePath(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let cdp;
  try {
    const version = await (await waitFor(`http://127.0.0.1:${debugPort}/json/version`)).json();
    const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveSocket, reject) => {
      socket.addEventListener("open", resolveSocket, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    cdp = new Cdp(socket);
    const exceptions = [];
    cdp.on("Runtime.exceptionThrown", (params) => exceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "runtime exception"));
    cdp.on("Runtime.consoleAPICalled", (params) => {
      if (params.type === "error") exceptions.push(params.args?.map((arg) => arg.value || arg.description).join(" ") || "console error");
    });
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");

    const viewports = [[320, 568], [390, 844], [430, 932], [768, 1024], [1440, 900]];
    const results = [];
    for (const [width, height] of viewports) {
      exceptions.length = 0;
      results.push(await inspectViewport(cdp, width, height, exceptions));
    }
    const report = { ok: true, chrome: version.Browser, origin, authority, viewports: results };
    await writeFile(join(artifacts, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Studio browser smoke passed: ${version.Browser}`);
  } finally {
    let cleanupError;
    try { await terminateChrome(chrome, cdp); } catch (error) { cleanupError = error; }
    try { await closeServer(server); } catch (error) { cleanupError ||= error; }
    try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (error) { cleanupError ||= error; }
    if (cleanupError) throw cleanupError;
  }
}

main().catch(async (error) => {
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(artifacts, "failure.txt"), `${error.stack || error}\n`);
  console.error(error.stack || error);
  process.exitCode = 1;
});
