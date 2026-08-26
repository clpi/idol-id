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
  appendAudit,
  authorityPin,
  now = () => new Date().toISOString(),
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
} = {}) {
  if (!store) throw new TypeError("repository store is required");
  if (typeof appendAudit !== "function") throw new TypeError("repository audit sink is required");
  if (!authorityPin?.language?.commit || !authorityPin?.native?.commit) throw new TypeError("repository authority pin is required");

  const nowIso = () => instant(now());
  async function audit(identity, type, target, metadata) {
    const event = {
      id: randomIdentifier("audit", randomBytes),
      subject: identity.subject,
      actor_email: identity.email,
      type,
      target,
      metadata: Object.freeze({ ...metadata }),
      created_at: nowIso(),
    };
    await appendAudit(event);
  }

  async function saveObservation(rawIdentity, draft) {
    const identity = identityOf(rawIdentity);
    if (!draft || draft.schema !== "idol.web.repository.observation.v1") throw new RepositoryError("REPOSITORY_OBSERVATION_INVALID", "repository observation is invalid", 422);
    const id = randomIdentifier("obs", randomBytes);
    const createdAt = nowIso();
    const document = Object.freeze({ ...draft, id, created_at: createdAt });
    const saved = await store.insertObservation({
      id,
      subject: identity.subject,
      provider: draft.provider,
      namespace: draft.namespace,
      repository: draft.repository,
      resolved_revision: draft.resolved_revision,
      document,
      created_at: createdAt,
    });
    await audit(identity, "repository.observed", id, {
      provider: draft.provider,
      coordinate: draft.coordinate,
      revision: draft.resolved_revision,
      file_count: draft.inventory.file_count,
      truncated: draft.inventory.truncated,
    });
    return saved;
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
    const draft = createRepositoryScaffold(observation, input, { authorityPin, createdAt: nowIso });
    const id = randomIdentifier("scf", randomBytes);
    const document = Object.freeze({ ...draft, id, observation_id: observation.id });
    const saved = await store.insertScaffold({ id, subject: identity.subject, observation_id: observation.id, document, created_at: draft.created_at || nowIso() });
    await audit(identity, draft.status === "preview" ? "repository.scaffold.previewed" : "repository.scaffold.refused", id, {
      observation_id: observation.id,
      capabilities: draft.capabilities || [],
      status: draft.status,
      refusal: draft.refusal?.code || null,
      file_count: draft.files?.length || 0,
    });
    return saved;
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
