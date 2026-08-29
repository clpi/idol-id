const TEXT = new TextEncoder();
const VISIBILITIES = new Set(["private", "public"]);
const NODE_CATEGORIES = new Set([
  "outcome", "goal", "milestone", "workstream", "task", "attempt", "intent",
  "observation", "actor", "delegation", "capability", "claim", "conflict",
  "review", "witness", "evidence", "policy", "artifact", "context",
  "projection", "release", "incident",
]);
const EVENT_KINDS = new Set([
  "observed", "attempted", "completed", "failed", "reviewed", "witnessed",
  "injected", "invalidated", "superseded", "reversed",
]);
const FRONTIER_STATES = new Set(["held", "admitted", "rejected", "superseded", "reversed"]);
const PREFIXES = Object.freeze({ project: "lp_", node: "ln_", application: "la_", event: "le_", frontier: "lf_" });

export class LiveError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "LiveError";
    this.code = code;
    this.status = status;
  }
}

function utf8(value) { return TEXT.encode(String(value)).byteLength; }
function text(value) { return String(value ?? "").trim(); }
function exact(value, label, maximum = 320) {
  const result = text(value);
  if (!result || utf8(result) > maximum) throw new LiveError("INVALID_LIVE_INPUT", `${label} must contain 1 to ${maximum} UTF-8 bytes`);
  return result;
}
function nullable(value, label, maximum = 320) {
  const result = text(value);
  return result ? exact(result, label, maximum) : null;
}
function record(value, label, maximum = 16 * 1024) {
  if (value === undefined || value === null) return Object.freeze({});
  if (typeof value !== "object" || Array.isArray(value)) throw new LiveError("INVALID_LIVE_INPUT", `${label} must be an object`);
  const copy = structuredClone(value);
  if (utf8(JSON.stringify(copy)) > maximum) throw new LiveError("INVALID_LIVE_INPUT", `${label} is too large`);
  return deepFreeze(copy);
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function strings(value, label, maximum = 64, itemMaximum = 320) {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > maximum) throw new LiveError("INVALID_LIVE_INPUT", `${label} must contain at most ${maximum} entries`);
  const seen = new Set();
  const output = [];
  for (const candidate of value) {
    const item = exact(candidate, `${label} entry`, itemMaximum);
    if (seen.has(item)) throw new LiveError("LIVE_DUPLICATE_REFERENCE", `duplicate ${label} entry: ${item}`);
    seen.add(item);
    output.push(item);
  }
  return Object.freeze(output);
}
function id(value, kind) {
  const result = exact(value, `${kind} id`, 180);
  const prefix = PREFIXES[kind];
  if (!prefix || !result.startsWith(prefix) || !/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new LiveError("INVALID_LIVE_ID", `${kind} id is invalid`);
  }
  return result;
}
function slug(value) {
  const result = exact(value, "project slug", 64).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(result)) throw new LiveError("INVALID_LIVE_SLUG", "project slug must be lowercase words separated by hyphens");
  return result;
}
function instant(value, label) {
  const source = exact(value, label, 64);
  const date = new Date(source);
  if (!Number.isFinite(date.getTime())) throw new LiveError("INVALID_LIVE_TIME", `${label} is invalid`);
  return date.toISOString();
}

export function liveBoundary() {
  return Object.freeze({
    semantic_authority: false,
    collaboration_truth: true,
    semantic_universes: 1,
    accepted_frontiers: 1,
    world_authority_grant: "none",
    semantic_identity_minting: false,
    repository_write: false,
    process_execution: false,
    dispatcher_access: false,
  });
}

export function normaliseLiveProjectInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LiveError("INVALID_LIVE_PROJECT", "project input must be an object", 400);
  const visibility = text(input.visibility || "private");
  if (!VISIBILITIES.has(visibility)) throw new LiveError("INVALID_LIVE_VISIBILITY", "project visibility must be private or public");
  return Object.freeze({
    name: exact(input.name, "project name", 120),
    slug: slug(input.slug),
    summary: exact(input.summary, "project summary", 1024),
    visibility,
  });
}

export function normaliseLiveNodeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LiveError("INVALID_LIVE_NODE", "node input must be an object", 400);
  const category = exact(input.category, "node category", 40);
  if (!NODE_CATEGORIES.has(category)) throw new LiveError("INVALID_LIVE_NODE_CATEGORY", `unsupported Live node category: ${category}`);
  return Object.freeze({
    category,
    label: exact(input.label, "node label", 200),
    summary: exact(input.summary, "node summary", 2048),
    data: record(input.data, "node data"),
  });
}

export function normaliseLiveApplicationInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LiveError("INVALID_LIVE_APPLICATION", "application input must be an object", 400);
  return Object.freeze({
    relation: exact(input.relation, "relation identity", 200),
    subject: id(input.subject, "node"),
    target: input.target === undefined || input.target === null || input.target === "" ? null : id(input.target, "node"),
    operands: strings(input.operands, "application operands"),
    results: strings(input.results, "application results"),
    worlds: strings(input.worlds, "application worlds"),
    witnesses: strings(input.witnesses, "application witnesses"),
    demand: record(input.demand, "application demand"),
    provenance: record(input.provenance, "application provenance"),
  });
}

export function normaliseLiveEventInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LiveError("INVALID_LIVE_EVENT", "event input must be an object", 400);
  const kind = exact(input.kind, "event kind", 40);
  if (!EVENT_KINDS.has(kind)) throw new LiveError("INVALID_LIVE_EVENT_KIND", `unsupported Live event kind: ${kind}`);
  return Object.freeze({
    kind,
    predecessor_ids: strings(input.predecessor_ids, "event predecessors", 64, 180).map((value) => id(value, "event")),
    intent_id: input.intent_id === undefined || input.intent_id === null || input.intent_id === "" ? null : id(input.intent_id, "node"),
    application_ids: strings(input.application_ids, "event applications", 128, 180).map((value) => id(value, "application")),
    payload: record(input.payload, "event payload"),
  });
}

export function normaliseFrontierDecision(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LiveError("INVALID_LIVE_FRONTIER", "frontier decision must be an object", 400);
  const state = exact(input.state, "frontier state", 32);
  if (!FRONTIER_STATES.has(state)) throw new LiveError("INVALID_LIVE_FRONTIER_STATE", `unsupported frontier state: ${state}`);
  return Object.freeze({
    event_id: id(input.event_id, "event"),
    state,
    reason: exact(input.reason, "frontier reason", 2048),
  });
}

function referenceNode(reference, category, sourceApplication) {
  return Object.freeze({
    id: reference,
    category,
    label: reference,
    summary: `${category} reference published by ${sourceApplication}`,
    semantic_id: null,
    identity_status: "not-published",
    data: Object.freeze({ reference: true, source_application: sourceApplication }),
  });
}
function edgeId(applicationId, role, ordinal = 0) { return `${applicationId}:${role}:${ordinal}`; }
function addIndex(index, key, value) {
  if (!index[key]) index[key] = [];
  index[key].push(value);
}
function sortedRecordOfArrays(value) {
  return Object.freeze(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => [key, Object.freeze(items.sort())])));
}
function newestDecisionByEvent(frontier) {
  const latest = new Map();
  for (const decision of frontier) latest.set(decision.event_id, decision);
  return latest;
}
function frontierProjection(events, frontier) {
  const latest = newestDecisionByEvent(frontier);
  const admitted = events.filter((event) => latest.get(event.id)?.state === "admitted").map((event) => event.id);
  const admittedSet = new Set(admitted);
  let causallyClosed = true;
  for (const event of events) {
    if (!admittedSet.has(event.id)) continue;
    if (event.predecessor_ids.some((predecessor) => !admittedSet.has(predecessor))) causallyClosed = false;
  }
  return Object.freeze({
    decisions: Object.freeze(frontier.map((decision) => Object.freeze(structuredClone(decision)))),
    latest: Object.freeze(Object.fromEntries([...latest.entries()].sort(([a], [b]) => a.localeCompare(b)))),
    admitted_event_ids: Object.freeze(admitted),
    causally_closed: causallyClosed,
  });
}

export function projectLiveGraph(project, nodes = [], applications = [], events = [], frontier = []) {
  if (!project?.id) throw new LiveError("LIVE_PROJECT_REQUIRED", "Live graph requires a project", 500);
  const all = new Map();
  const projectedNodes = [];
  function addNode(node) {
    if (!node?.id) throw new LiveError("LIVE_GRAPH_ID_MISSING", "graph record has no id", 500);
    if (all.has(node.id)) throw new LiveError("LIVE_GRAPH_DUPLICATE_ID", `duplicate Live graph id: ${node.id}`, 409);
    const frozen = deepFreeze(structuredClone(node));
    all.set(node.id, frozen);
    projectedNodes.push(frozen);
  }
  for (const node of nodes) addNode(node);
  for (const application of applications) addNode(Object.freeze({
    id: application.id,
    category: "application",
    label: application.relation,
    summary: `application of ${application.relation}`,
    semantic_id: null,
    identity_status: "not-published",
    data: Object.freeze({ application_id: application.id }),
  }));

  const edges = [];
  const relationNodes = new Map();
  const referenceNodes = new Map();
  function ensureRelation(relation) {
    const relationId = `relation:${encodeURIComponent(relation)}`;
    if (!relationNodes.has(relationId)) {
      const node = Object.freeze({ id: relationId, category: "relation", label: relation, summary: "Live collaboration relation identity", semantic_id: null, identity_status: "not-published", data: Object.freeze({ relation }) });
      relationNodes.set(relationId, node);
      if (!all.has(relationId)) { all.set(relationId, node); projectedNodes.push(node); }
    }
    return relationId;
  }
  function ensureReference(reference, category, sourceApplication) {
    if (all.has(reference)) return reference;
    if (!referenceNodes.has(reference)) {
      const node = referenceNode(reference, category, sourceApplication);
      referenceNodes.set(reference, node);
      all.set(reference, node);
      projectedNodes.push(node);
    }
    return reference;
  }
  function publishEdge(application, role, target, ordinal = 0, qualification = null) {
    edges.push(Object.freeze({
      id: edgeId(application.id, role, ordinal),
      application_id: application.id,
      source: application.id,
      target,
      role,
      qualification,
      semantic_authority: false,
      role_owner: "live-application-projection",
    }));
  }

  for (const application of applications) {
    if (!all.has(application.subject)) throw new LiveError("LIVE_GRAPH_ENDPOINT_MISSING", `application subject not found: ${application.subject}`, 409);
    if (application.target && !all.has(application.target)) throw new LiveError("LIVE_GRAPH_ENDPOINT_MISSING", `application target not found: ${application.target}`, 409);
    publishEdge(application, "relation", ensureRelation(application.relation));
    publishEdge(application, "subject", application.subject);
    if (application.target) publishEdge(application, "target", application.target);
    application.operands.forEach((value, index) => publishEdge(application, "operand", ensureReference(value, "operand", application.id), index));
    application.results.forEach((value, index) => publishEdge(application, "result", ensureReference(value, "result", application.id), index));
    application.worlds.forEach((value, index) => publishEdge(application, "world", ensureReference(value, "world-reference", application.id), index, "reference-only; no authority grant"));
    application.witnesses.forEach((value, index) => publishEdge(application, "witness", ensureReference(value, "witness-reference", application.id), index));
    if (Object.keys(application.demand || {}).length) publishEdge(application, "demand", ensureReference(`demand:${application.id}`, "demand", application.id));
    if (Object.keys(application.provenance || {}).length) publishEdge(application, "provenance", ensureReference(`provenance:${application.id}`, "provenance", application.id));
  }

  const incoming = {};
  const outgoing = {};
  for (const edge of edges) {
    addIndex(outgoing, edge.source, edge.id);
    addIndex(incoming, edge.target, edge.id);
  }
  const orderedEvents = [...events].map((event) => deepFreeze(structuredClone(event))).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id));
  const knownEvents = new Set(orderedEvents.map((event) => event.id));
  for (const event of orderedEvents) {
    for (const predecessor of event.predecessor_ids) if (!knownEvents.has(predecessor)) throw new LiveError("LIVE_HISTORY_PREDECESSOR_MISSING", `event predecessor not found: ${predecessor}`, 409);
  }
  const orderedEdges = edges.sort((a, b) => a.role.localeCompare(b.role) || a.id.localeCompare(b.id));
  return Object.freeze({
    schema: "idol.web.live.graph.v1",
    semantic_authority: false,
    project: deepFreeze(structuredClone(project)),
    boundary: liveBoundary(),
    nodes: Object.freeze(projectedNodes.sort((a, b) => a.id.localeCompare(b.id))),
    applications: Object.freeze(applications.map((application) => deepFreeze(structuredClone(application))).sort((a, b) => a.id.localeCompare(b.id))),
    edges: Object.freeze(orderedEdges),
    history: Object.freeze(orderedEvents),
    frontier: frontierProjection(orderedEvents, frontier),
    indexes: Object.freeze({ incoming: sortedRecordOfArrays(incoming), outgoing: sortedRecordOfArrays(outgoing) }),
  });
}

export const LIVE_NODE_CATEGORIES = Object.freeze([...NODE_CATEGORIES].sort());
export const LIVE_EVENT_KINDS = Object.freeze([...EVENT_KINDS].sort());
export const LIVE_FRONTIER_STATES = Object.freeze([...FRONTIER_STATES].sort());
