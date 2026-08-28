const EMPTY = Object.freeze([]);
const COLLECTIONS = Object.freeze([
  ["nodes", "graph_ids", "node"],
  ["applications", "application_ids", "application"],
  ["worlds", "world_ids", "world"],
  ["projections", "projection_ids", "projection"],
  ["derivations", "derivation_ids", "derivation"],
  ["transformations", "transformation_ids", "transformation"],
  ["witnesses", "witness_ids", "witness"],
  ["demands", "demand_ids", "demand"],
  ["realizations", "realization_ids", "realization"],
  ["definitions", "definition_ids", "definition"],
  ["references", "reference_ids", "reference"],
]);

const freezeArray = (values) => Object.freeze(values);
function freezeRecord(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeRecord(item);
    return Object.freeze(value);
  }
  for (const item of Object.values(value)) freezeRecord(item);
  return Object.freeze(value);
}
function recordId(record, collection) {
  if (!record || typeof record !== "object") return null;
  if (record.id != null) return String(record.id);
  if (collection === "applications" && record.application != null) return String(record.application);
  return null;
}
function byId(records, collection) {
  const map = new Map();
  for (const record of records || EMPTY) {
    const id = recordId(record, collection);
    if (id === null) continue;
    if (map.has(id)) throw new Error(`duplicate ${collection} identity ${id}`);
    map.set(id, record);
  }
  return map;
}
function append(map, key, value) {
  if (key == null) return;
  const id = String(key);
  const values = map.get(id);
  if (values) values.push(value);
  else map.set(id, [value]);
}
function frozenLookup(map, key) {
  const value = map.get(String(key));
  return value ? freezeArray([...value]) : EMPTY;
}
function normalizeTokenIndex(tokenOrIndex) {
  if (Number.isInteger(tokenOrIndex)) return tokenOrIndex;
  if (tokenOrIndex && Number.isInteger(tokenOrIndex.index)) return tokenOrIndex.index;
  return -1;
}
function linkResult(token, field, lookup) {
  const resolved = [];
  const unresolved = [];
  for (const id of token[field] || EMPTY) {
    const record = lookup(String(id));
    if (record) resolved.push(record);
    else unresolved.push(String(id));
  }
  return { resolved: freezeArray(resolved), unresolved: freezeArray(unresolved) };
}

export function buildSemanticIndex(bundle) {
  if (!bundle || bundle.schema !== "idol.web.semantic.bundle.v1") throw new Error("semantic bundle is required");
  const graph = bundle.graph || {};
  const maps = Object.fromEntries(COLLECTIONS.map(([collection]) => [collection, byId(graph[collection] || EMPTY, collection)]));
  const edges = Array.isArray(graph.edges) ? graph.edges : EMPTY;
  const edgesById = new Map();
  const outgoing = new Map();
  const incoming = new Map();
  edges.forEach((edge, index) => {
    const id = edge.id == null ? `presentation-edge:${index}` : String(edge.id);
    if (edgesById.has(id)) throw new Error(`duplicate graph edge identity ${id}`);
    edgesById.set(id, edge);
    append(outgoing, edge.from, edge);
    append(incoming, edge.to, edge);
  });

  const semanticOccurrences = new Map();
  const tokenIds = new Map();
  const spelling = new Map();
  for (const token of bundle.tokens) {
    if (token.token_id !== null) {
      if (tokenIds.has(token.token_id)) throw new Error(`duplicate exact token identity ${token.token_id}`);
      tokenIds.set(token.token_id, token);
    }
    append(spelling, token.value, token);
    const occurrenceIds = new Set([...(token.semantic_id === null ? [] : [token.semantic_id]), ...(token.graph_ids || EMPTY)]);
    for (const id of occurrenceIds) append(semanticOccurrences, id, token);
  }

  const api = {
    bundle,
    node(id) { return maps.nodes.get(String(id)) || null; },
    edge(id) { return edgesById.get(String(id)) || null; },
    application(id) { return maps.applications.get(String(id)) || null; },
    world(id) { return maps.worlds.get(String(id)) || null; },
    projection(id) { return maps.projections.get(String(id)) || null; },
    derivation(id) { return maps.derivations.get(String(id)) || null; },
    transformation(id) { return maps.transformations.get(String(id)) || null; },
    witness(id) { return maps.witnesses.get(String(id)) || null; },
    demand(id) { return maps.demands.get(String(id)) || null; },
    realization(id) { return maps.realizations.get(String(id)) || null; },
    definition(id) { return maps.definitions.get(String(id)) || null; },
    reference(id) { return maps.references.get(String(id)) || null; },
    token(id) { return tokenIds.get(String(id)) || null; },
    outgoing(id) { return frozenLookup(outgoing, id); },
    incoming(id) { return frozenLookup(incoming, id); },
    occurrences(id) { return frozenLookup(semanticOccurrences, id); },
    sameSpelling(value) { return frozenLookup(spelling, value); },
  };
  return Object.freeze(api);
}

export function selectionForToken(index, tokenOrIndex) {
  if (!index || !index.bundle) return null;
  const tokenIndex = normalizeTokenIndex(tokenOrIndex);
  const token = index.bundle.tokens[tokenIndex];
  if (!token) return null;

  const resolved = {};
  const unresolved = {};
  for (const [collection, field, method] of COLLECTIONS) {
    const result = linkResult(token, field, (id) => index[method](id));
    resolved[collection] = result.resolved;
    unresolved[field] = result.unresolved;
  }

  const edgeMap = new Map();
  const addEdge = (edge) => {
    const key = edge.id == null ? `${edge.from || "?"}\u0000${edge.to || "?"}\u0000${edge.role || edge.relation || edge.label || "?"}` : String(edge.id);
    if (!edgeMap.has(key)) edgeMap.set(key, edge);
  };
  for (const edge of token.edges || EMPTY) addEdge(edge);
  for (const id of [...(token.graph_ids || EMPTY), ...(token.application_ids || EMPTY)]) {
    for (const edge of index.outgoing(id)) addEdge(edge);
    for (const edge of index.incoming(id)) addEdge(edge);
  }

  const semanticIds = new Set([...(token.semantic_id === null ? [] : [token.semantic_id]), ...(token.graph_ids || EMPTY)]);
  const occurrences = [];
  const occurrenceKeys = new Set();
  for (const id of semanticIds) {
    for (const occurrence of index.occurrences(id)) {
      const key = occurrence.token_id || `span:${occurrence.span[0]}:${occurrence.span[1]}`;
      if (!occurrenceKeys.has(key)) {
        occurrenceKeys.add(key);
        occurrences.push(occurrence);
      }
    }
  }

  return freezeRecord({
    token,
    ...resolved,
    edges: [...edgeMap.values()],
    lowering: [...(token.lowering || EMPTY)],
    occurrences,
    same_spelling: [...index.sameSpelling(token.value)],
    unresolved,
  });
}
