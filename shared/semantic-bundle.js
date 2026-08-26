const SCHEMA = "idol.web.semantic.bundle.v1";
const BINDING = new Set(["published", "not-published", "ambiguous"]);
const CAPABILITIES = new Set(["lexical-preview", "browser-wasm", "remote-native"]);

function freezeArray(values) {
  return Object.freeze(values);
}

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
  if (value === undefined) return undefined;
  return structuredClone(value);
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
  const commit = producedCommit || expectedCommit || "not-published";
  return Object.freeze({
    kind,
    repository: authorityRepository(produced || expected),
    commit,
  });
}

function lexicalSpan(token, sourceLength) {
  const start = Number(token?.s ?? token?.start);
  const end = Number(token?.e ?? token?.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sourceLength) {
    throw new Error("invalid lexical token span");
  }
  return [start, end];
}

function exactSpan(token, sourceLength) {
  const raw = Array.isArray(token?.span)
    ? token.span
    : [token?.start ?? token?.s, token?.end ?? token?.e];
  const start = Number(raw[0]);
  const end = Number(raw[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sourceLength) {
    throw new Error("invalid exact token span");
  }
  return [start, end];
}

function lexicalToken(token, index, source) {
  const span = lexicalSpan(token, source.length);
  const value = String(token.v ?? source.slice(span[0], span[1]));
  return Object.freeze({
    index,
    token_id: null,
    span: freezeArray(span),
    value,
    lexical_identity: String(token.t || "token"),
    source_face: String(token.f || token.t || "token"),
    line: Number.isInteger(token.l) ? token.l : null,
    column: Number.isInteger(token.c) ? token.c : null,
    binding: Object.freeze({ status: "not-published" }),
    semantic_id: null,
    graph_ids: freezeArray([]),
    application_ids: freezeArray([]),
    provenance: freezeObject({
      source: { start: span[0], end: span[1], line: token.l ?? null, column: token.c ?? null },
    }),
    edges: freezeArray([]),
    lowering: freezeArray([]),
    raw: token,
  });
}

function exactBindingStatus(token, semanticId, graphIds, applicationIds) {
  const explicit = token.binding_status ?? token.binding?.status;
  if (explicit !== undefined && !BINDING.has(explicit)) throw new Error(`invalid token binding status ${explicit}`);
  const hasIdentity = semanticId !== null || graphIds.length > 0 || applicationIds.length > 0;
  const status = explicit || (hasIdentity ? "published" : "not-published");
  if (status === "published" && !hasIdentity) throw new Error("published token binding has no identity");
  if (status === "not-published" && hasIdentity) throw new Error("not-published token binding carries identity");
  return status;
}

function exactToken(token, index, source) {
  if (!token || typeof token !== "object") throw new Error("invalid exact token record");
  const span = exactSpan(token, source.length);
  const semanticId = exactId(token.semantic_id, "semantic identity", { nullable: true });
  const graphIds = idList(token.graph_ids, "graph identity");
  const applicationIds = idList(token.application_ids, "application identity");
  const status = exactBindingStatus(token, semanticId, graphIds, applicationIds);
  const tokenId = exactId(token.token_id, "exact token identity", { nullable: true });
  const edges = Array.isArray(token.edges) ? clone(token.edges) : [];
  const lowering = Array.isArray(token.lowering) ? clone(token.lowering) : [];
  for (const edge of edges) {
    if (edge?.id !== undefined && edge?.id !== null) edge.id = exactId(edge.id, "edge identity");
    if (edge?.from !== undefined && edge?.from !== null) edge.from = exactId(edge.from, "edge source identity");
    if (edge?.to !== undefined && edge?.to !== null) edge.to = exactId(edge.to, "edge target identity");
  }
  for (const projection of lowering) {
    if (projection?.id !== undefined && projection?.id !== null) projection.id = exactId(projection.id, "lowering identity");
  }
  return Object.freeze({
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
    graph_ids: freezeArray(graphIds),
    application_ids: freezeArray(applicationIds),
    provenance: freezeObject(clone(token.provenance || {})),
    edges: freezeObject(edges),
    lowering: freezeObject(lowering),
    raw: token,
  });
}

function exactTokens(records, source) {
  if (!Array.isArray(records)) throw new Error("exact tokens must be an array");
  const tokens = records.map((token, index) => exactToken(token, index, source))
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
  return tokens.map((token, index) => token.index === index ? token : Object.freeze({ ...token, index }));
}

function graphArray(graph, name) {
  const value = graph?.[name] ?? [];
  if (!Array.isArray(value)) throw new Error(`graph ${name} must be an array`);
  return clone(value);
}

function optionalGraphId(value, label) {
  return value === null || value === undefined ? null : exactId(value, label);
}

function normalizeGraph(graph) {
  if (graph === null || graph === undefined) return null;
  if (typeof graph !== "object") throw new Error("graph must be an object");
  const nodes = graphArray(graph, "nodes").map((node) => {
    if (!node || typeof node !== "object") throw new Error("invalid graph node");
    return { ...node, id: exactId(node.id, "graph node identity") };
  });
  const edges = graphArray(graph, "edges").map((edge) => {
    if (!edge || typeof edge !== "object") throw new Error("invalid graph edge");
    return {
      ...edge,
      ...(edge.id === undefined || edge.id === null ? {} : { id: exactId(edge.id, "graph edge identity") }),
      from: exactId(edge.from, "graph edge source identity"),
      to: exactId(edge.to, "graph edge target identity"),
    };
  });
  const applications = graphArray(graph, "applications").map((application) => {
    if (!application || typeof application !== "object") throw new Error("invalid graph application");
    return {
      ...application,
      application: exactId(application.application, "graph application identity"),
      relation: optionalGraphId(application.relation, "graph relation identity"),
      subject: optionalGraphId(application.subject, "graph subject identity"),
      arguments: idList(application.arguments, "graph argument identity"),
      results: idList(application.results, "graph result identity"),
    };
  });
  return freezeObject({ ...clone(graph), nodes, edges, applications });
}

function responsePayload(response) {
  if (!response || typeof response !== "object") throw new Error("remote analysis response must be an object");
  if (response.schema === "idol.web.ide.analysis.v1" && response.result && typeof response.result === "object") return response.result;
  return response;
}

function buildBundle({ kind, source, tokens, authority, response = null }) {
  const graph = response ? normalizeGraph(responsePayload(response).graph) : null;
  const payload = response ? responsePayload(response) : null;
  const explain = payload?.explain === undefined ? null : freezeObject(clone(payload.explain));
  const output = payload?.lowering ?? payload?.lower ?? null;
  return Object.freeze({
    schema: SCHEMA,
    source,
    authority,
    tokens: freezeArray(tokens),
    graph,
    explain,
    output: freezeObject(clone(output)),
    raw: response,
  });
}

export function lexicalBundle({ source = "", tokens = [], authority = null } = {}) {
  const text = String(source);
  if (!Array.isArray(tokens)) throw new Error("lexical tokens must be an array");
  const admitted = admittedAuthority("lexical-preview", authority, null);
  return buildBundle({
    kind: "lexical-preview",
    source: text,
    tokens: tokens.map((token, index) => lexicalToken(token, index, text)),
    authority: admitted,
  });
}

export function remoteBundle({ source = "", response, authority = null, tokens = [] } = {}) {
  const text = String(source);
  const payload = responsePayload(response);
  const admitted = admittedAuthority("remote-native", authority, response.authority || payload.authority);
  const published = payload.tokens ?? payload.source_tokens ?? payload.semantic?.tokens;
  const normalized = published === undefined
    ? (Array.isArray(tokens) ? tokens.map((token, index) => lexicalToken(token, index, text)) : [])
    : exactTokens(published, text);
  return buildBundle({
    kind: "remote-native",
    source: text,
    tokens: normalized,
    authority: admitted,
    response,
  });
}

export function browserWasmBundle({ source = "", response, authority = null, tokens = [] } = {}) {
  const text = String(source);
  const payload = responsePayload(response);
  const admitted = admittedAuthority("browser-wasm", authority, response.authority || payload.authority);
  const published = payload.tokens ?? payload.source_tokens ?? payload.semantic?.tokens;
  const normalized = published === undefined
    ? (Array.isArray(tokens) ? tokens.map((token, index) => lexicalToken(token, index, text)) : [])
    : exactTokens(published, text);
  return buildBundle({
    kind: "browser-wasm",
    source: text,
    tokens: normalized,
    authority: admitted,
    response,
  });
}

export function tokenSelection(bundle, tokenIndex) {
  if (!bundle || bundle.schema !== SCHEMA || !Number.isInteger(tokenIndex)) return null;
  return bundle.tokens[tokenIndex] || null;
}

export function bundleCapability(bundle) {
  const kind = bundle?.authority?.kind;
  return CAPABILITIES.has(kind) ? kind : "unavailable";
}
