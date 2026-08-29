import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const artifacts = resolve(".artifacts/live-surfaces");
const debugPort = Number(process.env.IDOL_SURFACE_AUDIT_DEBUG_PORT || 9249);
const viewports = [[390, 844], [1440, 1000]];
const excludedHosts = new Set(["hermes.idol.id", "claw.idol.id"]);
const surfaces = Object.freeze([
  { id: "compiler", url: "https://idol.id/", kind: "public", marker: "Dynamic by default" },
  { id: "www", url: "https://www.idol.id/", kind: "redirect", finalHost: "idol.id" },
  { id: "docs", url: "https://docs.idol.id/", kind: "public", marker: "Idol" },
  { id: "library", url: "https://lib.idol.id/", kind: "public", marker: "Idol" },
  { id: "api", url: "https://api.idol.id/", kind: "public", marker: "Idol" },
  { id: "graph", url: "https://graph.idol.id/", kind: "public", marker: "Idol" },
  { id: "worlds-compatibility", url: "https://worlds.idol.id/", kind: "redirect", finalHost: "lib.idol.id" },
  { id: "platform", url: "https://platform.idol.id/", kind: "protected", finalHost: "platform.idol.id" },
  { id: "r8a", url: "https://r8a.idol.id/", kind: "public", marker: "Idol" },
  { id: "r8b", url: "https://r8b.idol.id/", kind: "public", marker: "Idol" },
  { id: "r16", url: "https://r16.idol.id/", kind: "public", marker: "Idol" },
  { id: "live", url: "https://live.idol.id/", kind: "optional" },
  { id: "mcp", url: "https://mcp.idol.id/", kind: "optional" },
]);

for (const surface of surfaces) {
  const host = new URL(surface.url).hostname;
  if (excludedHosts.has(host)) throw new Error(`agent console entered public audit scope: ${host}`);
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

async function chromePath() {
  for (const candidate of [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean)) {
    try { await access(candidate, constants.X_OK); return candidate; } catch {}
  }
  throw new Error("Chrome/Chromium executable not found");
}
async function waitFor(url, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`timed out waiting for ${url}`);
}
async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
  return result.result?.value;
}
async function waitExpression(cdp, predicate, timeout = 20000) {
  return evaluate(cdp, `(async()=>{const started=Date.now();while(Date.now()-started<${timeout}){if(${predicate})return true;await new Promise(r=>setTimeout(r,100));}throw new Error(${JSON.stringify(`timed out: ${predicate}`)});})()`);
}
async function screenshot(cdp, path) {
  const value = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path, Buffer.from(value.data, "base64"));
}
async function waitForExit(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolveExit) => {
    const timer = setTimeout(() => resolveExit(false), timeout);
    child.once("close", () => { clearTimeout(timer); resolveExit(true); });
    child.once("error", () => { clearTimeout(timer); resolveExit(false); });
  });
}
async function terminate(chrome, cdp) {
  try { await cdp?.close(); } catch {}
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  chrome.kill("SIGTERM");
  if (await waitForExit(chrome, 4000)) return;
  chrome.kill("SIGKILL");
  await waitForExit(chrome, 2000);
}

async function transport(surface) {
  try {
    const response = await fetch(surface.url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    return { reachable: true, status: response.status, location: response.headers.get("location"), type: response.headers.get("content-type") };
  } catch (error) {
    return { reachable: false, error: error.message || String(error) };
  }
}

async function auditView(cdp, surface, width, height, exceptions) {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 760, screenWidth: width, screenHeight: height });
  await cdp.call("Page.navigate", { url: surface.url });
  await waitExpression(cdp, `document.readyState==="complete"`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 1200));
  const observed = await evaluate(cdp, `(()=>{
    const text=(document.body?.innerText||"").trim();
    const controls=[...document.querySelectorAll("button,.button,.btn,.nav-toggle,a.nav-cta")].filter(node=>{const style=getComputedStyle(node);return style.display!=="none"&&style.visibility!=="hidden";}).map(node=>node.getBoundingClientRect().height);
    const topbar=document.querySelector(".topbar");
    return {
      href:location.href,
      host:location.hostname,
      title:document.title,
      textLength:text.length,
      stale:/\\b(?:Idsem|Duo|Duon)\\b/i.test(text),
      marker:${JSON.stringify(surface.marker || "")}?text.includes(${JSON.stringify(surface.marker || "")}):true,
      topbar:Boolean(topbar),
      width:document.documentElement.scrollWidth,
      clientWidth:document.documentElement.clientWidth,
      short:controls.filter(height=>height < 44),
      appError:window.__QA_APP_ERROR||null,
    };
  })()`);
  const protectedPage = /cloudflareaccess\.com$/.test(observed.host) || /access/i.test(observed.title);
  const optionalAbsent = surface.kind === "optional" && (!observed.textLength || /error|not found|unknown/i.test(observed.title));
  const failures = [];
  if (surface.kind === "redirect" && observed.host !== surface.finalHost) failures.push(`redirect landed on ${observed.host}`);
  else if (surface.kind === "protected" && !protectedPage && observed.host !== surface.finalHost) failures.push(`protected surface landed on ${observed.host}`);
  else if (surface.kind === "public") {
    if (observed.host !== new URL(surface.url).hostname) failures.push(`unexpected host ${observed.host}`);
    if (observed.textLength < 80) failures.push("blank or skeletal page");
    if (!observed.marker) failures.push(`missing marker ${surface.marker}`);
    if (!observed.topbar) failures.push("shared chrome missing");
    if (observed.stale) failures.push("superseded identity visible");
    if (observed.width > observed.clientWidth) failures.push(`horizontal overflow ${observed.width}>${observed.clientWidth}`);
    if (width <= 760 && observed.short.length) failures.push(`touch controls below 44px: ${observed.short.join(",")}`);
    if (observed.appError) failures.push(`application error: ${observed.appError}`);
    if (exceptions.length) failures.push(`console/runtime errors: ${exceptions.join(" | ")}`);
  }
  await screenshot(cdp, join(artifacts, `${surface.id}-${width}x${height}.png`));
  return { surface: surface.id, width, height, protectedPage, optionalAbsent, observed, failures };
}

async function main() {
  await rm(artifacts, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), "idol-live-surfaces-"));
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
    cdp.on("Runtime.consoleAPICalled", (params) => { if (params.type === "error") exceptions.push(params.args?.map((arg) => arg.value || arg.description).join(" ") || "console error"); });
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    const results = [];
    for (const surface of surfaces) {
      const transportResult = await transport(surface);
      if (!transportResult.reachable && surface.kind === "optional") {
        results.push({ surface: surface.id, transport: transportResult, optionalAbsent: true, failures: [] });
        continue;
      }
      if (!transportResult.reachable) {
        results.push({ surface: surface.id, transport: transportResult, failures: ["transport unavailable"] });
        continue;
      }
      for (const [width, height] of viewports) {
        exceptions.length = 0;
        const view = await auditView(cdp, surface, width, height, exceptions);
        results.push({ ...view, transport: transportResult });
      }
    }
    const failures = results.flatMap((result) => result.failures.map((failure) => `${result.surface} ${result.width || "transport"}x${result.height || ""}: ${failure}`));
    const report = { schema: "idol.public.surfaces.audit.v1", observedAt: new Date().toISOString(), chrome: version.Browser, exclusions: [...excludedHosts], surfaces: surfaces.map((surface) => surface.url), results, failures, ok: failures.length === 0 };
    await writeFile(join(artifacts, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (failures.length) throw new Error(`live surface audit failed:\n${failures.join("\n")}`);
    console.log(`live surface audit passed: ${results.length} observations`);
  } finally {
    await terminate(chrome, cdp);
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch(async (error) => { await mkdir(artifacts, { recursive: true }); await writeFile(join(artifacts, "failure.txt"), `${error.stack || error}\n`); console.error(error.stack || error); process.exitCode = 1; });
