import { handle as baseHandle, resolveHost } from "./index.js";
import { handleRepositoryTransport } from "./repository.js";
import { handleUniverseTransport } from "./universe.js";

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);
function secure(response, options = {}) {
  if (response.webSocket || response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-site");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; img-src 'self' data:; font-src 'self' data: https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  if (options.html) headers.set("cache-control", "no-cache, must-revalidate");
  else if (options.immutable) headers.set("cache-control", "public, max-age=31536000, immutable");
  else if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=300, stale-while-revalidate=86400");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function localRepositoryPath(pathname) { return pathname === "/repo" || pathname === "/repo/" || pathname.startsWith("/repo/observation/") || pathname.startsWith("/repo/scaffold/") || pathname.startsWith("/v1/repository/browser/") || pathname === "/v1/repository/status"; }
function localUniversePath(pathname) { return pathname === "/universe" || pathname === "/universe/" || /^\/universe\/uv_[A-Za-z0-9_-]{12,}\/?$/.test(pathname) || pathname.startsWith("/v1/universe/"); }
function infoFor(url) {
  const known = resolveHost(url.hostname);
  if (known) return known;
  if (LOCAL.has(url.hostname) && (url.searchParams.get("surface") === "repository" || localRepositoryPath(url.pathname))) return { app: "repository", surface: "platform", origin: false, local_repository: true };
  if (LOCAL.has(url.hostname) && (url.searchParams.get("surface") === "universe" || localUniversePath(url.pathname))) return url.searchParams.get("mode") === "public" ? { app: "lib", surface: "lib", origin: false, local_universe: true } : { app: "platform", surface: "platform", origin: false, local_universe: true };
  return null;
}
function assetRequest(request, path) {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = "";
  return new Request(url, { method: "GET", headers: request.headers });
}
async function asset(env, request, path, options = {}) {
  const response = await env.ASSETS.fetch(assetRequest(request, path));
  return (response.ok || response.status === 304) ? secure(response, options) : response;
}
function repositoryNavigation(request, path) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return path === "/repo" || path === "/repo/" || /^\/repo\/(?:observation|scaffold)\/[^/]+\/?$/.test(path);
}
function universeNavigation(request, path) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return path === "/universe" || path === "/universe/" || /^\/universe\/uv_[A-Za-z0-9_-]{12,}\/?$/.test(path);
}

export async function handle(request, env, dependencies = {}) {
  const url = new URL(request.url);
  const info = infoFor(url);
  if ((url.pathname === "/install" || url.pathname === "/install.sh") && url.hostname === "idol.id") return asset(env, request, "/content/install.sh", { immutable: false });
  if (url.pathname === "/install.ps1" && url.hostname === "idol.id") return asset(env, request, "/content/install.ps1", { immutable: false });
  if (info?.redirect) return baseHandle(request, env, dependencies);
  if (info) {
    const universeInfo = info.surface === "lib" ? { ...info, app: "worlds" } : info;
    const universeResponse = await handleUniverseTransport(request, env, url.pathname, universeInfo, dependencies);
    if (universeResponse) return secure(universeResponse);
    const repositoryResponse = await handleRepositoryTransport(request, env, url.pathname, info, dependencies);
    if (repositoryResponse) return secure(repositoryResponse);
    if (info.surface === "platform" && repositoryNavigation(request, url.pathname)) return asset(env, request, "/apps/repository/index.html", { html: true });
    if (universeNavigation(request, url.pathname)) {
      if (info.surface === "lib" && url.searchParams.get("mode") !== "public") {
        const target = new URL(request.url);
        target.searchParams.set("mode", "public");
        return Response.redirect(target.toString(), 307);
      }
      if (["platform", "lib"].includes(info.surface)) return asset(env, request, "/apps/universe/index.html", { html: true });
    }
  }
  return baseHandle(request, env, dependencies);
}
export default { fetch(request, env) { return handle(request, env); } };
