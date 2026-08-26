import { bearerToken, verifyAccessJwt } from "../shared/platform-auth.js";
import { createD1PlatformRepository } from "../shared/platform-d1.js";
import { createPlatformService, PLATFORM_AUTHORITY_BOUNDARY, PlatformError } from "../shared/platform.js";

const BODY_LIMIT = 16 * 1024;
const BROWSER_PREFIX = "/v1/platform/browser/";
const API_PREFIX = "/v1/platform/api/";

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function configured(env) {
  return {
    access: Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD && env.ACCESS_EMAIL_DOMAIN),
    storage: Boolean(env.PLATFORM_DB),
  };
}

async function browserIdentity(request, env, dependencies) {
  if (dependencies.verifyAccess) return dependencies.verifyAccess(request, env);
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion) return null;
  return verifyAccessJwt(assertion, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    audience: env.ACCESS_AUD,
    emailDomain: env.ACCESS_EMAIL_DOMAIN,
    fetcher: dependencies.fetcher || fetch,
    now: dependencies.nowMs || (() => Date.now()),
  });
}

function repository(env, dependencies) {
  if (dependencies.platformRepository) return dependencies.platformRepository;
  if (!env.PLATFORM_DB) return null;
  return createD1PlatformRepository(env.PLATFORM_DB);
}

function service(env, dependencies) {
  const platformRepository = repository(env, dependencies);
  return platformRepository ? createPlatformService({
    repository: platformRepository,
    now: dependencies.now,
    randomBytes: dependencies.randomBytes,
  }) : null;
}

function requireBrowserProof(request) {
  if (request.headers.get("origin") !== "https://platform.idol.id" || request.headers.get("x-idol-request") !== "browser") {
    throw new PlatformError("BROWSER_REQUEST_PROOF_REQUIRED", "same-origin browser request proof required", 403);
  }
  const type = request.headers.get("content-type") || "";
  if (request.method !== "GET" && request.method !== "HEAD" && !type.toLowerCase().startsWith("application/json")) {
    throw new PlatformError("JSON_REQUIRED", "application/json request required", 415);
  }
}

async function readJson(request) {
  const announced = Number(request.headers.get("content-length") || 0);
  if (announced > BODY_LIMIT) throw new PlatformError("REQUEST_BODY_TOO_LARGE", "platform request body too large", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > BODY_LIMIT) throw new PlatformError("REQUEST_BODY_TOO_LARGE", "platform request body too large", 413);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new PlatformError("INVALID_JSON", "invalid JSON", 400);
  }
}

function routeError(error) {
  if (error instanceof PlatformError) return json({ error: error.code, detail: error.message }, error.status);
  return json({ error: "PLATFORM_REQUEST_FAILED", detail: "platform request failed closed" }, 500);
}

async function browserTransport(request, env, pathname, info, dependencies) {
  if (info.surface !== "platform") return json({ error: "PLATFORM_BROWSER_HOST_REQUIRED" }, 404);
  if (!configured(env).access) return json({ error: "ACCESS_NOT_CONFIGURED" }, 503);
  const platform = service(env, dependencies);
  if (!platform) return json({ error: "PLATFORM_STORAGE_UNAVAILABLE" }, 503);

  let identity;
  try {
    identity = await browserIdentity(request, env, dependencies);
  } catch {
    return json({ error: "ACCESS_IDENTITY_INVALID" }, 401);
  }
  if (!identity) return json({ error: "ACCESS_IDENTITY_REQUIRED" }, 401);

  try {
    if (request.method === "GET" && pathname === `${BROWSER_PREFIX}session`) {
      return json(await platform.session(identity));
    }
    if (request.method === "GET" && pathname === `${BROWSER_PREFIX}profile`) {
      return json(await platform.profile(identity));
    }
    if (request.method === "PATCH" && pathname === `${BROWSER_PREFIX}profile`) {
      requireBrowserProof(request);
      return json(await platform.updateProfile(identity, await readJson(request)));
    }
    if (request.method === "GET" && pathname === `${BROWSER_PREFIX}tokens`) {
      return json({ tokens: await platform.listTokens(identity) });
    }
    if (request.method === "POST" && pathname === `${BROWSER_PREFIX}tokens`) {
      requireBrowserProof(request);
      return json(await platform.createToken(identity, await readJson(request)), 201);
    }
    const revoke = new RegExp(`^${BROWSER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([A-Za-z0-9_-]{12,})/revoke$`).exec(pathname);
    if (request.method === "POST" && revoke) {
      requireBrowserProof(request);
      return json(await platform.revokeToken(identity, revoke[1]));
    }
    if (request.method === "GET" && pathname === `${BROWSER_PREFIX}audit`) {
      return json({ events: await platform.audit(identity, 100) });
    }
    return json({ error: "PLATFORM_ROUTE_NOT_FOUND" }, 404);
  } catch (error) {
    return routeError(error);
  }
}

async function apiTransport(request, env, pathname, dependencies) {
  if (request.method !== "GET" || pathname !== `${API_PREFIX}whoami`) return json({ error: "PLATFORM_ROUTE_NOT_FOUND" }, 404);
  const platform = service(env, dependencies);
  if (!platform) return json({ error: "PLATFORM_STORAGE_UNAVAILABLE" }, 503);
  const token = bearerToken(request);
  if (!token) return json({ error: "API_TOKEN_REQUIRED" }, 401);
  try {
    return json({ principal: await platform.authenticateApiToken(token, "profile:read") });
  } catch (error) {
    return routeError(error);
  }
}

export async function handlePlatformTransport(request, env, pathname, info, dependencies = {}) {
  if (pathname === "/v1/platform/status" && (request.method === "GET" || request.method === "HEAD")) {
    return json({
      schema: "idol.web.platform.status.v1",
      configured: configured(env),
      browser: `${BROWSER_PREFIX}session`,
      api: `${API_PREFIX}whoami`,
      authority: PLATFORM_AUTHORITY_BOUNDARY,
    });
  }
  if (pathname.startsWith(BROWSER_PREFIX)) return browserTransport(request, env, pathname, info, dependencies);
  if (pathname.startsWith(API_PREFIX)) return apiTransport(request, env, pathname, dependencies);
  return null;
}
