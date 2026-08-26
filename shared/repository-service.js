import { createRepositoryScaffold, RepositoryError } from "./repository.js";

function instant(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("repository service clock is invalid");
  return date.toISOString();
}

function randomIdentifier(prefix, randomBytes) {
  const bytes = randomBytes(12);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${prefix}_${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

function identityOf(identity) {
  const subject = String(identity?.subject || "").trim();
  const email = String(identity?.email || "").trim().toLowerCase();
  if (!subject || !email) throw new RepositoryError("REPOSITORY_IDENTITY_REQUIRED", "verified platform identity required", 401);
  return Object.freeze({ subject, email });
}

export function createRepositoryService({
  store,
  authorityPin,
  now = () => new Date().toISOString(),
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
} = {}) {
  if (!store) throw new TypeError("repository store is required");
  if (typeof store.commitObservation !== "function" || typeof store.commitScaffold !== "function") {
    throw new TypeError("repository store must atomically commit records with audit events");
  }
  if (!authorityPin?.language?.commit || !authorityPin?.native?.commit) throw new TypeError("repository authority pin is required");

  const nowIso = () => instant(now());
  function auditEvent(identity, type, target, metadata, createdAt) {
    return Object.freeze({
      id: randomIdentifier("audit", randomBytes),
      subject: identity.subject,
      actor_email: identity.email,
      type,
      target,
      metadata: Object.freeze({ ...metadata }),
      created_at: createdAt,
    });
  }

  async function saveObservation(rawIdentity, draft) {
    const identity = identityOf(rawIdentity);
    if (!draft || draft.schema !== "idol.web.repository.observation.v1") throw new RepositoryError("REPOSITORY_OBSERVATION_INVALID", "repository observation is invalid", 422);
    const id = randomIdentifier("obs", randomBytes);
    const createdAt = nowIso();
    const document = Object.freeze({ ...draft, id, created_at: createdAt });
    const record = Object.freeze({
      id,
      subject: identity.subject,
      provider: draft.provider,
      namespace: draft.namespace,
      repository: draft.repository,
      coordinate: draft.coordinate,
      requested_ref: draft.requested_ref,
      default_branch: draft.default_branch,
      resolved_revision: draft.resolved_revision,
      file_count: draft.inventory.file_count,
      truncated: Boolean(draft.inventory.truncated),
      document,
      created_at: createdAt,
    });
    const event = auditEvent(identity, "repository.observed", id, {
      provider: draft.provider,
      coordinate: draft.coordinate,
      revision: draft.resolved_revision,
      file_count: draft.inventory.file_count,
      truncated: draft.inventory.truncated,
    }, createdAt);
    return store.commitObservation(record, event);
  }

  async function listObservations(rawIdentity, limit = 50) {
    const identity = identityOf(rawIdentity);
    return store.listObservations(identity.subject, Math.max(1, Math.min(50, Number(limit) || 50)));
  }

  async function getObservation(rawIdentity, id) {
    const identity = identityOf(rawIdentity);
    const observation = await store.getObservation(identity.subject, String(id));
    if (!observation) throw new RepositoryError("REPOSITORY_OBSERVATION_NOT_FOUND", "repository observation not found", 404);
    return observation;
  }

  async function createScaffold(rawIdentity, observationId, input) {
    const identity = identityOf(rawIdentity);
    const observation = await getObservation(identity, observationId);
    const createdAt = nowIso();
    const draft = createRepositoryScaffold(observation, input, { authorityPin, createdAt: () => createdAt });
    const id = randomIdentifier("scf", randomBytes);
    const fileCount = draft.files?.length || 0;
    const refusalCode = draft.refusal?.code || null;
    const document = Object.freeze({ ...draft, id, observation_id: observation.id, created_at: draft.created_at || createdAt });
    const record = Object.freeze({
      id,
      subject: identity.subject,
      observation_id: observation.id,
      status: draft.status,
      file_count: fileCount,
      refusal_code: refusalCode,
      document,
      created_at: document.created_at,
    });
    const event = auditEvent(
      identity,
      draft.status === "preview" ? "repository.scaffold.previewed" : "repository.scaffold.refused",
      id,
      {
        observation_id: observation.id,
        capabilities: draft.capabilities || [],
        status: draft.status,
        refusal: refusalCode,
        file_count: fileCount,
      },
      document.created_at,
    );
    return store.commitScaffold(record, event);
  }

  async function listScaffolds(rawIdentity, limit = 50) {
    const identity = identityOf(rawIdentity);
    return store.listScaffolds(identity.subject, Math.max(1, Math.min(50, Number(limit) || 50)));
  }

  async function getScaffold(rawIdentity, id) {
    const identity = identityOf(rawIdentity);
    const scaffold = await store.getScaffold(identity.subject, String(id));
    if (!scaffold) throw new RepositoryError("REPOSITORY_SCAFFOLD_NOT_FOUND", "repository scaffold not found", 404);
    return scaffold;
  }

  return Object.freeze({ saveObservation, listObservations, getObservation, createScaffold, listScaffolds, getScaffold });
}
