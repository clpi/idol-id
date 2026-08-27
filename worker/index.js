import { parseImportRequest, planForeignImport } from "../shared/foreign.js";
import { handleIdeTransport } from "./ide.js";
import { handlePlatformTransport } from "./platform.js";

export const hostMap = Object.freeze({
  "idol.id": { app: "site", surface: "site", origin: true },
  "www.idol.id": { app: "site", surface: "site", origin: true, redirect: "https://idol.id" },
  "docs.idol.id": { app: "docs", surface: "docs", origin: true },
  "lib.idol.id": { app: "lib", surface: "lib", origin: true },
  "api.idol.id": { app: "api", surface: "api", origin: true },
  "graph.idol.id": { app: "graph", surface: "graph", origin: true },
  "worlds.idol.id": { app: "lib", surface: "lib", origin: false, redirect: "https://lib.idol.id" },
  "platform.idol.id": { app: "platform", surface: "platform", origin: false },
  "r8a.idol.id": { app: "graph", surface: "r8a", origin: true },
  "r8b.idol.id": { app: "graph", surface: "r8b", origin: true },
  "r16.idol.id": { app: "graph", surface: "r16", origin: true },
});

const SHARED_PREFIXES = ["/shared/", "/content/", "/runtime/", "/apps/"];
const PASSTHROUGH_PREFIXES = ["/api/"];
const PASSTHROUGH_PATHS = new Set(["/health", "/info", "/origin-health", "/origin-info"]);
const CACHEABLE_EXT = /\.(?:css|js|mjs|json|md|txt|svg|png|jpe?g|gif|webp|ico|woff2?|wasm|map)$/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const IMPORT_BODY_LIMIT = 32 * 1024;

export function resolveHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/:\d+$/, "");
  return hostMap[host] || null;
}

export function configSource(info, host, commit, authority) {
  const config = {
    app: info.app,
    surface: info.surface,
    host,
    origin: info.origin !== false,
    api: "",
    commit,
    authority: authority.language.commit,
    native_authority: authority.native.commit,
    source_law: authority.language.source_law.sha256,
    runtime: "/runtime/manifest.json",
  };
  return `window.IDOL = Object.freeze(${JSON.stringify(config)});\n`;
}

function json(value, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return secure(new Response(JSON.stringify(value), { ...init, headers }));
}

function secure(response, options = {}) {
  if (response.webSocket || response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-site");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  headers.set(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; img-src 'self' data:; font-src 'self' data: https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  if (options.html) headers.set("cache-control", "no-cache, must-revalidate");
  else if (options.immutable) headers.set("cache-control", "public, max-age=31536000, immutable");
  else if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=300, stale-while-revalidate=86400");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function assetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  return new Request(url, request);
}

function projectionRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  return new Request(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });
}

async function asset(env, request, pathname, options = {}) {
  const response = await env.ASSETS.fetch(assetRequest(request, pathname));
  if (!response.ok) return response;
  return secure(response, options);
}

function assetFound(response) {
  return response.ok || response.status === 304;
}

async function readJsonAsset(env, request, pathname) {
  const response = await env.ASSETS.fetch(projectionRequest(request, pathname));
  if (!response.ok) return { response: json({ error: "runtime projection unavailable", path: pathname }, { status: response.status }) };
  try {
    return { value: await response.json() };
  } catch {
    return { response: json({ error: "runtime projection is invalid JSON", path: pathname }, { status: 500 }) };
  }
}

function validRuntimeAuthority(value) {
  return Boolean(
    value &&
    typeof value.language?.commit === "string" && value.language.commit.length > 0 &&
    typeof value.native?.commit === "string" && value.native.commit.length > 0 &&
    typeof value.language?.source_law?.sha256 === "string" && value.language.source_law.sha256.length > 0
  );
}

async function loadRuntimeAuthority(env, request) {
  const loaded = await readJsonAsset(env, request, "/runtime/authority.json");
  if (loaded.response || !validRuntimeAuthority(loaded.value)) {
    return { response: json({ error: { code: "RUNTIME_AUTHORITY_UNAVAILABLE", message: "immutable runtime authority projection is unavailable or invalid" } }, { status: 503 }) };
  }
  return { value: loaded.value };
}

async function appShell(env, request, app) {
  return asset(env, request, `/apps/${app}/index.html`, { html: true });
}

function shouldProxy(pathname, method) {
  if (method !== "GET" && method !== "HEAD") return true;
  if (PASSTHROUGH_PATHS.has(pathname)) return true;
  return PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function originless(info) {
  return info.origin === false;
}

function noOrigin(info) {
  return json({ error: "dynamic origin unavailable on this surface", surface: info.surface }, { status: 404 });
}

async function proxyOrigin(request) {
  const url = new URL(request.url);
  if (url.pathname === "/origin-health") url.pathname = "/health";
  if (url.pathname === "/origin-info") url.pathname = "/info";
  return secure(await fetch(new Request(url, request)));
}

function isNavigation(request, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (pathname === "/") return true;
  const mode = request.headers.get("sec-fetch-mode");
  return mode === "navigate" || !CACHEABLE_EXT.test(pathname);
}

function localSurface(surface) {
  if (["docs", "lib", "api"].includes(surface)) return { app: surface, surface, origin: true };
  if (["graph", "r8a", "r8b", "r16"].includes(surface)) return { app: "graph", surface, origin: true };
  if (surface === "worlds" || surface === "atlas") return { app: "worlds", surface: "lib", origin: false };
  if (surface === "platform") return { app: "platform", surface: "platform", origin: false };
  if (surface === "ide") return { app: "ide", surface: "ide", origin: false };
  return { app: "site", surface: "site", origin: true };
}

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function worldTransport(request, env, pathname) {
  if ((request.method === "GET" || request.method === "HEAD") && pathname === "/v1/world/foreign") {
    const loaded = await readJsonAsset(env, request, "/runtime/foreign.json");
    return loaded.response || json(loaded.value);
  }

  const integration = /^\/v1\/world\/([^/]+)\/integration$/.exec(pathname);
  if ((request.method === "GET" || request.method === "HEAD") && integration) {
    const slug = decodePathPart(integration[1]);
    if (slug === null) return json({ error: "invalid world slug encoding" }, { status: 400 });
    const loaded = await readJsonAsset(env, request, "/runtime/foreign.json");
    if (loaded.response) return loaded.response;
    const world = (loaded.value.worlds || []).find((candidate) => candidate.slug === slug);
    if (!world) return json({ error: "foreign world integration not found", slug }, { status: 404 });
    return json({ schema: "idol.web.integration.v1", authority: loaded.value.authority, world });
  }

  if (request.method === "POST" && pathname === "/v1/world/import-plan") {
    const announced = Number(request.headers.get("content-length") || 0);
    if (announced > IMPORT_BODY_LIMIT) return json({ error: "import plan body too large" }, { status: 413 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > IMPORT_BODY_LIMIT) return json({ error: "import plan body too large" }, { status: 413 });
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return json({ error: "invalid JSON" }, { status: 400 });
    }
    const loaded = await readJsonAsset(env, request, "/runtime/foreign.json");
    if (loaded.response) return loaded.response;
    try {
      return json(planForeignImport(parseImportRequest(input), loaded.value));
    } catch (error) {
      return json({ error: error.message }, { status: error instanceof RangeError ? 422 : 400 });
    }
  }

  return null;
}

export async function handle(request, env, dependencies = {}) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  let info = resolveHost(host);
  if (!info && LOCAL_HOSTS.has(host)) info = localSurface(url.searchParams.get("surface") || "site");

  if (!info) return json({ error: "unknown idol.id surface", host }, { status: 404 });
  if (info.redirect) return Response.redirect(`${info.redirect}${url.pathname}${url.search}`, 308);

  const commit = env.IDOL_COMMIT || "development";

  if (["/__idol/version", "/__idol/health", "/config.js"].includes(url.pathname)) {
    const loaded = await loadRuntimeAuthority(env, request);
    if (loaded.response) return loaded.response;
    const authority = loaded.value;
    const identity = {
      commit,
      authority: authority.language.commit,
      native_authority: authority.native.commit,
      source_law: authority.language.source_law.sha256,
      app: info.app,
      surface: info.surface,
    };
    if (url.pathname === "/__idol/version") return json({ service: "idol-id", ...identity });
    if (url.pathname === "/__idol/health") return json({ status: "healthy", edge: true, ...identity });
    return secure(new Response(configSource(info, host, commit, authority), {
      headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
    }));
  }
  if (url.pathname === "/__idol/manifest") return asset(env, request, "/manifest.json", { immutable: false });

  const ideResponse = await handleIdeTransport(request, env, url.pathname, info, dependencies);
  if (ideResponse) return secure(ideResponse);

  const platformResponse = await handlePlatformTransport(request, env, url.pathname, info, dependencies);
  if (platformResponse) return secure(platformResponse);

  const worldResponse = await worldTransport(request, env, url.pathname);
  if (worldResponse) return worldResponse;

  if (shouldProxy(url.pathname, request.method)) {
    if (originless(info)) return noOrigin(info);
    return proxyOrigin(request);
  }

  if (SHARED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    const response = await asset(env, request, url.pathname, { immutable: CACHEABLE_EXT.test(url.pathname) });
    if (assetFound(response)) return response;
  }

  if (CACHEABLE_EXT.test(url.pathname)) {
    let response = await asset(env, request, url.pathname, { immutable: true });
    if (assetFound(response)) return response;
    response = await asset(env, request, `/apps/${info.app}${url.pathname}`, { immutable: true });
    if (assetFound(response)) return response;
    if (originless(info)) return noOrigin(info);
    return secure(await fetch(request));
  }

  if (info.surface === "platform" && /^\/ide(?:\/|$)/.test(url.pathname) && isNavigation(request, url.pathname)) {
    return appShell(env, request, "ide");
  }

  if (info.surface === "lib" && /^\/(?:atlas|world)(?:\/|$)/.test(url.pathname) && isNavigation(request, url.pathname)) {
    return appShell(env, request, "worlds");
  }

  if (info.surface === "lib" && /^\/universe(?:\/|$)/.test(url.pathname) && isNavigation(request, url.pathname)) {
    return appShell(env, request, "universe");
  }

  if (isNavigation(request, url.pathname)) return appShell(env, request, info.app);

  if (originless(info)) return noOrigin(info);
  return secure(await fetch(request));
}

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
