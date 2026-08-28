const EMPTY = Object.freeze([]);

function exactId(value, label) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`unsafe numeric ${label}`);
    return String(value);
  }
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}
function freezeRecord(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeRecord(item);
    return Object.freeze(value);
  }
  for (const item of Object.values(value)) freezeRecord(item);
  return Object.freeze(value);
}
function append(map, key, value) {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}
function edgeKey(edge, index) {
  return edge.id == null ? `presentation-edge:${index}` : exactId(edge.id, "graph edge identity");
}

export function edgePresentation(edge = {}) {
  for (const field of ["role", "structural_role", "edge_role"]) {
    if (typeof edge[field] === "string" && edge[field].trim()) {
      return Object.freeze({ label: edge[field].trim(), field, status: "published" });
    }
  }
  for (const field of ["relation", "label", "kind"]) {
    if (typeof edge[field] === "string" && edge[field].trim()) {
      return Object.freeze({ label: edge[field].trim(), field, status: "published-unclassified" });
    }
  }
  return Object.freeze({ label: "role not published", field: null, status: "not-published" });
}

export function publishedGraphModel(graph = {}) {
  if (!graph || typeof graph !== "object") throw new Error("published graph is required");
  const rawNodes = graph.nodes ?? [];
  const rawEdges = graph.edges ?? [];
  const applicationRecords = graph.applications ?? [];
  if (!Array.isArray(rawNodes)) throw new Error("graph nodes must be an array");
  if (!Array.isArray(rawEdges)) throw new Error("graph edges must be an array");
  if (!Array.isArray(applicationRecords)) throw new Error("graph applications must be an array");

  const nodeById = new Map();
  const nodes = rawNodes.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("invalid published graph node");
    const id = exactId(raw.id, "graph node identity");
    if (nodeById.has(id)) throw new Error(`duplicate graph node identity ${id}`);
    const node = freezeRecord({ ...raw, id });
    nodeById.set(id, node);
    return node;
  });

  const edgeById = new Map();
  const incoming = new Map();
  const outgoing = new Map();
  const edges = rawEdges.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("invalid published graph edge");
    const id = edgeKey(raw, index);
    if (edgeById.has(id)) throw new Error(`duplicate graph edge identity ${id}`);
    const from = exactId(raw.from, "graph edge source identity");
    const to = exactId(raw.to, "graph edge target identity");
    if (!nodeById.has(from) || !nodeById.has(to)) throw new Error(`unknown graph endpoint ${from} -> ${to}`);
    const presentation = edgePresentation(raw);
    const edge = freezeRecord({ ...raw, id, from, to, presentation, synthetic: false });
    edgeById.set(id, edge);
    append(outgoing, from, edge);
    append(incoming, to, edge);
    return edge;
  });
  for (const values of incoming.values()) Object.freeze(values);
  for (const values of outgoing.values()) Object.freeze(values);

  const applications = applicationRecords.map((record) => freezeRecord({ ...record }));
  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    application_records: Object.freeze(applications),
    nodeById,
    edgeById,
    incoming,
    outgoing,
  });
}

export function deterministicLayout(model, { width = 960, height = 620, padding = 72 } = {}) {
  if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges)) throw new Error("published graph model is required");
  const ids = model.nodes.map((node) => node.id);
  const indegree = new Map(ids.map((id) => [id, 0]));
  const layer = new Map(ids.map((id) => [id, 0]));
  for (const edge of model.edges) indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);

  const queue = ids.filter((id) => indegree.get(id) === 0).sort((left, right) => left.localeCompare(right));
  const visited = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const currentLayer = layer.get(id) || 0;
    const outgoing = model.outgoing.get(id) || EMPTY;
    for (const edge of outgoing) {
      layer.set(edge.to, Math.max(layer.get(edge.to) || 0, currentLayer + 1));
      indegree.set(edge.to, (indegree.get(edge.to) || 0) - 1);
      if (indegree.get(edge.to) === 0) {
        queue.push(edge.to);
        queue.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  const maxKnown = Math.max(0, ...layer.values());
  const cyclic = ids.filter((id) => !visited.has(id)).sort((left, right) => left.localeCompare(right));
  cyclic.forEach((id, index) => layer.set(id, maxKnown + 1 + Math.floor(index / 12)));

  const groups = new Map();
  for (const node of model.nodes) append(groups, layer.get(node.id) || 0, node);
  const layers = [...groups.keys()].sort((left, right) => left - right);
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const result = new Map();
  for (const layerIndex of layers) {
    const records = groups.get(layerIndex).sort((left, right) => left.id.localeCompare(right.id));
    const x = layers.length === 1
      ? width / 2
      : padding + usableWidth * (layers.indexOf(layerIndex) / (layers.length - 1));
    records.forEach((node, position) => {
      const y = records.length === 1
        ? height / 2
        : padding + usableHeight * (position / (records.length - 1));
      result.set(node.id, Object.freeze({ x, y, layer: layerIndex, order: position }));
    });
  }
  return result;
}

export function selectionNeighbourhood(model, id) {
  const identity = String(id);
  const selectedEdges = [];
  const edgeIds = new Set();
  for (const edge of [...(model.incoming.get(identity) || EMPTY), ...(model.outgoing.get(identity) || EMPTY)]) {
    if (!edgeIds.has(edge.id)) {
      edgeIds.add(edge.id);
      selectedEdges.push(edge);
    }
  }
  const nodeIds = new Set([identity]);
  for (const edge of selectedEdges) {
    nodeIds.add(edge.from);
    nodeIds.add(edge.to);
  }
  return freezeRecord({
    nodes: model.nodes.filter((node) => nodeIds.has(node.id)),
    edges: model.edges.filter((edge) => edgeIds.has(edge.id)),
  });
}
