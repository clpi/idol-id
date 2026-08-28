const SCHEMA = "idol.web.semantic.bundle.v1";
const BINDING = new Set(["published", "not-published", "ambiguous"]);
const CAPABILITIES = new Set(["lexical-preview", "browser-wasm", "remote-native"]);
const TOKEN_LINKS = Object.freeze([
  ["graph_ids", "graph identity"],
  ["application_ids", "application identity"],
  ["world_ids", "world identity"],
  ["projection_ids", "projection identity"],
  ["derivation_ids", "derivation identity"],
  ["transformation_ids", "transformation identity"],
  ["witness_ids", "witness identity"],
  ["demand_ids", "demand identity"],
  ["realization_ids", "realization identity"],
  ["definition_ids", "definition identity"],
  ["reference_ids", "reference identity"],
]);
const GRAPH_COLLECTIONS = Object.freeze([
  ["worlds", "world"],
  ["projections", "projection"],
  ["derivations", "derivation"],
  ["transformations", "transformation"],
  ["witnesses", "witness"],
  ["demands", "demand"],
  ["realizations", "realization"],
  ["definitions", "definition"],
  ["references", "reference"],
]);

const freezeArray = (values) => Object.freeze(values);
function freezeObject(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeObject(item);
    return Object.freeze(value);
  }
  for (const item of Object.values(value)) freezeObject(item);
  return Object.freeze(value);
}
function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}
function exactId(value, label, { nullable = false } = {}) {
  if (value === null || value === undefined || value === "") {
    if (nullable) return null;
    throw new Error(`${label} is required`);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`unsafe numeric ${label}`);
    return String(value);
  }
  if (typeof value !== "string") throw new Error(`invalid ${label}`);
  const id = value.trim();
  if (!id || id.length > 1024 || /[\u0000-\u001f\u007f]/.test(id)) throw new Error(`invalid ${label}`);
  return id;
}
function idList(value, label) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label}s must be an array`);
  return value.map((item) => exactId(item, label));
}
function authorityCommit(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return String(value.commit || value.language?.commit || "").trim();
}
function authorityRepository(value) {
  if (!value || typeof value !== "object") return "clpi/idol";
  return String(value.repository || value.language?.repository || "clpi/idol").trim() || "clpi/idol";
}
function admittedAuthority(kind, expected, produced) {
  if (!CAPABILITIES.has(kind)) throw new Error(`unsupported semantic capability ${kind}`);
  const expectedCommit = authorityCommit(expected);
  const producedCommit = authorityCommit(produced);
  if (expectedCommit && producedCommit && expectedCommit !== producedCommit) {
    throw new Error(`authority mismatch: expected ${expectedCommit}, received ${producedCommit}`);
  }
  return Object.freeze({
    kind,
    repository: authorityRepository(produced || expected),
    commit: producedCommit || expectedCommit || "not-published",
  });
}
function spanOf(token, sourceLength, exact = false) {
  const raw = exact
    ? (Array.isArray(token?.span) ? token.span : [token?.start ?? token?.s, token?.end ?? token?.e])
    : [token?.s ?? token?.start, token?.e ?? token?.end];
  const start = Number(raw[0]);
  const end = Number(raw[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sourceLength) {
    throw new Error(exact ? "invalid exact token span" : "invalid lexical token span");
  }
  return [start, end];
}
function emptyLinks() {
  return Object.fromEntries(TOKEN_LINKS.map(([field]) => [field, freezeArray([])]));
}
function lexicalToken(token, index, source, overrideSpan = null) {
  const span = overrideSpan || spanOf(token, source.length);
  return freezeObject({
    index,
    token_id: null,
    span: freezeArray(span),
    value: source.slice(span[0], span[1]),
    lexical_identity: String(token.t || token.lexical_identity || "token"),
    source_face: String(token.f || token.source_face || token.t || "token"),
    line: overrideSpan ? null : (Number.isInteger(token.l) ? token.l : null),
    column: overrideSpan ? null : (Number.isInteger(token.c) ? token.c : null),
    binding: Object.freeze({ status: "not-published" }),
    semantic_id: null,
    ...emptyLinks(),
    provenance: {
      source: {
        start: span[0],
        end: span[1],
        line: overrideSpan ? null : (token.l ?? null),
        column: overrideSpan ? null : (token.c ?? null),
      },
    },
    edges: [],
    lowering: [],
    raw: clone(token),
  });
}
function bindingStatus(token, semanticId, links) {
  const explicit = token.binding_status ?? token.binding?.status;
  if (explicit !== undefined && !BINDING.has(explicit)) throw new Error(`invalid token binding status ${explicit}`);
  const hasIdentity = semanticId !== null || Object.values(links).some((values) => values.length > 0);
  const status = explicit || (hasIdentity ? "published" : "not-published");
  if (status === "published" && !hasIdentity) throw new Error("published token binding has no identity");
  if (status === "not-published" && hasIdentity) throw new Error("not-published token binding carries identity");
  return status;
}
function normalizeEmbeddedEdges(value) {
  const edges = Array.isArray(value) ? clone(value) : [];
  for (const edge of edges) {
    if (!edge || typeof edge !== "object") throw new Error("invalid token edge record");
    if (edge.id != null) edge.id = exactId(edge.id, "edge identity");
    if (edge.from != null) edge.from = exactId(edge.from, "edge source identity");
    if (edge.to != null) edge.to = exactId(edge.to, "edge target identity");
  }
  return freezeObject(edges);
}
function normalizeLowering(value) {
  const projections = Array.isArray(value) ? clone(value) : [];
  for (const projection of projections) {
    if (!projection || typeof projection !== "object") throw new Error("invalid lowering record");
    if (projection.id != null) projection.id = exactId(projection.id, "lowering identity");
    for (const field of ["semantic_id", "graph_id", "application_id", "world_id", "projection_id", "realization_id"]) {
      if (projection[field] != null) projection[field] = exactId(projection[field], `${field.replaceAll("_", " ")}`);
    }
  }
  return freezeObject(projections);
}
function exactToken(token, index, source) {
  if (!token || typeof token !== "object") throw new Error("invalid exact token record");
  const span = spanOf(token, source.length, true);
  const semanticId = exactId(token.semantic_id, "semantic identity", { nullable: true });
  const links = Object.fromEntries(TOKEN_LINKS.map(([field, label]) => [field, freezeArray(idList(token[field], label))]));
  const status = bindingStatus(token, semanticId, links);
  const tokenId = exactId(token.token_id, "exact token identity", { nullable: true });
  return freezeObject({
    index,
    token_id: tokenId,
    span: freezeArray(span),
    value: String(token.value ?? token.v ?? source.slice(span[0], span[1])),
    lexical_identity: String(token.lexical_identity || token.kind || token.t || "token"),
    source_face: String(token.source_face || token.face || token.f || "not-published"),
    line: Number.isInteger(token.line) ? token.line : null,
    column: Number.isInteger(token.column ?? token.col) ? (token.column ?? token.col) : null,
    binding: Object.freeze({ status }),
    semantic_id: semanticId,
    ...links,
    provenance: clone(token.provenance || {}),
    edges: normalizeEmbeddedEdges(token.edges),
    lowering: normalizeLowering(token.lowering),
    raw: clone(token),
  });
}
function exactTokens(records, source) {
  if (!Array.isArray(records)) throw new Error("exact tokens must be an array");
  const tokens = records
    .map((token, index) => exactToken(token, index, source))
    .sort((left, right) => left.span[0] - right.span[0] || left.span[1] - right.span[1]);
  const ids = new Set();
  let end = -1;
  for (const token of tokens) {
    if (token.span[0] < end) throw new Error("exact token spans overlap");
    end = token.span[1];
    if (token.token_id !== null) {
      if (ids.has(token.token_id)) throw new Error(`duplicate exact token identity ${token.token_id}`);
      ids.add(token.token_id);
    }
  }
  return tokens;
}
function uncoveredSegments(span, exact) {
  let segments = [span];
  for (const projected of exact) {
    const [projectedStart, projectedEnd] = projected.span;
    const next = [];
    for (const [start, end] of segments) {
      if (projectedEnd <= start || projectedStart >= end) {
        next.push([start, end]);
        continue;
      }
      if (projectedStart > start) next.push([start, Math.min(projectedStart, end)]);
      if (projectedEnd < end) next.push([Math.max(projectedEnd, start), end]);
    }
    segments = next;
    if (!segments.length) break;
  }
  return segments.filter(([start, end]) => end > start);
}
function mergeProjectedTokens(lexicalRecords, projectedRecords, source) {
  const lexical = Array.isArray(lexicalRecords)
    ? lexicalRecords.map((token, index) => lexicalToken(token, index, source))
    : [];
  const exact = exactTokens(projectedRecords, source);
  const fallback = [];
  for (const token of lexical) {
    for (const segment of uncoveredSegments(token.span, exact)) {
      fallback.push(lexicalToken(token.raw, fallback.length, source, segment));
    }
  }
  return [...exact, ...fallback]
    .sort((left, right) => left.span[0] - right.span[0] || left.span[1] - right.span[1])
    .map((token, index) => freezeObject({ ...token, index }));
}
function graphArray(graph, name) {
  const value = graph?.[name] ?? [];
  if (!Array.isArray(value)) throw new Error(`graph ${name} must be an array`);
  return clone(value);
}
function optionalGraphId(value, label) {
  return value == null ? null : exactId(value, label);
}
function normalizeRecordIds(record, kind) {
  if (!record || typeof record !== "object") throw new Error(`invalid graph ${kind}`);
  const next = clone(record);
  if (next.id != null) next.id = exactId(next.id, `graph ${kind} identity`);
  else if (next[`${kind}_id`] != null) next.id = exactId(next[`${kind}_id`], `graph ${kind} identity`);
  else throw new Error(`graph ${kind} identity is required`);
  const singularFields = [
    "semantic_id", "graph_id", "application", "application_id", "relation", "subject", "world", "world_id",
    "projection", "projection_id", "derivation", "derivation_id", "transformation", "transformation_id",
    "witness", "witness_id", "demand", "demand_id", "realization", "realization_id", "definition", "definition_id",
    "reference", "reference_id", "source", "target", "from", "to", "supports", "depends", "result", "origin",
  ];
  for (const field of singularFields) {
    if (next[field] != null && (typeof next[field] === "string" || typeof next[field] === "number" || typeof next[field] === "bigint")) {
      next[field] = exactId(next[field], `graph ${kind} ${field.replaceAll("_", " ")}`);
    }
  }
  const pluralFields = ["graph_ids", "application_ids", "world_ids", "projection_ids", "derivation_ids", "transformation_ids", "witness_ids", "demand_ids", "realization_ids", "definition_ids", "reference_ids", "arguments", "results", "operands", "members", "dependencies"];
  for (const field of pluralFields) {
    if (next[field] != null) next[field] = idList(next[field], `graph ${kind} ${field.replaceAll("_", " ").replace(/s$/, "")}`);
  }
  return next;
}
function normalizeGraph(graph) {
  if (graph == null) return null;
  if (typeof graph !== "object") throw new Error("graph must be an object");
  const nodes = graphArray(graph, "nodes").map((node) => {
    if (!node || typeof node !== "object") throw new Error("invalid graph node");
    return { ...node, id: exactId(node.id, "graph node identity") };
  });
  const edges = graphArray(graph, "edges").map((edge) => {
    if (!edge || typeof edge !== "object") throw new Error("invalid graph edge");
    return {
      ...edge,
      ...(edge.id == null ? {} : { id: exactId(edge.id, "graph edge identity") }),
      from: exactId(edge.from, "graph edge source identity"),
      to: exactId(edge.to, "graph edge target identity"),
    };
  });
  const applications = graphArray(graph, "applications").map((application) => {
    if (!application || typeof application !== "object") throw new Error("invalid graph application");
    const applicationId = exactId(application.id ?? application.application, "graph application identity");
    return {
      ...application,
      id: applicationId,
      application: applicationId,
      relation: optionalGraphId(application.relation, "graph relation identity"),
      subject: optionalGraphId(application.subject, "graph subject identity"),
      world: optionalGraphId(application.world ?? application.world_id, "graph world identity"),
      arguments: idList(application.arguments ?? application.operands, "graph argument identity"),
      results: idList(application.results, "graph result identity"),
    };
  });
  const collections = {};
  for (const [name, kind] of GRAPH_COLLECTIONS) {
    collections[name] = graphArray(graph, name).map((record) => normalizeRecordIds(record, kind));
  }
  return freezeObject({ ...clone(graph), nodes, edges, applications, ...collections });
}
function responsePayload(response) {
  if (!response || typeof response !== "object") throw new Error("remote analysis response must be an object");
  if (response.schema === "idol.web.ide.analysis.v1" && response.result && typeof response.result === "object") return response.result;
  return response;
}
function buildBundle({ source, tokens, authority, response = null }) {
  const payload = response ? responsePayload(response) : null;
  return Object.freeze({
    schema: SCHEMA,
    source,
    authority,
    tokens: freezeArray(tokens),
    graph: response ? normalizeGraph(payload.graph) : null,
    explain: payload?.explain === undefined ? null : freezeObject(clone(payload.explain)),
    output: freezeObject(clone(payload?.lowering ?? payload?.lower ?? null)),
    raw: response,
  });
}
export function lexicalBundle({ source = "", tokens = [], authority = null } = {}) {
  const text = String(source);
  if (!Array.isArray(tokens)) throw new Error("lexical tokens must be an array");
  return buildBundle({
    source: text,
    tokens: tokens.map((token, index) => lexicalToken(token, index, text)),
    authority: admittedAuthority("lexical-preview", authority, null),
  });
}
function projectedBundle(kind, { source = "", response, authority = null, tokens = [] } = {}) {
  const text = String(source);
  const payload = responsePayload(response);
  const admitted = admittedAuthority(kind, authority, response.authority || payload.authority);
  const published = payload.tokens ?? payload.source_tokens ?? payload.semantic?.tokens;
  const normalized = published === undefined
    ? (Array.isArray(tokens) ? tokens.map((token, index) => lexicalToken(token, index, text)) : [])
    : mergeProjectedTokens(tokens, published, text);
  return buildBundle({ source: text, tokens: normalized, authority: admitted, response });
}
export function remoteBundle(input = {}) {
  return projectedBundle("remote-native", input);
}
export function browserWasmBundle(input = {}) {
  return projectedBundle("browser-wasm", input);
}
export function tokenSelection(bundle, tokenIndex) {
  if (!bundle || bundle.schema !== SCHEMA || !Number.isInteger(tokenIndex)) return null;
  return bundle.tokens[tokenIndex] || null;
}
export function bundleCapability(bundle) {
  const kind = bundle?.authority?.kind;
  return CAPABILITIES.has(kind) ? kind : "unavailable";
}
