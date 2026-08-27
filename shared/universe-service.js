import { UniverseError, createUniverseView } from "./universe.js";

function randomIdentifier(randomBytes, length = 12) {
  const bytes = randomBytes(length);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function requireIdentity(identity) {
  if (!identity?.subject || !identity?.email) throw new UniverseError("UNIVERSE_IDENTITY_REQUIRED", "verified identity required", 401);
  return Object.freeze({ subject: String(identity.subject), email: String(identity.email) });
}

function boundedLimit(value, fallback = 50, maximum = 100) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum) throw new UniverseError("INVALID_UNIVERSE_LIMIT", `limit must be between 1 and ${maximum}`);
  return result;
}

function auditEvent(identity, type, target, metadata, createdAt, randomBytes) {
  return Object.freeze({
    id: randomIdentifier(randomBytes),
    subject: identity.subject,
    actor_email: identity.email,
    type,
    target,
    metadata: Object.freeze({ ...metadata }),
    created_at: createdAt,
  });
}

function viewInput(view) {
  return {
    title: view.title,
    visibility: view.visibility,
    lens: view.lens,
    query: view.query,
    policy: view.policy,
    selections: view.selections,
  };
}

export function createUniverseService({
  store,
  catalogs,
  now = () => new Date().toISOString(),
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
} = {}) {
  if (!store?.commitView || !store?.listViews || !store?.getView || !store?.getPublicView) {
    throw new TypeError("Universe View store is required");
  }
  if (!catalogs?.published || !catalogs?.foreign) throw new TypeError("Universe world catalogs are required");
  const nowIso = () => {
    const date = new Date(now());
    if (!Number.isFinite(date.getTime())) throw new Error("universe clock returned an invalid time");
    return date.toISOString();
  };

  async function listViews(rawIdentity, limit = 50) {
    const identity = requireIdentity(rawIdentity);
    return store.listViews(identity.subject, boundedLimit(limit));
  }

  async function getView(rawIdentity, id) {
    const identity = requireIdentity(rawIdentity);
    const view = await store.getView(identity.subject, String(id));
    if (!view) throw new UniverseError("UNIVERSE_VIEW_NOT_FOUND", "universe view not found", 404);
    return view;
  }

  async function createView(rawIdentity, input) {
    const identity = requireIdentity(rawIdentity);
    const createdAt = nowIso();
    const id = `uv_${randomIdentifier(randomBytes)}`;
    const view = createUniverseView(input, catalogs, { id, createdAt, updatedAt: createdAt });
    const event = auditEvent(identity, "universe.view.created", id, {
      visibility: view.visibility,
      lens: view.lens,
      selection_count: view.analysis.selection_count,
      violation_count: view.analysis.violation_count,
    }, createdAt, randomBytes);
    return store.commitView({ id, subject: identity.subject, document: view, created_at: createdAt, updated_at: createdAt }, event);
  }

  async function updateView(rawIdentity, id, patch) {
    const identity = requireIdentity(rawIdentity);
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new UniverseError("INVALID_UNIVERSE_INPUT", "universe patch must be an object", 400);
    const allowed = new Set(["title", "visibility", "lens", "query", "policy", "selections"]);
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new UniverseError("INVALID_UNIVERSE_PATCH", `unsupported universe field: ${key}`);
    const current = await store.getView(identity.subject, String(id));
    if (!current) throw new UniverseError("UNIVERSE_VIEW_NOT_FOUND", "universe view not found", 404);
    const updatedAt = nowIso();
    const next = createUniverseView({ ...viewInput(current), ...patch }, catalogs, {
      id: current.id,
      createdAt: current.created_at,
      updatedAt,
    });
    const event = auditEvent(identity, "universe.view.updated", current.id, {
      fields: Object.keys(patch).sort(),
      visibility: next.visibility,
      lens: next.lens,
      selection_count: next.analysis.selection_count,
      violation_count: next.analysis.violation_count,
    }, updatedAt, randomBytes);
    return store.commitView({ id: current.id, subject: identity.subject, document: next, created_at: current.created_at, updated_at: updatedAt }, event);
  }

  async function getPublicView(id) {
    const view = await store.getPublicView(String(id));
    if (!view) throw new UniverseError("UNIVERSE_VIEW_NOT_FOUND", "universe view not found", 404);
    return view;
  }

  async function listPublicViews(limit = 50) {
    return typeof store.listPublicViews === "function" ? store.listPublicViews(boundedLimit(limit)) : [];
  }

  return Object.freeze({ listViews, getView, createView, updateView, getPublicView, listPublicViews });
}
