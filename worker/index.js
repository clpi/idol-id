const HOSTS = Object.freeze({
  "idol.id": { app: "site", surface: "site" },
  "www.idol.id": { app: "site", surface: "site", redirect: "https://idol.id" },
  "docs.idol.id": { app: "docs", surface: "docs" },
  "lib.idol.id": { app: "lib", surface: "lib" },
  "api.idol.id": { app: "api", surface: "api" },
  "graph.idol.id": { app: "graph", surface: "graph" },
  "r8a.idol.id": { app: "graph", surface: "r8a" },
  "r8b.idol.id": { app: "graph", surface: "r8b" },
  "r16.idol.id": { app: "graph", surface: "r16" },
});

const SHARED_PREFIXES = ["/shared/", "/content/", "/runtime/", "/apps/"];
const PASSTHROUGH_PREFIXES = ["/api/"];
const PASSTHROUGH_PATHS = new Set(["/health", "/info", "/origin-health", "/origin-info"]);
const CACHEABLE_EXT = /\.(?:css|js|mjs|json|md|txt|svg|png|jpe?g|gif|webp|ico|woff2?|wasm|map)$/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function resolveHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/:\d+$/, "");
  return HOSTS[host] || null;
}

export function configSource(info, host, commit, authority) {
  const config = {
    app: info.app,
    surface: info.surface,
    host,
    api: "",
    commit,
    authority,
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
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; img-src 'self' data:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
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

async function asset(env, request, pathname, options = {}) {
  const response = await env.ASSETS.fetch(assetRequest(request, pathname));
  if (!response.ok) return response;
  return secure(response, options);
}

async function appShell(env, request, app) {
  return asset(env, request, `/apps/${app}/index.html`, { html: true });
}

function shouldProxy(pathname, method) {
  if (method !== "GET" && method !== "HEAD") return true;
  if (PASSTHROUGH_PATHS.has(pathname)) return true;
  return PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

export async function handle(request, env) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  let info = resolveHost(host);
  if (!info && LOCAL_HOSTS.has(host)) {
    const surface = url.searchParams.get("surface") || "site";
    info = surface === "docs" || surface === "lib" || surface === "api"
      ? { app: surface, surface }
      : surface === "graph" || surface === "r8a" || surface === "r8b" || surface === "r16"
        ? { app: "graph", surface }
        : { app: "site", surface: "site" };
  }

  if (!info) return json({ error: "unknown idol.id surface", host }, { status: 404 });
  if (info.redirect) return Response.redirect(`${info.redirect}${url.pathname}${url.search}`, 308);

  const commit = env.IDOL_COMMIT || "development";
  const authority = env.IDOL_AUTHORITY || "f33bb3773484e7d954a2975211e683dfa89edab5";

  if (url.pathname === "/__idol/version") {
    return json({ service: "idol-id", commit, authority, app: info.app, surface: info.surface });
  }
  if (url.pathname === "/__idol/health") {
    return json({ status: "healthy", edge: true, commit, authority, app: info.app, surface: info.surface });
  }
  if (url.pathname === "/__idol/manifest") {
    return asset(env, request, "/manifest.json", { immutable: false });
  }
  if (url.pathname === "/config.js") {
    return secure(
      new Response(configSource(info, host, commit, authority), {
        headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
      }),
    );
  }

  if (shouldProxy(url.pathname, request.method)) return proxyOrigin(request);

  if (SHARED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    const response = await asset(env, request, url.pathname, { immutable: CACHEABLE_EXT.test(url.pathname) });
    if (response.ok) return response;
  }

  if (CACHEABLE_EXT.test(url.pathname)) {
    let response = await asset(env, request, url.pathname, { immutable: true });
    if (response.ok) return response;
    response = await asset(env, request, `/apps/${info.app}${url.pathname}`, { immutable: true });
    if (response.ok) return response;
    return secure(await fetch(request));
  }

  if (isNavigation(request, url.pathname)) return appShell(env, request, info.app);

  return secure(await fetch(request));
}

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
