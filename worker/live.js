import { bearerToken, verifyAccessJwt } from "../shared/platform-auth.js";
import { createD1PlatformRepository } from "../shared/platform-d1.js";
import { createPlatformService, PlatformError } from "../shared/platform.js";
import { LiveError } from "../shared/live.js";
import { createD1LiveStore } from "../shared/live-d1.js";
import { createLiveService } from "../shared/live-service.js";
import { createD1UniverseStore } from "../shared/universe-d1.js";

const BODY_LIMIT = 64 * 1024;
const ID = "lp_[A-Za-z0-9_-]{12,}";
const BROWSER = "/v1/live/browser";
const API = "/v1/live/api";
const PROJECT = new RegExp(`^/(?:v1/live/(browser|api))/projects/(${ID})$`);
const PROJECT_ACTION = new RegExp(`^/(?:v1/live/(browser|api))/projects/(${ID})/(graph|nodes|applications|events|frontier|world-view)$`);

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function errorResponse(error) {
  if (error instanceof LiveError || error instanceof PlatformError || (error?.code && error?.status)) return json({ error: error.code, detail: error.message }, Number(error.status || 400));
  console.error("Live transport failure", error);
  return json({ error: "LIVE_INTERNAL_ERROR", detail: "Live operation failed closed" }, 500);
}
function configured(env, dependencies) {
  return {
    access: Boolean(dependencies.verifyAccess || (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD && (env.ACCESS_EMAIL || env.ACCESS_EMAIL_DOMAIN))),
    storage: Boolean(dependencies.liveStore || env.PLATFORM_DB),
  };
}
async function readJson(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json")) throw new LiveError("LIVE_JSON_REQUIRED", "application/json request required", 415);
  const announced = Number(request.headers.get("content-length") || 0);
  if (announced > BODY_LIMIT) throw new LiveError("LIVE_BODY_TOO_LARGE", "Live request body is too large", 413);
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > BODY_LIMIT) throw new LiveError("LIVE_BODY_TOO_LARGE", "Live request body is too large", 413);
  try { return JSON.parse(body || "{}"); } catch { throw new LiveError("INVALID_LIVE_JSON", "Live request body must be valid JSON", 400); }
}
function sameOrigin(request) {
  return request.headers.get("origin") === "https://live.idol.id" && request.headers.get("x-idol-request") === "browser";
}
async function browserIdentity(request, env, dependencies, mutation = false) {
  if (mutation && !sameOrigin(request)) throw new LiveError("BROWSER_REQUEST_PROOF_REQUIRED", "same-origin browser request proof required", 403);
  if (typeof dependencies.verifyAccess === "function") {
    const value = await dependencies.verifyAccess(request, env);
    if (!value) throw new LiveError("ACCESS_IDENTITY_REQUIRED", "Cloudflare Access identity required", 401);
    return value;
  }
  const token = request.headers.get("cf-access-jwt-assertion") || request.headers.get("CF-Access-Jwt-Assertion");
  if (!token) throw new LiveError("ACCESS_IDENTITY_REQUIRED", "Cloudflare Access identity required", 401);
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
    throw new LiveError("ACCESS_IDENTITY_INVALID", error.message, 401);
  }
}
function platformService(env, dependencies) {
  if (dependencies.platformService) return dependencies.platformService;
  const repository = dependencies.platformRepository || (env.PLATFORM_DB?.prepare ? createD1PlatformRepository(env.PLATFORM_DB) : null);
  if (!repository) throw new LiveError("LIVE_STORAGE_UNAVAILABLE", "Platform token storage unavailable", 503);
  return createPlatformService({ repository, now: dependencies.now, randomBytes: dependencies.randomBytes });
}
function universeLookup(env, dependencies) {
  if (dependencies.universeService) return dependencies.universeService;
  if (!env.PLATFORM_DB?.prepare) throw new LiveError("LIVE_UNIVERSE_UNAVAILABLE", "Universe View storage unavailable", 503);
  const store = createD1UniverseStore(env.PLATFORM_DB);
  return Object.freeze({
    async getView(identity, id) {
      const view = await store.getView(identity.subject, id);
      if (!view) throw new LiveError("LIVE_UNIVERSE_VIEW_NOT_FOUND", "Universe View not found", 404);
      return view;
    },
  });
}
function liveService(env, dependencies) {
  const store = dependencies.liveStore || (env.PLATFORM_DB?.prepare ? createD1LiveStore(env.PLATFORM_DB) : null);
  if (!store) throw new LiveError("LIVE_STORAGE_UNAVAILABLE", "Live storage unavailable", 503);
  return createLiveService({ store, universe: universeLookup(env, dependencies), now: dependencies.now, randomBytes: dependencies.randomBytes });
}
async function apiIdentity(request, platform, scopes) {
  const token = bearerToken(request);
  if (!token) throw new LiveError("API_TOKEN_REQUIRED", "API token required", 401);
  return platform.authenticateApiToken(token, scopes);
}
async function routeCollection(request, service, identity, mutation) {
  if (request.method === "GET") return json({ projects: await service.listProjects(identity, 50) });
  if (request.method === "POST") {
    if (mutation) return json(await service.createProject(identity, await readJson(request)), 201);
  }
  return json({ error: "LIVE_ROUTE_NOT_FOUND" }, 404);
}
async function routeProject(request, service, identity, projectId, mutation) {
  if (request.method === "GET") return json(await service.getProject(identity, projectId));
  if (request.method === "PATCH" && mutation) return json(await service.updateProject(identity, projectId, await readJson(request)));
  return json({ error: "LIVE_ROUTE_NOT_FOUND" }, 404);
}
async function routeAction(request, service, identity, projectId, action, mutation) {
  if (action === "graph" && request.method === "GET") return json(await service.graph(identity, projectId));
  if (!mutation) return json({ error: "LIVE_ROUTE_NOT_FOUND" }, 404);
  const body = await readJson(request);
  if (action === "nodes" && request.method === "POST") return json(await service.createNode(identity, projectId, body), 201);
  if (action === "applications" && request.method === "POST") return json(await service.createApplication(identity, projectId, body), 201);
  if (action === "events" && request.method === "POST") return json(await service.appendEvent(identity, projectId, body), 201);
  if (action === "frontier" && request.method === "POST") return json(await service.setFrontier(identity, projectId, body));
  if (action === "world-view" && request.method === "PUT") return json(await service.bindUniverseView(identity, projectId, body.universe_view_id));
  return json({ error: "LIVE_ROUTE_NOT_FOUND" }, 404);
}

export async function handleLiveTransport(request, env, pathname, info, dependencies = {}) {
  if (!pathname.startsWith("/v1/live/")) return null;
  try {
    if (pathname === "/v1/live/status" && (request.method === "GET" || request.method === "HEAD")) {
      if (info.surface !== "live") return json({ error: "LIVE_STATUS_HOST_REQUIRED" }, 404);
      return json({
        schema: "idol.web.live.status.v1",
        configured: configured(env, dependencies),
        semantic_authority: false,
        collaboration_truth: true,
        semantic_universes: 1,
        accepted_frontiers_per_project: 1,
        world_authority_grant: "none",
        dispatcher_access: false,
        browser: `${BROWSER}/projects`,
        api: `${API}/projects`,
      });
    }

    if (pathname.startsWith(`${BROWSER}/`)) {
      if (info.surface !== "live") return json({ error: "LIVE_BROWSER_HOST_REQUIRED" }, 404);
      const platform = platformService(env, dependencies);
      if (pathname === `${BROWSER}/session` && request.method === "GET") {
        const identity = await browserIdentity(request, env, dependencies, false);
        return json(await platform.session(identity));
      }
      const mutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
      const identity = await browserIdentity(request, env, dependencies, mutation);
      const service = liveService(env, dependencies);
      if (pathname === `${BROWSER}/projects`) return routeCollection(request, service, identity, mutation);
      const project = PROJECT.exec(pathname);
      if (project && project[1] === "browser") return routeProject(request, service, identity, project[2], mutation);
      const action = PROJECT_ACTION.exec(pathname);
      if (action && action[1] === "browser") return routeAction(request, service, identity, action[2], action[3], mutation);
      return json({ error: "LIVE_BROWSER_ROUTE_NOT_FOUND" }, 404);
    }

    if (pathname.startsWith(`${API}/`)) {
      if (info.surface !== "api") return json({ error: "LIVE_API_HOST_REQUIRED" }, 404);
      const platform = platformService(env, dependencies);
      const mutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
      const identity = await apiIdentity(request, platform, mutation ? ["live:write"] : ["live:read"]);
      const service = liveService(env, dependencies);
      if (pathname === `${API}/projects`) return routeCollection(request, service, identity, mutation);
      const project = PROJECT.exec(pathname);
      if (project && project[1] === "api") return routeProject(request, service, identity, project[2], mutation);
      const action = PROJECT_ACTION.exec(pathname);
      if (action && action[1] === "api") return routeAction(request, service, identity, action[2], action[3], mutation);
      return json({ error: "LIVE_API_ROUTE_NOT_FOUND" }, 404);
    }

    return json({ error: "LIVE_ROUTE_NOT_FOUND" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
