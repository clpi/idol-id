import { verifyAccessJwt } from "../shared/platform-auth.js";
import { createD1PlatformRepository } from "../shared/platform-d1.js";
import { createPlatformService } from "../shared/platform.js";
import { validateWorkspacePath } from "../shared/workspace.js";

const IDE_PATH = "/v1/ide/analyze";
const SOURCE_LIMIT = 2 * 1024 * 1024;
const BODY_LIMIT = SOURCE_LIMIT;
const RESULT_LIMIT = 4 * 1024 * 1024;
const ID_LIMIT = 160;
const encoder = new TextEncoder();

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function textBytes(value) {
  return encoder.encode(String(value)).byteLength;
}

function configured(env) {
  return Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD && (env.ACCESS_EMAIL || env.ACCESS_EMAIL_DOMAIN));
}

function canonicalIssuer(teamDomain) {
  return `https://${String(teamDomain || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
}

function audienceIncludes(candidate, expected) {
  if (Array.isArray(candidate)) return candidate.some((value) => String(value) === expected);
  return String(candidate || "") === expected;
}

function admittedIdentity(identity, env) {
  if (!identity || typeof identity !== "object") return { response: json({ error: "ACCESS_IDENTITY_REQUIRED" }, 401) };
  const subject = String(identity.subject || "").trim();
  const email = String(identity.email || "").trim().toLowerCase();
  const issuer = String(identity.issuer || "").replace(/\/+$/, "");
  const expectedIssuer = canonicalIssuer(env.ACCESS_TEAM_DOMAIN);
  const expectedAudience = String(env.ACCESS_AUD || "");
  if (!subject || !email || !expectedAudience || issuer !== expectedIssuer || !audienceIncludes(identity.audience, expectedAudience)) {
    return { response: json({ error: "ACCESS_IDENTITY_INVALID" }, 401) };
  }
  const exactEmail = String(env.ACCESS_EMAIL || "").trim().toLowerCase();
  const domain = String(env.ACCESS_EMAIL_DOMAIN || "").trim().toLowerCase();
  if ((exactEmail && email !== exactEmail) || (!exactEmail && domain && !email.endsWith(`@${domain}`))) {
    return { response: json({ error: "ACCESS_IDENTITY_REFUSED" }, 403) };
  }
  return {
    identity: Object.freeze({
      subject,
      email,
      displayName: String(identity.displayName || identity.display_name || email),
      issuer: expectedIssuer,
      audience: expectedAudience,
    }),
  };
}

async function browserIdentity(request, env, dependencies) {
  if (dependencies.verifyAccess) return dependencies.verifyAccess(request, env);
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion) return null;
  return verifyAccessJwt(assertion, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    audience: env.ACCESS_AUD,
    email: env.ACCESS_EMAIL,
    emailDomain: env.ACCESS_EMAIL_DOMAIN,
    fetcher: dependencies.fetcher || fetch,
    now: dependencies.nowMs || (() => Date.now()),
  });
}

function requireBrowserProof(request) {
  return request.headers.get("origin") === "https://platform.idol.id"
    && request.headers.get("x-idol-request") === "browser";
}

function cleanIdentifier(value, label) {
  const admitted = String(value ?? "").trim();
  if (!admitted || admitted.length > ID_LIMIT || /[\u0000-\u001f\u007f]/.test(admitted)) {
    throw Object.assign(new Error(`${label} is invalid`), { code: "IDE_REQUEST_INVALID", status: 400 });
  }
  return admitted;
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw Object.assign(new Error("IDE request must be an object"), { code: "IDE_REQUEST_INVALID", status: 400 });
  }
  const allowed = new Set(["workspace_id", "file_id", "path", "source"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw Object.assign(new Error(`unsupported IDE field: ${key}`), { code: "IDE_REQUEST_INVALID", status: 422 });
  }
  const source = typeof input.source === "string" ? input.source : String(input.source ?? "");
  if (textBytes(source) > SOURCE_LIMIT) {
    throw Object.assign(new Error("IDE source exceeds 2 MiB"), { code: "IDE_SOURCE_TOO_LARGE", status: 413 });
  }
  return Object.freeze({
    workspace_id: cleanIdentifier(input.workspace_id, "workspace identity"),
    file_id: cleanIdentifier(input.file_id, "file identity"),
    path: validateWorkspacePath(input.path),
    source,
  });
}

async function readInput(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return { response: json({ error: "JSON_REQUIRED" }, 415) };
  }
  const announced = Number(request.headers.get("content-length") || 0);
  if (announced > BODY_LIMIT) return { response: json({ error: "IDE_REQUEST_TOO_LARGE" }, 413) };
  const raw = await request.text();
  if (textBytes(raw) > BODY_LIMIT) return { response: json({ error: "IDE_REQUEST_TOO_LARGE" }, 413) };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { response: json({ error: "INVALID_JSON" }, 400) };
  }
  try {
    return { value: validateInput(parsed) };
  } catch (error) {
    return { response: json({ error: error.code || "IDE_REQUEST_INVALID", detail: error.message }, error.status || 400) };
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nowIso(dependencies) {
  const produced = dependencies.now ? dependencies.now() : new Date().toISOString();
  const date = produced instanceof Date ? produced : new Date(produced);
  if (!Number.isFinite(date.getTime())) throw new Error("IDE clock is invalid");
  return date.toISOString();
}

function auditIdentifier(dependencies) {
  if (dependencies.idFactory) return String(dependencies.idFactory());
  if (crypto.randomUUID) return crypto.randomUUID();
  return `ide-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function auditSink(env, dependencies, identity) {
  if (dependencies.audit) return dependencies.audit;
  if (!env.PLATFORM_DB?.prepare) return null;
  const repository = createD1PlatformRepository(env.PLATFORM_DB);
  const service = createPlatformService({ repository, now: () => nowIso(dependencies) });
  return async (event) => {
    await service.session(identity);
    await repository.appendAudit(event);
  };
}

function boundedUpstreamError(status) {
  return json({ error: "IDE_UPSTREAM_REFUSED", upstream_status: status }, 502);
}

export async function handleIdeTransport(request, env, pathname, info, dependencies = {}) {
  if (pathname !== IDE_PATH) return null;
  if (info.surface !== "platform") return json({ error: "IDE_PLATFORM_HOST_REQUIRED" }, 404);
  if (request.method !== "POST") return json({ error: "IDE_METHOD_REFUSED" }, 405, { allow: "POST" });
  if (!configured(env)) return json({ error: "ACCESS_NOT_CONFIGURED" }, 503);

  let rawIdentity;
  try {
    rawIdentity = await browserIdentity(request, env, dependencies);
  } catch {
    return json({ error: "ACCESS_IDENTITY_INVALID" }, 401);
  }
  const admission = admittedIdentity(rawIdentity, env);
  if (admission.response) return admission.response;
  const identity = admission.identity;

  if (!requireBrowserProof(request)) return json({ error: "BROWSER_REQUEST_PROOF_REQUIRED" }, 403);

  const sink = auditSink(env, dependencies, identity);
  if (!sink) return json({ error: "IDE_AUDIT_UNAVAILABLE" }, 503);

  const admitted = await readInput(request);
  if (admitted.response) return admitted.response;
  const input = admitted.value;
  const sourceHash = await sha256(input.source);
  const fetcher = dependencies.fetcher || fetch;
  let upstream;
  try {
    upstream = await fetcher(new Request("https://api.idol.id/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        "x-idol-request": "ide-analysis",
      },
      body: JSON.stringify({ source: input.source }),
    }));
  } catch {
    return json({ error: "IDE_UPSTREAM_UNAVAILABLE" }, 502);
  }

  if (!upstream.ok) return boundedUpstreamError(upstream.status);
  const rawResult = await upstream.text();
  if (textBytes(rawResult) > RESULT_LIMIT) return json({ error: "IDE_UPSTREAM_RESULT_TOO_LARGE" }, 502);
  let result;
  try {
    result = JSON.parse(rawResult);
  } catch {
    return json({ error: "IDE_UPSTREAM_INVALID" }, 502);
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) return json({ error: "IDE_UPSTREAM_INVALID" }, 502);

  const metadata = Object.freeze({
    workspace_id: input.workspace_id,
    file_id: input.file_id,
    path: input.path,
    source_hash: sourceHash,
    source_bytes: textBytes(input.source),
    upstream_status: upstream.status,
  });
  try {
    await sink({
      id: auditIdentifier(dependencies),
      subject: identity.subject,
      actor_email: identity.email,
      type: "ide.analysis.requested",
      target: `${input.workspace_id}/${input.file_id}`,
      metadata,
      created_at: nowIso(dependencies),
    });
  } catch {
    return json({ error: "IDE_AUDIT_UNAVAILABLE" }, 503);
  }

  return json({
    schema: "idol.web.ide.analysis.v1",
    authority: { repository: "clpi/idol", commit: String(env.IDOL_AUTHORITY || "not-published") },
    capability: "remote-native",
    source_hash: sourceHash,
    result,
  });
}
