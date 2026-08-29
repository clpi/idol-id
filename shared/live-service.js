import {
  LiveError,
  liveBoundary,
  normaliseFrontierDecision,
  normaliseLiveApplicationInput,
  normaliseLiveEventInput,
  normaliseLiveNodeInput,
  normaliseLiveProjectInput,
  projectLiveGraph,
} from "./live.js";

function identifier(randomBytes, prefix, length = 12) {
  const bytes = randomBytes(length);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${prefix}${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}
function identityOf(value) {
  if (!value?.subject || !value?.email) throw new LiveError("LIVE_IDENTITY_REQUIRED", "verified identity required", 401);
  return Object.freeze({
    subject: String(value.subject),
    email: String(value.email),
    display_name: String(value.display_name || value.displayName || value.email),
  });
}
function iso(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Live clock returned an invalid time");
  return date.toISOString();
}
function boundedLimit(value, fallback = 50, maximum = 100) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum) throw new LiveError("INVALID_LIVE_LIMIT", `limit must be between 1 and ${maximum}`);
  return result;
}
function audit(identity, type, target, metadata, createdAt, randomBytes) {
  return Object.freeze({
    id: identifier(randomBytes, "audit_"),
    subject: identity.subject,
    actor_email: identity.email,
    type,
    target: String(target),
    metadata: Object.freeze(structuredClone(metadata || {})),
    created_at: createdAt,
  });
}
function summary(project, graph = null) {
  return Object.freeze({
    id: project.id,
    name: project.name,
    slug: project.slug,
    summary: project.summary,
    visibility: project.visibility,
    universe_view_id: project.universe_view_id || null,
    frontier_admitted_count: graph?.frontier?.admitted_event_ids?.length || 0,
    created_at: project.created_at,
    updated_at: project.updated_at,
  });
}
function latestDecision(decisions, eventId) {
  let found = null;
  for (const decision of decisions) if (decision.event_id === eventId) found = decision;
  return found;
}

export function createLiveService({
  store,
  universe,
  now = () => new Date().toISOString(),
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
} = {}) {
  const required = ["commitProject", "listProjects", "getProject", "updateProject", "commitNode", "commitApplication", "commitEvent", "commitFrontier", "projectGraph"];
  if (!store || required.some((name) => typeof store[name] !== "function")) throw new TypeError("Live store is required");
  if (typeof now !== "function") throw new TypeError("Live clock must be a function");
  if (typeof randomBytes !== "function") throw new TypeError("Live random-byte source must be a function");
  const nowIso = () => iso(now());

  async function projectOf(identity, projectId) {
    const project = await store.getProject(identity.subject, String(projectId));
    if (!project) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return project;
  }
  async function snapshotOf(identity, projectId) {
    const snapshot = await store.projectGraph(identity.subject, String(projectId));
    if (!snapshot) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return snapshot;
  }
  function graphOf(snapshot) {
    return projectLiveGraph(snapshot.project, snapshot.nodes, snapshot.applications, snapshot.events, snapshot.frontier);
  }

  async function listProjects(rawIdentity, limit = 50) {
    const identity = identityOf(rawIdentity);
    const projects = await store.listProjects(identity.subject, boundedLimit(limit));
    const output = [];
    for (const project of projects) {
      const snapshot = await store.projectGraph(identity.subject, project.id);
      output.push(summary(project, snapshot ? graphOf(snapshot) : null));
    }
    return Object.freeze(output);
  }

  async function createProject(rawIdentity, input) {
    const identity = identityOf(rawIdentity);
    const normal = normaliseLiveProjectInput(input);
    const createdAt = nowIso();
    const id = identifier(randomBytes, "lp_");
    const document = Object.freeze({
      schema: "idol.web.live.project.v1",
      id,
      semantic_id: null,
      identity_status: "not-published",
      ...normal,
      universe_view_id: null,
      world_binding: null,
      boundary: liveBoundary(),
      created_at: createdAt,
      updated_at: createdAt,
    });
    try {
      return await store.commitProject(
        { id, subject: identity.subject, document, created_at: createdAt, updated_at: createdAt },
        { project_id: id, subject: identity.subject, role: "owner", created_at: createdAt },
        audit(identity, "live.project.created", id, { slug: normal.slug, visibility: normal.visibility }, createdAt, randomBytes),
      );
    } catch (error) {
      if (/slug already exists|UNIQUE constraint/i.test(String(error?.message))) throw new LiveError("LIVE_PROJECT_SLUG_EXISTS", "a Live project with this slug already exists", 409);
      throw error;
    }
  }

  async function getProject(rawIdentity, projectId) {
    return projectOf(identityOf(rawIdentity), projectId);
  }

  async function updateProject(rawIdentity, projectId, patch) {
    const identity = identityOf(rawIdentity);
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new LiveError("INVALID_LIVE_PROJECT_PATCH", "project patch must be an object", 400);
    const allowed = new Set(["name", "slug", "summary", "visibility"]);
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new LiveError("INVALID_LIVE_PROJECT_PATCH", `unsupported project field: ${key}`);
    const current = await projectOf(identity, projectId);
    const normal = normaliseLiveProjectInput({ ...current, ...patch });
    const updatedAt = nowIso();
    const document = Object.freeze({ ...current, ...normal, updated_at: updatedAt });
    try {
      return await store.updateProject(
        { id: current.id, subject: identity.subject, document, updated_at: updatedAt },
        audit(identity, "live.project.updated", current.id, { fields: Object.keys(patch).sort() }, updatedAt, randomBytes),
      );
    } catch (error) {
      if (/slug already exists|UNIQUE constraint/i.test(String(error?.message))) throw new LiveError("LIVE_PROJECT_SLUG_EXISTS", "a Live project with this slug already exists", 409);
      throw error;
    }
  }

  async function createNode(rawIdentity, projectId, input) {
    const identity = identityOf(rawIdentity);
    await projectOf(identity, projectId);
    const normal = normaliseLiveNodeInput(input);
    const createdAt = nowIso();
    const id = identifier(randomBytes, "ln_");
    const document = Object.freeze({
      schema: "idol.web.live.node.v1",
      id,
      project_id: String(projectId),
      semantic_id: null,
      identity_status: "not-published",
      ...normal,
      created_at: createdAt,
      updated_at: createdAt,
    });
    const saved = await store.commitNode(
      { id, project_id: String(projectId), subject: identity.subject, document, created_at: createdAt },
      audit(identity, "live.node.created", id, { project_id: String(projectId), category: normal.category }, createdAt, randomBytes),
    );
    if (!saved) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return saved;
  }

  async function createApplication(rawIdentity, projectId, input) {
    const identity = identityOf(rawIdentity);
    const snapshot = await snapshotOf(identity, projectId);
    const normal = normaliseLiveApplicationInput(input);
    const nodes = new Set(snapshot.nodes.map((node) => node.id));
    if (!nodes.has(normal.subject)) throw new LiveError("LIVE_GRAPH_ENDPOINT_MISSING", `application subject not found: ${normal.subject}`, 409);
    if (normal.target && !nodes.has(normal.target)) throw new LiveError("LIVE_GRAPH_ENDPOINT_MISSING", `application target not found: ${normal.target}`, 409);
    const createdAt = nowIso();
    const id = identifier(randomBytes, "la_");
    const document = Object.freeze({
      schema: "idol.web.live.application.v1",
      id,
      project_id: String(projectId),
      semantic_id: null,
      identity_status: "not-published",
      ...normal,
      created_at: createdAt,
    });
    const saved = await store.commitApplication(
      { id, project_id: String(projectId), subject: identity.subject, document, created_at: createdAt },
      audit(identity, "live.application.created", id, { project_id: String(projectId), relation: normal.relation }, createdAt, randomBytes),
    );
    if (!saved) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return saved;
  }

  async function appendEvent(rawIdentity, projectId, input) {
    const identity = identityOf(rawIdentity);
    const snapshot = await snapshotOf(identity, projectId);
    const normal = normaliseLiveEventInput(input);
    const events = new Set(snapshot.events.map((event) => event.id));
    const applications = new Set(snapshot.applications.map((application) => application.id));
    const nodes = new Set(snapshot.nodes.map((node) => node.id));
    for (const predecessor of normal.predecessor_ids) if (!events.has(predecessor)) throw new LiveError("LIVE_HISTORY_PREDECESSOR_MISSING", `event predecessor not found: ${predecessor}`, 409);
    for (const application of normal.application_ids) if (!applications.has(application)) throw new LiveError("LIVE_EVENT_APPLICATION_MISSING", `event application not found: ${application}`, 409);
    if (normal.intent_id && !nodes.has(normal.intent_id)) throw new LiveError("LIVE_EVENT_INTENT_MISSING", `event intent not found: ${normal.intent_id}`, 409);
    const createdAt = nowIso();
    const id = identifier(randomBytes, "le_");
    const document = Object.freeze({
      schema: "idol.web.live.event.v1",
      id,
      project_id: String(projectId),
      semantic_id: null,
      identity_status: "not-published",
      ...normal,
      created_at: createdAt,
    });
    const saved = await store.commitEvent(
      { id, project_id: String(projectId), subject: identity.subject, document, created_at: createdAt },
      audit(identity, "live.event.appended", id, { project_id: String(projectId), kind: normal.kind, predecessor_count: normal.predecessor_ids.length }, createdAt, randomBytes),
    );
    if (!saved) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return saved;
  }

  async function setFrontier(rawIdentity, projectId, input) {
    const identity = identityOf(rawIdentity);
    const snapshot = await snapshotOf(identity, projectId);
    const normal = normaliseFrontierDecision(input);
    const target = snapshot.events.find((event) => event.id === normal.event_id);
    if (!target) throw new LiveError("LIVE_FRONTIER_EVENT_MISSING", "frontier event not found", 404);
    if (normal.state === "admitted") {
      for (const predecessor of target.predecessor_ids) {
        if (latestDecision(snapshot.frontier, predecessor)?.state !== "admitted") {
          throw new LiveError("LIVE_FRONTIER_CAUSAL_GAP", `cannot admit ${target.id} before predecessor ${predecessor}`, 409);
        }
      }
    }
    const createdAt = nowIso();
    const id = identifier(randomBytes, "lf_");
    const document = Object.freeze({
      schema: "idol.web.live.frontier.v1",
      id,
      project_id: String(projectId),
      ...normal,
      created_at: createdAt,
    });
    const saved = await store.commitFrontier(
      { id, project_id: String(projectId), subject: identity.subject, document, created_at: createdAt },
      audit(identity, "live.frontier.decided", id, { project_id: String(projectId), event_id: normal.event_id, state: normal.state }, createdAt, randomBytes),
    );
    if (!saved) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return saved;
  }

  async function graph(rawIdentity, projectId) {
    return graphOf(await snapshotOf(identityOf(rawIdentity), projectId));
  }

  async function bindUniverseView(rawIdentity, projectId, universeViewId) {
    const identity = identityOf(rawIdentity);
    const current = await projectOf(identity, projectId);
    if (!universe?.getView) throw new LiveError("LIVE_UNIVERSE_UNAVAILABLE", "Universe View service unavailable", 503);
    let view;
    try { view = await universe.getView(identity, String(universeViewId)); }
    catch { throw new LiveError("LIVE_UNIVERSE_VIEW_NOT_FOUND", "Universe View not found", 404); }
    if (view?.boundary?.semantic_universes !== 1 || view?.boundary?.authority_grant !== "none") {
      throw new LiveError("LIVE_UNIVERSE_VIEW_REFUSED", "Universe View boundary is not admissible", 409);
    }
    const updatedAt = nowIso();
    const document = Object.freeze({
      ...current,
      universe_view_id: String(view.id),
      world_binding: Object.freeze({
        kind: "operational-projection-reference",
        universe_view_id: String(view.id),
        semantic_universes: 1,
        authority_grant: "none",
        semantic_identity: "not-published",
        world_publication: false,
      }),
      updated_at: updatedAt,
    });
    return store.updateProject(
      { id: current.id, subject: identity.subject, document, updated_at: updatedAt },
      audit(identity, "live.world_view.bound", current.id, { universe_view_id: String(view.id), authority_grant: "none" }, updatedAt, randomBytes),
    );
  }

  return Object.freeze({
    listProjects,
    createProject,
    getProject,
    updateProject,
    createNode,
    createApplication,
    appendEvent,
    setFrontier,
    graph,
    bindUniverseView,
  });
}
