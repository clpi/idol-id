import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve("dist");
const artifacts = resolve(".artifacts/browser-smoke");
const port = Number(process.env.IDOL_HOME_BROWSER_SMOKE_PORT || 41741);
const debugPort = Number(process.env.IDOL_HOME_BROWSER_DEBUG_PORT || 9231);
const origin = `http://127.0.0.1:${port}`;
const viewports = Object.freeze([[320, 568], [390, 844], [430, 932], [768, 1024], [1440, 900]]);
const authority = JSON.parse(await readFile(join(root, "runtime/authority.json"), "utf8"));
const identity = Object.freeze({
  commit: "browser-smoke-web",
  authority: String(authority?.language?.commit || ""),
  native_authority: String(authority?.native?.commit || ""),
  source_law: String(authority?.language?.source_law?.sha256 || ""),
  app: "site",
  surface: "site",
});
if (!/^[0-9a-f]{40}$/.test(identity.authority) || !identity.source_law) throw new Error("invalid immutable homepage smoke authority");

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
      "cache-control": "no-cache, must-revalidate",
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
    const body = Buffer.from(`window.IDOL=Object.freeze(${JSON.stringify({ app: "site", surface: "site", origin: true, authority: identity.authority, source_law: identity.source_law })});\n`);
    response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
    response.end(body);
    return;
  }
  if (request.method === "GET" && url.pathname === "/__idol/version") {
    json(response, { service: "idol-id", ...identity });
    return;
  }
  if (request.method === "GET" && ["/health", "/__idol/health"].includes(url.pathname)) {
    json(response, { status: "healthy", edge: true, ...identity });
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
  close() { this.socket.close(); }
}

async function waitFor(url, attempts = 120) {
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
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  throw new Error("Chrome/Chromium executable not found");
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
  return result.result?.value;
}

async function waitExpression(cdp, predicate, timeout = 15000) {
  return evaluate(cdp, `(async()=>{const started=Date.now();while(Date.now()-started<${timeout}){if(${predicate})return true;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error(${JSON.stringify(`timed out: ${predicate}`)});})()`);
}

async function screenshot(cdp, path) {
  const result = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path, Buffer.from(result.data, "base64"));
}

async function waitForExit(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolveExit) => {
    const timer = setTimeout(() => resolveExit(false), timeout);
    child.once("close", () => { clearTimeout(timer); resolveExit(true); });
    child.once("error", () => { clearTimeout(timer); resolveExit(false); });
  });
}

async function terminateChrome(chrome, cdp) {
  try { cdp?.close(); } catch {}
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  chrome.kill("SIGTERM");
  if (await waitForExit(chrome, 4000)) return;
  chrome.kill("SIGKILL");
  await waitForExit(chrome, 2000);
}

async function exercise(cdp, width, height, exceptions) {
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 900,
    screenWidth: width,
    screenHeight: height,
  });
  await cdp.call("Page.navigate", { url: origin });
  await waitExpression(cdp, `document.readyState==="complete"&&document.querySelector("h1")?.innerText.includes("Dynamic by default")&&document.querySelector("#authority-example-source")?.textContent.includes("table[key]")&&document.querySelector("#deployment-commit")?.textContent!=="loading…"`);

  const baseline = await evaluate(cdp, `(()=>{
    const text=document.body.innerText;
    const root=document.documentElement;
    const mobile=innerWidth<=900;
    const controls=[...document.querySelectorAll("button,.action,.nav-toggle")].filter(node=>getComputedStyle(node).display!=="none").map(node=>({label:(node.innerText||node.getAttribute("aria-label")||"").trim(),height:node.getBoundingClientRect().height}));
    const primary=[...document.querySelectorAll(".nav-desktop a")].map(node=>node.textContent.trim());
    return {
      h1:document.querySelector("h1")?.innerText,
      stale:/\\b(?:IDSEM|Idsem|DUO|Duo|DUON|Duon)\\b|current law projection|World Atlas/i.test(text),
      registry:/^Registry$/m.test(text),
      scrollWidth:root.scrollWidth,
      clientWidth:root.clientWidth,
      short:mobile?controls.filter(control=>control.height<44):[],
      installUnix:document.querySelector("#install-unix")?.textContent,
      installPowerShell:document.querySelector("#install-powershell")?.textContent,
      source:document.querySelector("#authority-example-source")?.textContent,
      sourceStatus:document.querySelector("#authority-example-status")?.textContent,
      sourceManifest:document.querySelector("[data-source-manifest]")?.dataset.sourceManifest,
      identity:document.querySelector("#deployment-commit")?.textContent,
      primary,
      navToggleVisible:getComputedStyle(document.querySelector(".nav-toggle")).display!=="none"
    };
  })()`);

  const expectedSource = "value = table[key]\ntable[key] = replacement\nencoded = codec.encode(source)";
  if (!baseline.h1?.includes("Native when known") || baseline.stale || baseline.registry || baseline.scrollWidth > baseline.clientWidth || baseline.short.length) {
    throw new Error(`homepage baseline failed at ${width}x${height}: ${JSON.stringify(baseline)}`);
  }
  if (baseline.source !== expectedSource || baseline.sourceStatus !== "current-law" || baseline.sourceManifest !== "/content/source-examples.json") {
    throw new Error(`authority-backed source failed at ${width}x${height}: ${JSON.stringify(baseline)}`);
  }
  if (!baseline.installUnix?.includes("https://idol.id/install | sh") || !baseline.installPowerShell?.includes("https://idol.id/install.ps1 | iex")) {
    throw new Error(`install surface failed at ${width}x${height}: ${JSON.stringify(baseline)}`);
  }
  if (width <= 900) {
    if (!baseline.navToggleVisible) throw new Error(`mobile navigation toggle hidden at ${width}x${height}`);
    const navigation = await evaluate(cdp, `(()=>{
      const toggle=document.querySelector(".nav-toggle");
      toggle.click();
      const panel=document.querySelector("#idol-nav-panel");
      const open=!panel.hidden&&panel.classList.contains("open")&&toggle.getAttribute("aria-expanded")==="true";
      document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
      return {open,closed:panel.hidden&&toggle.getAttribute("aria-expanded")==="false"};
    })()`);
    if (!navigation.open || !navigation.closed) throw new Error(`mobile navigation failed at ${width}x${height}: ${JSON.stringify(navigation)}`);
  } else if (baseline.primary.join(",") !== "compiler,graph,docs,live,install") {
    throw new Error(`desktop primary navigation drift at ${width}x${height}: ${JSON.stringify(baseline.primary)}`);
  }

  await evaluate(cdp, `document.querySelector('[data-copy="install-unix"]').click()`);
  await waitExpression(cdp, `document.querySelector('[data-copy="install-unix"]').textContent==="Copied"`);
  const after = await evaluate(cdp, `(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,copied:document.querySelector('[data-copy="install-unix"]').textContent,errors:${JSON.stringify(exceptions)}}))()`);
  if (after.scrollWidth > after.clientWidth || after.copied !== "Copied" || exceptions.length) {
    throw new Error(`homepage interaction failed at ${width}x${height}: ${JSON.stringify({ after, exceptions })}`);
  }
  await screenshot(cdp, join(artifacts, `homepage-${width}x${height}.png`));
  return { width, height, baseline, after };
}

async function main() {
  await mkdir(artifacts, { recursive: true });
  const server = createServer((request, response) => requestHandler(request, response).catch((error) => json(response, { error: error.message }, 500)));
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  const profile = await mkdtemp(join(tmpdir(), "idol-home-smoke-"));
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
      if (params.type === "error") exceptions.push(params.args?.map((arg) => arg.value || arg.description).join(" ") || params.type);
    });
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    const results = [];
    for (const [width, height] of viewports) {
      exceptions.length = 0;
      results.push(await exercise(cdp, width, height, exceptions));
    }
    const report = { ok: true, chrome: version.Browser, origin, authority: identity, results };
    await writeFile(join(artifacts, "homepage-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`homepage browser smoke passed: ${version.Browser}`);
  } finally {
    await terminateChrome(chrome, cdp);
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch(async (error) => {
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(artifacts, "homepage-failure.txt"), `${error.stack || error}\n`);
  console.error(error.stack || error);
  process.exitCode = 1;
});
