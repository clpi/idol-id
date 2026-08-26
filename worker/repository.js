import { bearerToken, verifyAccessJwt } from "../shared/platform-auth.js";
import { createD1PlatformRepository } from "../shared/platform-d1.js";
import { createPlatformService, PlatformError } from "../shared/platform.js";
import { createD1RepositoryStore } from "../shared/repository-d1.js";
import { createMemoryRepositoryStore } from "../shared/repository-memory.js";
import { createRepositoryService } from "../shared/repository-service.js";
import { observePublicRepository, RepositoryError } from "../shared/repository.js";

const BODY_LIMIT = 16 * 1024;
const BROWSER_PREFIX = "/v1/repository/browser/";
const API_PREFIX = "/v1/repository/api/";
const ID = "[A-Za-z0-9_-]{12,}";
const OBSERVATION_PATH = new RegExp(`^observations/(${ID})$`);
const SCAFFOLD_CREATE_PATH = new RegExp(`^observations/(${ID})/scaffolds$`);
const SCAFFOLD_PATH = new RegExp(`^scaffolds/(${ID})$`);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_STORE = createMemoryRepositoryStore();

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function localDevelopment(request, env) {
  return env.IDOL_LOCAL_DEVELOPMENT === "1" && LOCAL_HOSTS.has(new URL(request.url).hostname);
}

function configured(request, env) {
  const local = localDevelopment(request, env);
  return {
    access: local || Boolean(env.ACCESS_TEAM_DOMAIN && env.REPOSITORY_ACCESS_AUD && (env.ACCESS_EMAIL || env.ACCESS_EMAIL_DOMAIN)),
    storage: local || Boolean(env.PLATFORM_DB),
    local_development: local,
  };
}

async function browserIdentity(request, env, dependencies) {
  if (localDevelopment(request, env)) {
    return Object.freeze({ subject: "local-development", email: "local@idol.invalid", displayName: "Local developer" });
  }
  if (dependencies.verifyAccess) return dependencies.verifyAccess(request, env);
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion) return null;
  return verifyAccessJwt(assertion, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    audience: env.REPOSITORY_ACCESS_AUD,
    email: env.ACCESS_EMAIL,
    emailDomain: env.ACCESS_EMAIL_DOMAIN,
    fetcher: dependencies.accessFetcher || fetch,
    now: dependencies.nowMs || (() => Date.now()),
  });
}

function requireBrowserProof(request, env) {
  const actual = request.headers.get("origin");
  const expected = localDevelopment(request, env) ? new URL(request.url).origin : "https://platform.idol.id";
  return actual === expected && request.headers.get("x-idol-request") === "browser";
}

async function readBoundedRequestText(request) {
  const announced = Number(request.headers.get("content-length") || 0);
  if (announced > BODY_LIMIT) throw new RepositoryError("REPOSITORY_REQUEST_TOO_LARGE", "repository request body too large", 413);
  if (!request.body?.getReader) {
    const value = await request.text();
    if (new TextEncoder().encode(value).byteLength > BODY_LIMIT) throw new RepositoryError("REPOSITORY_REQUEST_TOO_LARGE", "repository request body too large", 413);
    return value;
  }
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BODY_LIMIT) {
      await reader.cancel("repository request body too large");
      throw new RepositoryError("REPOSITORY_REQUEST_TOO_LARGE", "repository request body too large", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readJson(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json")) throw new RepositoryError("JSON_REQUIRED", "application/json request required", 415);
  const raw = await readBoundedRequestText(request);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new RepositoryError("INVALID_JSON", "invalid JSON", 400); }
}

function routeError(error) {
  if (error instanceof RepositoryError || error instanceof PlatformError) {
    return json({ error: error.code, detail: error.message }, error.status);
  }
  return json({ error: "REPOSITORY_REQUEST_FAILED", detail: "repository request failed closed" }, 500);
}

async function loadAuthorityPin(request, env, dependencies) {
  if (dependencies.authorityPin) return dependencies.authorityPin;
  if (!env.ASSETS?.fetch) throw new RepositoryError("REPOSITORY_AUTHORITY_UNAVAILABLE", "runtime authority projection unavailable", 503);
  const url = new URL(request.url);
  url.pathname = "/runtime/manifest.json";
  url.search = "";
  const response = await env.ASSETS.fetch(new Request(url, { method: "GET", headers: { accept: "application/json" } }));
  if (!response.ok) throw new RepositoryError("REPOSITORY_AUTHORITY_UNAVAILABLE", "runtime authority projection unavailable", 503);
  let document;
  try { document = await response.json(); } catch { throw new RepositoryError("REPOSITORY_AUTHORITY_INVALID", "runtime authority projection is invalid", 503); }
  if (!document?.authority?.commit || !document?.native?.commit) throw new RepositoryError("REPOSITORY_AUTHORITY_INVALID", "runtime authority projection is incomplete", 503);
  return Object.freeze({ language: document.authority, native: document.native });
}

async function services(request, env, dependencies) {
  if (dependencies.platformService && dependencies.repositoryService) {
    return { platform: dependencies.platformService, repository: dependencies.repositoryService };
  }
  const authorityPin = await loadAuthorityPin(request, env, dependencies);
  if (localDevelopment(request, env)) {
    return {
      platform: Object.freeze({ async session(identity) { return { profile: identity }; } }),
      repository: createRepositoryService({
        store: LOCAL_STORE,
        authorityPin,
        now: dependencies.now,
        randomBytes: dependencies.randomBytes,
      }),
    };
  }
  if (!env.PLATFORM_DB?.prepare) throw new RepositoryError("PLATFORM_STORAGE_UNAVAILABLE", "platform storage unavailable", 503);
  const platformRepository = createD1PlatformRepository(env.PLATFORM_DB);
  const platform = createPlatformService({
    repository: platformRepository,
    now: dependencies.now,
    randomBytes: dependencies.randomBytes,
  });
  const repository = createRepositoryService({
    store: createD1RepositoryStore(env.PLATFORM_DB),
    authorityPin,
    now: dependencies.now,
    randomBytes: dependencies.randomBytes,
  });
  return { platform, repository };
}

async function action(request, path, identity, repository, dependencies) {
  if (request.method === "GET" && path === "observations") return json({ observations: await repository.listObservations(identity) });
  if (request.method === "GET" && path === "scaffolds") return json({ scaffolds: await repository.listScaffolds(identity) });
  if (request.method === "POST" && path === "observe") {
    const input = await readJson(request);
    const draft = await observePublicRepository(input, {
      fetcher: dependencies.providerFetcher || fetch,
      observedAt: dependencies.now || (() => new Date().toISOString()),
      timeoutMs: dependencies.providerTimeoutMs,
    });
    return json(await repository.saveObservation(identity, draft), 201);
  }
  const observation = OBSERVATION_PATH.exec(path);
  if (request.method === "GET" && observation) return json(await repository.getObservation(identity, observation[1]));
  const scaffoldCreate = SCAFFOLD_CREATE_PATH.exec(path);
  if (request.method === "POST" && scaffoldCreate) return json(await repository.createScaffold(identity, scaffoldCreate[1], await readJson(request)), 201);
  const scaffold = SCAFFOLD_PATH.exec(path);
  if (request.method === "GET" && scaffold) return json(await repository.getScaffold(identity, scaffold[1]));
  return json({ error: "REPOSITORY_ROUTE_NOT_FOUND" }, 404);
}

async function browserTransport(request, env, path, info, dependencies) {
  if (info.surface !== "platform") return json({ error: "REPOSITORY_BROWSER_HOST_REQUIRED" }, 404);
  if (!configured(request, env).access) return json({ error: "ACCESS_NOT_CONFIGURED" }, 503);
  let identity;
  try { identity = await browserIdentity(request, env, dependencies); } catch { return json({ error: "ACCESS_IDENTITY_INVALID" }, 401); }
  if (!identity) return json({ error: "ACCESS_IDENTITY_REQUIRED" }, 401);
  if (request.method !== "GET" && !requireBrowserProof(request, env)) return json({ error: "BROWSER_REQUEST_PROOF_REQUIRED" }, 403);
  try {
    const available = await services(request, env, dependencies);
    await available.platform.session(identity);
    return await action(request, path, identity, available.repository, dependencies);
  } catch (error) { return routeError(error); }
}

function requiredScope(method, path) {
  if (method === "POST" && path === "observe") return "repository:observe";
  if (method === "POST" && SCAFFOLD_CREATE_PATH.test(path)) return "repository:scaffold";
  return "repository:read";
}

async function apiTransport(request, env, path, info, dependencies) {
  if (info.surface !== "api") return json({ error: "REPOSITORY_API_HOST_REQUIRED" }, 404);
  try {
    const available = await services(request, env, dependencies);
    const token = bearerToken(request);
    if (!token) return json({ error: "API_TOKEN_REQUIRED" }, 401);
    const identity = await available.platform.authenticateApiToken(token, requiredScope(request.method, path));
    return await action(request, path, identity, available.repository, dependencies);
  } catch (error) { return routeError(error); }
}

export async function handleRepositoryTransport(request, env, pathname, info, dependencies = {}) {
  if (pathname === "/v1/repository/status" && (request.method === "GET" || request.method === "HEAD")) {
    if (info.surface !== "platform") return json({ error: "REPOSITORY_STATUS_HOST_REQUIRED" }, 404);
    return json({
      schema: "idol.web.repository.status.v1",
      configured: configured(request, env),
      browser: `${BROWSER_PREFIX}observations`,
      api: `${API_PREFIX}observations`,
      providers: ["github", "gitlab", "bitbucket"],
      visibility: "public-only",
      mutation: false,
      source_transfer: "provider tree metadata only",
      authority: "repository provenance only; no semantic identity, world grant, equivalence, or repository write",
    });
  }
  if (pathname.startsWith(BROWSER_PREFIX)) return browserTransport(request, env, pathname.slice(BROWSER_PREFIX.length), info, dependencies);
  if (pathname.startsWith(API_PREFIX)) return apiTransport(request, env, pathname.slice(API_PREFIX.length), info, dependencies);
  return null;
}
