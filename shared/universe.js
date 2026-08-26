const TEXT = new TextEncoder();
const MAX_SELECTIONS = 32;
const LENSES = new Set(["constellation", "reach", "authority", "projection", "security"]);
const VISIBILITIES = new Set(["private", "public"]);
const SOURCES = new Set(["published", "foreign"]);
const POLICY_KEYS = Object.freeze([
  "require_evidence",
  "deny_unpublished_identity",
  "deny_unverified_projection",
]);

export class UniverseError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "UniverseError";
    this.code = code;
    this.status = status;
  }
}

function text(value) {
  return String(value ?? "").trim();
}

function exact(value, label, maximum) {
  const result = text(value);
  if (!result || TEXT.encode(result).byteLength > maximum) {
    throw new UniverseError("INVALID_UNIVERSE_INPUT", `${label} must contain 1 to ${maximum} UTF-8 bytes`);
  }
  return result;
}

function nullableExact(value, label, maximum) {
  const result = text(value);
  return result ? exact(result, label, maximum) : "";
}

function strings(values, maximum = 64) {
  return Object.freeze([...new Set((Array.isArray(values) ? values : [])
    .map((value) => text(typeof value === "string" ? value : value?.fact || value?.id || value?.target))
    .filter(Boolean))].sort().slice(0, maximum));
}

function projectionSummary(projection) {
  const obligations = projection?.obligations && typeof projection.obligations === "object"
    ? Object.fromEntries(Object.entries(projection.obligations).map(([key, value]) => [key, strings(value, 32)]))
    : {};
  return Object.freeze({
    id: exact(projection?.id, "projection id", 160),
    target: exact(projection?.target, "projection target", 160),
    status: exact(projection?.status, "projection status", 64),
    artifact: projection?.artifact?.sha256 ? Object.freeze({ sha256: exact(projection.artifact.sha256, "artifact digest", 128) }) : null,
    evidence_status: text(projection?.evidence?.status) || "missing",
    obligations: Object.freeze(obligations),
    refusal: projection?.refusal?.code ? Object.freeze({
      code: exact(projection.refusal.code, "projection refusal", 160),
      detail: nullableExact(projection.refusal.detail, "projection refusal detail", 1024),
    }) : null,
  });
}

function freezeSelection(selection) {
  return Object.freeze({
    source: exact(selection?.source, "universe selection source", 32),
    key: exact(selection?.key, "universe selection key", 320),
  });
}

export function normaliseUniverseInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new UniverseError("INVALID_UNIVERSE_INPUT", "universe view input must be an object", 400);
  }
  const title = exact(input.title, "universe title", 120);
  const visibility = text(input.visibility || "private");
  if (!VISIBILITIES.has(visibility)) throw new UniverseError("INVALID_UNIVERSE_VISIBILITY", "universe visibility must be private or public");
  const lens = text(input.lens || "constellation");
  if (!LENSES.has(lens)) throw new UniverseError("INVALID_UNIVERSE_LENS", `unsupported universe lens: ${lens}`);
  const query = nullableExact(input.query, "universe query", 512);
  const rawSelections = Array.isArray(input.selections) ? input.selections : [];
  if (!rawSelections.length || rawSelections.length > MAX_SELECTIONS) {
    throw new UniverseError("INVALID_UNIVERSE_SELECTIONS", `universe view requires 1 to ${MAX_SELECTIONS} selections`);
  }
  const seen = new Set();
  const selections = rawSelections.map((candidate) => {
    const selection = freezeSelection(candidate);
    if (!SOURCES.has(selection.source)) throw new UniverseError("INVALID_UNIVERSE_SOURCE", `unsupported universe source: ${selection.source}`);
    const identity = `${selection.source}:${selection.key}`;
    if (seen.has(identity)) throw new UniverseError("UNIVERSE_SELECTION_DUPLICATE", `duplicate universe selection: ${identity}`);
    seen.add(identity);
    return selection;
  });
  const rawPolicy = input.policy && typeof input.policy === "object" && !Array.isArray(input.policy) ? input.policy : {};
  for (const key of Object.keys(rawPolicy)) {
    if (!POLICY_KEYS.includes(key)) throw new UniverseError("INVALID_UNIVERSE_POLICY", `unsupported universe policy: ${key}`);
  }
  const policy = Object.freeze(Object.fromEntries(POLICY_KEYS.map((key) => [key, Boolean(rawPolicy[key])])));
  return Object.freeze({ title, visibility, lens, query, policy, selections: Object.freeze(selections) });
}

export function catalogUniverseWorlds(worldManifest, foreignManifest) {
  const published = new Map();
  for (const record of Array.isArray(worldManifest?.worlds) ? worldManifest.worlds : []) {
    const name = exact(record?.name, "published world name", 160);
    const version = exact(record?.version, "published world version", 160);
    const key = `${name}@${version}`;
    if (published.has(key)) throw new UniverseError("UNIVERSE_CATALOG_DUPLICATE", `duplicate published world: ${key}`, 500);
    published.set(key, Object.freeze({
      source: "published",
      key,
      name,
      version,
      summary: nullableExact(record?.summary, "published world summary", 1024),
      publisher: nullableExact(record?.publisher, "published world publisher", 320),
      semantic_id: null,
      identity_status: record?.graph_id !== undefined && record?.graph_id !== null ? "published-graph" : "not-published",
      graph_id: record?.graph_id !== undefined && record?.graph_id !== null ? String(record.graph_id) : null,
      tags: strings(record?.tags, 64),
      requirements: Object.freeze([]),
      uncertainty: Object.freeze([]),
      projections: Object.freeze([]),
      evidence: Object.freeze({
        status: record?.stats?.source_hash ? "published-source-hash" : "not-published",
        source_hash: record?.stats?.source_hash ? String(record.stats.source_hash) : null,
      }),
      provenance: Object.freeze({ publisher: nullableExact(record?.publisher, "published world publisher", 320) }),
    }));
  }

  const foreign = new Map();
  for (const record of Array.isArray(foreignManifest?.worlds) ? foreignManifest.worlds : []) {
    const key = exact(record?.slug, "foreign world slug", 160);
    if (foreign.has(key)) throw new UniverseError("UNIVERSE_CATALOG_DUPLICATE", `duplicate foreign world: ${key}`, 500);
    if (record.semantic_id !== null || record.identity_status !== "not-published") {
      throw new UniverseError("UNIVERSE_FOREIGN_IDENTITY_INVALID", `foreign world ${key} must retain unpublished identity`, 500);
    }
    foreign.set(key, Object.freeze({
      source: "foreign",
      key,
      name: exact(record?.name, "foreign world name", 160),
      version: exact(record?.version, "foreign world version", 200),
      summary: nullableExact(record?.summary, "foreign world summary", 1024),
      publisher: "",
      semantic_id: null,
      identity_status: "not-published",
      graph_id: null,
      tags: strings([record?.provenance?.origin?.family, record?.provenance?.origin?.ecosystem], 32),
      requirements: strings(record?.requirements, 64),
      uncertainty: strings(record?.uncertainty, 64),
      projections: Object.freeze((Array.isArray(record?.projections) ? record.projections : []).map(projectionSummary)),
      evidence: Object.freeze({ status: "candidate-only", source_hash: null }),
      provenance: Object.freeze({ origin: Object.freeze({ ...(record?.provenance?.origin || {}) }) }),
    }));
  }
  return Object.freeze({ published, foreign });
}

export function resolveUniverseSelections(input, catalogs) {
  const normal = input?.selections ? input : normaliseUniverseInput(input);
  if (!(catalogs?.published instanceof Map) || !(catalogs?.foreign instanceof Map)) {
    throw new UniverseError("UNIVERSE_CATALOG_UNAVAILABLE", "universe catalogs are unavailable", 503);
  }
  return Object.freeze(normal.selections.map((selection) => {
    const record = catalogs[selection.source].get(selection.key);
    if (!record) throw new UniverseError("UNIVERSE_WORLD_NOT_FOUND", `universe selection not found: ${selection.source}:${selection.key}`, 404);
    return record;
  }));
}

function analyseUniverse(resolved, policy) {
  const sourceCounts = { published: 0, foreign: 0 };
  let unpublishedIdentityCount = 0;
  let projectionCount = 0;
  let admittedProjectionCount = 0;
  let unverifiedProjectionCount = 0;
  let refusalCount = 0;
  const vocabulary = new Set();
  const violations = [];

  for (const record of resolved) {
    sourceCounts[record.source] += 1;
    if (record.identity_status === "not-published") {
      unpublishedIdentityCount += 1;
      if (policy.deny_unpublished_identity) violations.push(Object.freeze({
        code: "UNPUBLISHED_IDENTITY_REFUSED",
        source: record.source,
        key: record.key,
      }));
    }
    for (const value of [...record.tags, ...record.requirements]) vocabulary.add(value);
    let recordHasUnverifiedProjection = false;
    for (const projection of record.projections) {
      projectionCount += 1;
      if (projection.status === "available" && projection.evidence_status === "verified" && projection.artifact?.sha256) admittedProjectionCount += 1;
      else {
        unverifiedProjectionCount += 1;
        recordHasUnverifiedProjection = true;
      }
      if (projection.refusal) refusalCount += 1;
      for (const values of Object.values(projection.obligations)) for (const value of values) vocabulary.add(value);
    }
    if (policy.deny_unverified_projection && recordHasUnverifiedProjection) violations.push(Object.freeze({
      code: "UNVERIFIED_PROJECTION_REFUSED",
      source: record.source,
      key: record.key,
    }));
  }

  return Object.freeze({
    selection_count: resolved.length,
    source_counts: Object.freeze(sourceCounts),
    unpublished_identity_count: unpublishedIdentityCount,
    projection_count: projectionCount,
    admitted_projection_count: admittedProjectionCount,
    unverified_projection_count: unverifiedProjectionCount,
    refusal_count: refusalCount,
    evidence_required: policy.require_evidence,
    vocabulary: Object.freeze([...vocabulary].filter(Boolean).sort()),
    violations: Object.freeze(violations),
    violation_count: violations.length,
  });
}

function boundary() {
  return Object.freeze({
    semantic_universes: 1,
    view_kind: "operational-projection",
    composition: "not-proven",
    reachability: "published-facts-only",
    compatibility: "not-proven",
    equivalence: "not-proven",
    injection: "not-proven",
    authority_grant: "none",
    source_world_mutation: false,
    world_publication: false,
  });
}

export function createUniverseView(input, catalogs, options = {}) {
  const normal = normaliseUniverseInput(input);
  const id = exact(options.id, "universe view id", 160);
  if (!/^uv_[A-Za-z0-9_-]{12,}$/.test(id)) throw new UniverseError("INVALID_UNIVERSE_ID", "universe view id is invalid");
  const createdAt = exact(options.createdAt, "universe creation time", 64);
  const updatedAt = exact(options.updatedAt || createdAt, "universe update time", 64);
  const resolved = resolveUniverseSelections(normal, catalogs);
  return Object.freeze({
    schema: "idol.web.universe.view.v1",
    id,
    semantic_id: null,
    identity_status: "not-published",
    title: normal.title,
    visibility: normal.visibility,
    lens: normal.lens,
    query: normal.query,
    policy: normal.policy,
    selections: normal.selections,
    resolved,
    analysis: analyseUniverse(resolved, normal.policy),
    boundary: boundary(),
    created_at: createdAt,
    updated_at: updatedAt,
  });
}

export function universeViewSummary(view) {
  if (!view) return null;
  return Object.freeze({
    schema: "idol.web.universe.view.summary.v1",
    id: exact(view.id, "universe view id", 160),
    title: exact(view.title, "universe title", 120),
    visibility: exact(view.visibility, "universe visibility", 16),
    lens: exact(view.lens, "universe lens", 32),
    selection_count: Number(view.analysis?.selection_count ?? view.selections?.length ?? 0),
    violation_count: Number(view.analysis?.violation_count ?? 0),
    created_at: exact(view.created_at, "universe creation time", 64),
    updated_at: exact(view.updated_at || view.created_at, "universe update time", 64),
  });
}

export function publicUniverseView(view) {
  if (!view || view.visibility !== "public") throw new UniverseError("UNIVERSE_VIEW_NOT_FOUND", "universe view not found", 404);
  return Object.freeze({
    schema: "idol.web.universe.public.v1",
    id: view.id,
    semantic_id: null,
    identity_status: "not-published",
    title: view.title,
    visibility: "public",
    lens: view.lens,
    query: view.query,
    policy: view.policy,
    selections: view.selections,
    resolved: view.resolved,
    analysis: view.analysis,
    boundary: view.boundary,
    created_at: view.created_at,
    updated_at: view.updated_at,
  });
}
