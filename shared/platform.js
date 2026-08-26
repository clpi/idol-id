import {
  constantTimeTextEqual,
  createApiToken,
  hashApiToken,
  normalizeScopes,
  parseApiToken,
} from "./platform-auth.js";

export const PLATFORM_AUTHORITY_BOUNDARY = "transport identity only; no Idol world grant";

export class PlatformError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "PlatformError";
    this.code = code;
    this.status = status;
  }
}

function instant(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("platform clock returned an invalid time");
  return date;
}

function publicToken(record) {
  if (!record) return null;
  const { digest, token, ...visible } = record;
  return Object.freeze({
    ...visible,
    scopes: Array.isArray(visible.scopes) ? [...visible.scopes] : JSON.parse(visible.scopes || "[]"),
  });
}

function cleanDisplayName(value) {
  const name = String(value ?? "").trim();
  if (!name || name.length > 80) throw new PlatformError("INVALID_DISPLAY_NAME", "display name must contain 1 to 80 characters", 422);
  return name;
}

function cleanTokenName(value) {
  const name = String(value ?? "").trim();
  if (!name || name.length > 80) throw new PlatformError("INVALID_TOKEN_NAME", "token name must contain 1 to 80 characters", 422);
  return name;
}

function cleanExpiryDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new PlatformError("INVALID_TOKEN_EXPIRY", "token expiry must be between 1 and 365 days", 422);
  return days;
}

function randomIdentifier(randomBytes, length = 12) {
  const bytes = randomBytes(length);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createPlatformService({
  repository,
  now = () => new Date().toISOString(),
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
} = {}) {
  if (!repository) throw new TypeError("platform repository is required");

  const nowDate = () => instant(now());
  const nowIso = () => nowDate().toISOString();

  async function appendAudit(identity, type, target, metadata = {}) {
    const event = {
      id: randomIdentifier(randomBytes),
      subject: identity.subject,
      actor_email: identity.email,
      type,
      target: String(target || identity.subject),
      metadata: Object.freeze({ ...metadata }),
      created_at: nowIso(),
    };
    await repository.appendAudit(event);
    return event;
  }

  async function ensureProfile(identity) {
    if (!identity?.subject || !identity?.email) throw new PlatformError("ACCESS_IDENTITY_REQUIRED", "verified Access identity required", 401);
    const existing = await repository.getProfile(identity.subject);
    const saved = await repository.upsertProfile(identity, nowIso());
    const profile = saved?.profile || saved;
    if (!existing) await appendAudit(identity, "profile.created", identity.subject, { issuer: identity.issuer, audience: identity.audience });
    return profile;
  }

  function validateProfilePatch(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new PlatformError("INVALID_PROFILE_PATCH", "profile patch must be an object", 400);
    const allowed = new Set(["display_name"]);
    for (const key of Object.keys(input)) if (!allowed.has(key)) throw new PlatformError("INVALID_PROFILE_PATCH", `unsupported profile field: ${key}`, 422);
    return Object.freeze({ display_name: cleanDisplayName(input.display_name) });
  }

  async function session(identity) {
    const profile = await ensureProfile(identity);
    return Object.freeze({ profile, authority: PLATFORM_AUTHORITY_BOUNDARY });
  }

  async function profile(identity) {
    return ensureProfile(identity);
  }

  async function updateProfile(identity, input) {
    await ensureProfile(identity);
    const patch = validateProfilePatch(input);
    const updated = await repository.updateProfile(identity.subject, patch, nowIso());
    await appendAudit(identity, "profile.updated", identity.subject, { fields: Object.keys(patch) });
    return updated;
  }

  async function listTokens(identity) {
    await ensureProfile(identity);
    return (await repository.listTokens(identity.subject)).map(publicToken);
  }

  async function createToken(identity, input = {}) {
    await ensureProfile(identity);
    const name = cleanTokenName(input.name);
    const scopes = normalizeScopes(input.scopes);
    const days = cleanExpiryDays(input.expires_in_days);
    const material = await createApiToken({ randomBytes });
    const created = nowDate();
    const expires = new Date(created.getTime() + days * 24 * 60 * 60 * 1000);
    const record = {
      id: material.id,
      subject: identity.subject,
      name,
      prefix: material.prefix,
      digest: material.digest,
      scopes: [...scopes],
      created_at: created.toISOString(),
      expires_at: expires.toISOString(),
      revoked_at: null,
      last_used_at: null,
    };
    await repository.insertToken(record);
    await appendAudit(identity, "token.created", record.id, { name, scopes, expires_at: record.expires_at });
    return Object.freeze({ ...publicToken(record), token: material.token });
  }

  async function revokeToken(identity, id) {
    await ensureProfile(identity);
    const token = await repository.revokeToken(identity.subject, String(id), nowIso());
    if (!token) throw new PlatformError("TOKEN_NOT_FOUND", "API token not found", 404);
    await appendAudit(identity, "token.revoked", token.id, { name: token.name });
    return publicToken(token);
  }

  async function authenticateApiToken(rawToken, requiredScope = null) {
    let parsed;
    try {
      parsed = parseApiToken(rawToken);
    } catch {
      throw new PlatformError("API_TOKEN_INVALID", "API token invalid", 401);
    }
    const record = await repository.getToken(parsed.id);
    if (!record) throw new PlatformError("API_TOKEN_INVALID", "API token invalid", 401);
    const digest = await hashApiToken(rawToken);
    if (!constantTimeTextEqual(digest, record.digest)) throw new PlatformError("API_TOKEN_INVALID", "API token invalid", 401);
    if (record.revoked_at) throw new PlatformError("API_TOKEN_REVOKED", "API token revoked", 401);
    if (instant(record.expires_at).getTime() <= nowDate().getTime()) throw new PlatformError("API_TOKEN_EXPIRED", "API token expired", 401);
    const scopes = Array.isArray(record.scopes) ? record.scopes : JSON.parse(record.scopes || "[]");
    if (requiredScope && !scopes.includes(requiredScope)) throw new PlatformError("API_TOKEN_SCOPE_REFUSED", `API token lacks scope ${requiredScope}`, 403);
    const owner = await repository.getProfile(record.subject);
    if (!owner) throw new PlatformError("API_TOKEN_OWNER_MISSING", "API token owner unavailable", 401);
    await repository.touchToken(record.id, nowIso());
    return Object.freeze({
      kind: "api-token",
      subject: record.subject,
      email: owner.email,
      display_name: owner.display_name,
      token_id: record.id,
      scopes: Object.freeze([...scopes]),
      authority: PLATFORM_AUTHORITY_BOUNDARY,
    });
  }

  async function audit(identity, limit = 100) {
    await ensureProfile(identity);
    const bounded = Math.max(1, Math.min(100, Number(limit) || 100));
    return repository.listAudit(identity.subject, bounded);
  }

  return Object.freeze({
    session,
    profile,
    updateProfile,
    validateProfilePatch,
    listTokens,
    createToken,
    revokeToken,
    authenticateApiToken,
    audit,
  });
}
