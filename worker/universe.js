import { bearerToken, verifyAccessJwt } from "../shared/platform-auth.js";
import { createD1PlatformRepository } from "../shared/platform-d1.js";
import { createPlatformService, PlatformError } from "../shared/platform.js";
import { UniverseError, catalogUniverseWorlds } from "../shared/universe.js";
import { createD1UniverseStore } from "../shared/universe-d1.js";
import { createUniverseService } from "../shared/universe-service.js";

const ID = "uv_[A-Za-z0-9_-]{12,}";
const BROWSER_COLLECTION = "/v1/universe/browser/views";
const API_COLLECTION = "/v1/universe/api/views";
const BROWSER_ITEM = new RegExp(`^/v1/universe/browser/views/(${ID})$`);
const API_ITEM = new RegExp(`^/v1/universe/api/views/(${ID})$`);
const PUBLIC_ITEM = new RegExp(`^/v1/universe/public/(${ID})$`);
const MAX_BODY_BYTES = 64 * 1024;
const CATALOG_CACHE = new Map();

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function errorResponse(error) {
  if (error instanceof UniverseError || error instanceof PlatformError || (error?.code && error?.status)) {
    return json({ error: error.code, detail: error.message }, Number(error.status || 400));
  }
  console.error("Universe transport failure", error);
  return json({ error: "UNIVERSE_INTERNAL_ERROR", detail: "Universe View operation failed" }, 500);
}

function sameOriginBrowser(request) {
  return request.headers.get("origin") === "https://platform.idol.id"
    && request.headers.get("x-idol-request") === "browser";
}

async function readJson(request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new UniverseError("UNIVERSE_BODY_TOO_LARGE", "Universe View request body is too large", 413);
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) throw new UniverseError("UNIVERSE_BODY_TOO_LARGE", "Universe View request body is too large", 413);
  try { return JSON.parse(body || "{}"); } catch { throw new UniverseError("INVALID_UNIVERSE_JSON", "Universe View request body must be valid JSON", 400); }
}

async function accessIdentity(request, env, dependencies) {
  if (typeof dependencies.verifyAccess === "function") return dependencies.verifyAccess(request, env);
  const token = request.headers.get("cf-access-jwt-assertion") || request.headers.get("CF-Access-Jwt-Assertion");
  if (!token) throw new UniverseError("UNIVERSE_ACCESS_REQUIRED", "Cloudflare Access identity required", 401);
  try {
    return await verifyAccessJwt(token, {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      email: env.ACCESS_EMAIL,
      emailDomain: env.ACCESS_EMAIL_DOMAIN,
      fetcher: dependencies.fetcher,
      now: dependencies.nowMs,
    });
  } catch (error) {
    throw new UniverseError("UNIVERSE_ACCESS_REFUSED", error.message, 401);
  }
}

async function assetJson(request, env, path) {
  if (!env.ASSETS?.fetch) throw new UniverseError("UNIVERSE_CATALOG_UNAVAILABLE", "deployed world catalogs are unavailable", 503);
  const url = new URL(path, request.url);
  const response = await env.ASSETS.fetch(new Request(url, { headers: { accept: "application/json" } }));
  if (!response.ok) throw new UniverseError("UNIVERSE_CATALOG_UNAVAILABLE", `deployed catalog unavailable: ${path}`, 503);
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

async function services(request, env, dependencies) {
  const universe = dependencies.universeService || (() => {
    if (!env.PLATFORM_DB?.prepare || !env.PLATFORM_DB?.batch) {
      throw new UniverseError("UNIVERSE_STORAGE_UNAVAILABLE", "Universe View storage unavailable", 503);
    }
    return null;
  })();
  const platform = dependencies.platformService || (() => {
    if (!env.PLATFORM_DB?.prepare) throw new UniverseError("UNIVERSE_STORAGE_UNAVAILABLE", "Platform token storage unavailable", 503);
    return createPlatformService({
      repository: createD1PlatformRepository(env.PLATFORM_DB),
      now: dependencies.now,
      randomBytes: dependencies.randomBytes,
    });
  })();
  if (universe) return { universe, platform };
  return {
    universe: createUniverseService({
      store: createD1UniverseStore(env.PLATFORM_DB),
      catalogs: await catalogs(request, env, dependencies),
      now: dependencies.now,
      randomBytes: dependencies.randomBytes,
    }),
    platform,
  };
}

async function browserIdentity(request, env, dependencies, mutation = false) {
  if (mutation && !sameOriginBrowser(request)) throw new UniverseError("UNIVERSE_BROWSER_ORIGIN_REFUSED", "same-origin browser proof required", 403);
  return accessIdentity(request, env, dependencies);
}

async function apiIdentity(request, platform, scope) {
  const token = bearerToken(request);
  if (!token) throw new UniverseError("UNIVERSE_API_TOKEN_REQUIRED", "API token required", 401);
  return platform.authenticateApiToken(token, scope);
}

export async function handleUniverseTransport(request, env, pathname, info, dependencies = {}) {
  if (!pathname.startsWith("/v1/universe/")) return null;
  try {
    if (pathname === "/v1/universe/status") {
      if (info.app !== "platform") return json({ error: "UNIVERSE_STATUS_HOST_REQUIRED" }, 404);
      return json({
        schema: "idol.web.universe.status.v1",
        status: "operational-projection",
        semantic_universes: 1,
        view_kind: "operational-projection",
        composition: false,
        equivalence: false,
        authority_grant: false,
        repository_write: false,
        dispatcher_access: false,
      });
    }

    const publicMatch = PUBLIC_ITEM.exec(pathname);
    if (publicMatch) {
      if (info.app !== "lib") return json({ error: "UNIVERSE_PUBLIC_HOST_REQUIRED" }, 404);
      const { universe } = await services(request, env, dependencies);
      return json(await universe.getPublicView(publicMatch[1]), 200, { "cache-control": "public, max-age=60" });
    }
    if (pathname === "/v1/universe/public") {
      if (info.app !== "lib" || request.method !== "GET") return json({ error: "UNIVERSE_PUBLIC_HOST_REQUIRED" }, 404);
      const { universe } = await services(request, env, dependencies);
      return json({ views: await universe.listPublicViews(50) }, 200, { "cache-control": "public, max-age=30" });
    }

    if (pathname.startsWith("/v1/universe/browser/")) {
      if (info.app !== "platform") return json({ error: "UNIVERSE_BROWSER_HOST_REQUIRED" }, 404);
      const { universe } = await services(request, env, dependencies);
      if (pathname === BROWSER_COLLECTION) {
        if (request.method === "GET") {
          const identity = await browserIdentity(request, env, dependencies, false);
          return json({ views: await universe.listViews(identity, 50) });
        }
        if (request.method === "POST") {
          const identity = await browserIdentity(request, env, dependencies, true);
          return json(await universe.createView(identity, await readJson(request)), 201);
        }
      }
      const match = BROWSER_ITEM.exec(pathname);
      if (match) {
        if (request.method === "GET") {
          const identity = await browserIdentity(request, env, dependencies, false);
          return json(await universe.getView(identity, match[1]));
        }
        if (request.method === "PATCH") {
          const identity = await browserIdentity(request, env, dependencies, true);
          return json(await universe.updateView(identity, match[1], await readJson(request)));
        }
      }
      return json({ error: "UNIVERSE_BROWSER_ROUTE_NOT_FOUND" }, 404);
    }

    if (pathname.startsWith("/v1/universe/api/")) {
      if (info.app !== "api") return json({ error: "UNIVERSE_API_HOST_REQUIRED" }, 404);
      const { universe, platform } = await services(request, env, dependencies);
      if (pathname === API_COLLECTION) {
        if (request.method === "GET") {
          const identity = await apiIdentity(request, platform, "universe:read");
          return json({ views: await universe.listViews(identity, 50) });
        }
        if (request.method === "POST") {
          const identity = await apiIdentity(request, platform, "universe:write");
          return json(await universe.createView(identity, await readJson(request)), 201);
        }
      }
      const match = API_ITEM.exec(pathname);
      if (match && request.method === "GET") {
        const identity = await apiIdentity(request, platform, "universe:read");
        return json(await universe.getView(identity, match[1]));
      }
      return json({ error: "UNIVERSE_API_ROUTE_NOT_FOUND" }, 404);
    }

    return json({ error: "UNIVERSE_ROUTE_NOT_FOUND" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
