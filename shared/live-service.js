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
function requireIdentity(identity) {
  if (!identity?.subject || !identity?.email) throw new LiveError("LIVE_IDENTITY_REQUIRED", "verified identity required", 401);
  return Object.freeze({ subject: String(identity.subject), email: String(identity.email), display_name: String(identity.display_name || identity.displayName || identity.email) });
}
function boundedLimit(value, fallback = 50, maximum = 100) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum) throw new LiveError("INVALID_LIVE_LIMIT", `limit must be between 1 and ${maximum}`);
  return result;
}
function instant(now) {
  const date = new Date(now());
  if (!Number.isFinite(date.getTime())) throw new Error("Live clock returned an invalid time");
  return date.toISOString();
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
function projectSummary(project, graph = null) {
  return Object.freeze({
    id: project.id,
    name: project.name,
    slug: project.slug,
    summary: project.summary,
    visibility: project.visibility,
    universe_view_id: project.universe_view_id || null,
    frontier_admitted_count: graph?.frontier?.admitted_event_ids?.length || project.frontier_admitted_count || 0,
    created_at: project.created_at,
    updated_at: project.updated_at,
  });
}
function latestDecision(frontier, eventId) {
  let result = null;
  for (const decision of frontier) if (decision.event_id === eventId) result = decision;
  return result;
}

export function createLiveService({
  store,
  universe,
  now = () => new Date().toISOString(),
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
} = {}) {
  const required = ["commitProject", "listProjects", "getProject", "updateProject", "commitNode", "commitApplication", "commitEvent", "commitFrontier", "projectGraph"];
  if (!store || required.some((name) => typeof store[name] !== "function")) throw new TypeError("Live store is required");
  const nowIso = () => instant(now());

  async function requireProject(identity, projectId) {
    const project = await store.getProject(identity.subject, String(projectId));
    if (!project) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return project;
  }
  async function snapshot(identity, projectId) {
    const value = await store.projectGraph(identity.subject, String(projectId));
    if (!value) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return value;
  }
  async function graphFor(identity, projectId) {
    const state = await snapshot(identity, projectId);
    return projectLiveGraph(state.project, state.nodes, state.applications, state.events, state.frontier);
  }

  async function listProjects(rawIdentity, limit = 50) {
    const identity = requireIdentity(rawIdentity);
    const records = await store.listProjects(identity.subject, boundedLimit(limit));
    const output = [];
    for (const project of records) {
      const state = await store.projectGraph(identity.subject, project.id);
      const graph = state ? projectLiveGraph(state.project, state.nodes, state.applications, state.events, state.frontier) : null;
      output.push(projectSummary(project, graph));
    }
    return Object.freeze(output);
  }

  async function createProject(rawIdentity, input) {
    const identity = requireIdentity(rawIdentity);
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
    const event = audit(identity, "live.project.created", id, { slug: normal.slug, visibility: normal.visibility }, createdAt, randomBytes);
    try {
      return await store.commitProject(
        { id, subject: identity.subject, document, created_at: createdAt, updated_at: createdAt },
        { project_id: id, subject: identity.subject, role: "owner", created_at: createdAt },
        event,
      );
    } catch (error) {
      if (/slug already exists|UNIQUE constraint/i.test(String(error?.message))) throw new LiveError("LIVE_PROJECT_SLUG_EXISTS", "a Live project with this slug already exists", 409);
      throw error;
    }
  }

  async function getProject(rawIdentity, projectId) {
    const identity = requireIdentity(rawIdentity);
    return requireProject(identity, projectId);
  }

  async function updateProject(rawIdentity, projectId, patch) {
    const identity = requireIdentity(rawIdentity);
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new LiveError("INVALID_LIVE_PROJECT_PATCH", "project patch must be an object", 400);
    const allowed = new Set(["name", "slug", "summary", "visibility"]);
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new LiveError("INVALID_LIVE_PROJECT_PATCH", `unsupported project field: ${key}`);
    const current = await requireProject(identity, projectId);
    const normal = normaliseLiveProjectInput({ ...current, ...patch });
    const updatedAt = nowIso();
    const document = Object.freeze({ ...current, ...normal, updated_at: updatedAt });
    const event = audit(identity, "live.project.updated", current.id, { fields: Object.keys(patch).sort() }, updatedAt, randomBytes);
    try {
      return await store.updateProject({ id: current.id, subject: identity.subject, document, updated_at: updatedAt }, event);
    } catch (error) {
      if (/slug already exists|UNIQUE constraint/i.test(String(error?.message))) throw new LiveError("LIVE_PROJECT_SLUG_EXISTS", "a Live project with this slug already exists", 409);
      throw error;
    }
  }

  async function createNode(rawIdentity, projectId, input) {
    const identity = requireIdentity(rawIdentity);
    await requireProject(identity, projectId);
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
    const event = audit(identity, "live.node.created", id, { project_id: String(projectId), category: normal.category }, createdAt, randomBytes);
    const saved = await store.commitNode({ id, project_id: String(projectId), subject: identity.subject, document, created_at: createdAt }, event);
    if (!saved) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return saved;
  }

  async function createApplication(rawIdentity, projectId, input) {
    const identity = requireIdentity(rawIdentity);
    const state = await snapshot(identity, projectId);
    const normal = normaliseLiveApplicationInput(input);
    const nodeIds = new Set(state.nodes.map((node) => node.id));
    if (!nodeIds.has(normal.subject)) throw new LiveError("LIVE_GRAPH_ENDPOINT_MISSING", `application subject not found: ${normal.subject}`, 409);
    if (normal.target && !nodeIds.has(normal.target)) throw new LiveError("LIVE_GRAPH_ENDPOINT_MISSING", `application target not found: ${normal.target}`, 409);
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
    const event = audit(identity, "live.application.created", id, { project_id: String(projectId), relation: normal.relation }, createdAt, randomBytes);
    const saved = await store.commitApplication({ id, project_id: String(projectId), subject: identity.subject, document, created_at: createdAt }, event);
    if (!saved) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return saved;
  }

  async function appendEvent(rawIdentity, projectId, input) {
    const identity = requireIdentity(rawIdentity);
    const state = await snapshot(identity, projectId);
    const normal = normaliseLiveEventInput(input);
    const eventIds = new Set(state.events.map((event) => event.id));
    const applicationIds = new Set(state.applications.map((application) => application.id));
    const nodeIds = new Set(state.nodes.map((node) => node.id));
    for (const predecessor of normal.predecessor_ids) if (!eventIds.has(predecessor)) throw new LiveError("LIVE_HISTORY_PREDECESSOR_MISSING", `event predecessor not found: ${predecessor}`, 409);
    for (const applicationId of normal.application_ids) if (!applicationIds.has(applicationId)) throw new LiveError("LIVE_EVENT_APPLICATION_MISSING", `event application not found: ${applicationId}`, 409);
    if (normal.intent_id && !nodeIds.has(normal.intent_id)) throw new LiveError("LIVE_EVENT_INTENT_MISSING", `event intent not found: ${normal.intent_id}`, 409);
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
    const auditEvent = audit(identity, "live.event.appended", id, { project_id: String(projectId), kind: normal.kind, predecessor_count: normal.predecessor_ids.length }, createdAt, randomBytes);
    const saved = await store.commitEvent({ id, project_id: String(projectId), subject: identity.subject, document, created_at: createdAt }, auditEvent);
    if (!saved) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return saved;
  }

  async function setFrontier(rawIdentity, projectId, input) {
    const identity = requireIdentity(rawIdentity);
    const state = await snapshot(identity, projectId);
    const normal = normaliseFrontierDecision(input);
    const target = state.events.find((event) => event.id === normal.event_id);
    if (!target) throw new LiveError("LIVE_FRONTIER_EVENT_MISSING", "frontier event not found", 404);
    if (normal.state === "admitted") {
      for (const predecessor of target.predecessor_ids) {
        if (latestDecision(state.frontier, predecessor)?.state !== "admitted") {
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
    const auditEvent = audit(identity, "live.frontier.decided", id, { project_id: String(projectId), event_id: normal.event_id, state: normal.state }, createdAt, randomBytes);
    const saved = await store.commitFrontier({ id, project_id: String(projectId), subject: identity.subject, document, created_at: createdAt }, auditEvent);
    if (!saved) throw new LiveError("LIVE_PROJECT_NOT_FOUND", "Live project not found", 404);
    return saved;
  }

  async function graph(rawIdentity, projectId) {
    const identity = requireIdentity(rawIdentity);
    return graphFor(identity, projectId);
  }

  async function bindUniverseView(rawIdentity, projectId, universeViewId) {
    const identity = requireIdentity(rawIdentity);
    const current = await requireProject(identity, projectId);
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
    const event = audit(identity, "live.world_view.bound", current.id, { universe_view_id: String(view.id), authority_grant: "none" }, updatedAt, randomBytes);
    return store.updateProject({ id: current.id, subject: identity.subject, document, updated_at: updatedAt }, event);
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
