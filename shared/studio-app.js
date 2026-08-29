import { remoteBundle } from "/shared/semantic-bundle.js";
import { buildSemanticIndex } from "/shared/semantic-index.js";

const q = (selector) => document.querySelector(selector);
const root = q("#idol-studio");
const editor = q("#studio-editor");
const facts = q("#studio-facts-body");
const projection = q("#studio-projection-body");
const capability = q("#studio-capability");
const analyzeButton = q('[data-action="analyze"]');
const lowerButton = q('[data-action="lower"]');
const sampleSelect = q("#studio-sample");

const authority = { repository: "clpi/idol", commit: "not-published" };
const state = {
  samples: [],
  source: "",
  bundle: null,
  index: null,
  selection: null,
  selectionKind: null,
  lowering: null,
  projection: "demand",
  request: 0,
  controller: null,
};

const graphView = new GraphView(q("#studio-graph"), {
  onSelectNode(node) { select("node", node?.raw || node); },
  onSelectEdge(edge) { select("edge", edge?.raw || edge); },
});
const graphEmpty = graphView.empty;
graphEmpty.id = "studio-graph-empty";
graphEmpty.classList.add("studio-graph-empty");
graphEmpty.innerHTML = "No semantic graph is inferred in the browser.<br>Analyze source to request exact compiler-published identities and structural edges.";

function setCapability(text, status = "") {
  capability.textContent = text;
  capability.classList.toggle("published", status === "published");
  capability.classList.toggle("refused", status === "refused");
}

function valueText(value) {
  if (value === undefined) return "unknown";
  if (value === null) return "absent";
  if (value === "") return "empty";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function appendRow(list, key, value, role = "") {
  const row = document.createElement("div");
  row.className = `studio-fact-row ${role}`.trim();
  const name = document.createElement("span");
  name.className = "key";
  name.textContent = key;
  const content = document.createElement("span");
  content.className = "value";
  content.textContent = valueText(value);
  row.append(name, content);
  list.appendChild(row);
}

function section(title) {
  const element = document.createElement("section");
  element.className = "studio-fact-section";
  const heading = document.createElement("h2");
  heading.textContent = title;
  element.appendChild(heading);
  facts.appendChild(element);
  return element;
}

function appendJson(parent, value) {
  const pre = document.createElement("pre");
  pre.className = "studio-fact-json";
  pre.textContent = JSON.stringify(value, null, 2);
  parent.appendChild(pre);
}

function recordId(record) { return record?.id || record?.application || record?.token_id || null; }

function linkedApplications(record) {
  const id = recordId(record);
  const graph = state.bundle?.graph;
  if (!id || !graph) return [];
  const result = [];
  for (const application of graph.applications || []) {
    const values = [application.id, application.application, application.relation, application.subject, ...(application.arguments || []), ...(application.results || [])];
    if (values.includes(id)) result.push(application);
  }
  return result;
}

function linkedEdges(record) {
  const id = recordId(record);
  if (!id) return [];
  return (state.bundle?.graph?.edges || []).filter((edge) => edge.from === id || edge.to === id);
}

function select(kind, record) {
  if (!record) return;
  state.selectionKind = kind;
  state.selection = record;
  const id = recordId(record);
  const edges = linkedEdges(record);
  graphView.setHighlights({ nodes: id ? [id] : [], edges: edges.map(recordId).filter(Boolean) });
  renderFacts();
  renderProjection();
  if (globalThis.innerWidth <= 699) setMobileMode("facts");
}

function renderFacts() {
  facts.replaceChildren();
  const selected = state.selection;
  if (!selected) {
    const empty = document.createElement("div");
    empty.className = "studio-empty";
    empty.innerHTML = "Select a compiler-published graph node or structural edge. <strong>Spelling is never upgraded into semantic identity.</strong> Unknown, absent, empty, zero and false remain distinct.";
    facts.appendChild(empty);
    return;
  }

  const identity = section("identity");
  appendRow(identity, "record", recordId(selected));
  appendRow(identity, "kind", selected.kind || state.selectionKind);
  appendRow(identity, "name", selected.name || selected.label);

  const application = linkedApplications(selected)[0] || (selected.relation || selected.subject ? selected : null);
  if (application) {
    const shape = section("application");
    appendRow(shape, "application", application.id || application.application, "result");
    appendRow(shape, "relation", application.relation, "relation");
    appendRow(shape, "subject", application.subject, "subject");
    appendRow(shape, "operands", application.arguments || application.operands, "operand");
    appendRow(shape, "results", application.results, "result");
    appendRow(shape, "world", application.world || application.worlds);
    appendRow(shape, "demand", application.demand || application.demands);
    appendRow(shape, "witness", application.witness || application.witnesses);
  }

  const edges = linkedEdges(selected);
  if (edges.length) {
    const structure = section("structural edges");
    for (const edge of edges.slice(0, 24)) appendRow(structure, edge.role || edge.structural_role || "edge", `${edge.from} → ${edge.to}`);
  }

  const raw = section("exact record");
  appendJson(raw, selected);
}

function recordsForProjection(name) {
  const graph = state.bundle?.graph || {};
  const selection = state.selection;
  const id = recordId(selection);
  const applications = linkedApplications(selection);
  const applicationIds = new Set(applications.flatMap((record) => [record.id, record.application]).filter(Boolean));
  if (selection?.application) applicationIds.add(selection.application);
  if (name === "demand") {
    return (graph.demands || []).filter((record) => !id || [record.id, record.target, record.occurrence, record.application].some((value) => value === id || applicationIds.has(value)));
  }
  if (name === "transform") {
    return (graph.transformations || graph.derivations || []).filter((record) => !id || [record.id, record.from, record.to, record.application].some((value) => value === id || applicationIds.has(value)));
  }
  if (name === "realization") {
    return (graph.realizations || []).filter((record) => !id || [record.id, record.application, record.result].some((value) => value === id || applicationIds.has(value)));
  }
  if (name === "machine") return state.lowering ? [state.lowering] : [];
  return [];
}

function renderProjection() {
  const records = recordsForProjection(state.projection);
  projection.replaceChildren();
  const pre = document.createElement("pre");
  if (records.length) pre.textContent = JSON.stringify(records.length === 1 ? records[0] : records, null, 2);
  else if (!state.bundle) pre.textContent = "Analyze source to request an exact compiler projection.";
  else if (state.projection === "machine") pre.textContent = "Request lowering to publish physical evidence. No machine form is inferred from graph names.";
  else pre.textContent = `${state.projection} record not published for the current selection.`;
  projection.appendChild(pre);
}

function setProjection(name) {
  state.projection = name;
  document.querySelectorAll("[data-projection]").forEach((button) => button.classList.toggle("here", button.dataset.projection === name));
  renderProjection();
}

function setMobileMode(mode) {
  root.dataset.studioMode = mode;
  document.querySelectorAll("[data-studio-mode]").forEach((button) => button.classList.toggle("here", button.dataset.studioMode === mode));
  if (mode === "graph") setTimeout(() => graphView.fitIfFirst?.(), 30);
}

function clearGraph() {
  state.bundle = null;
  state.index = null;
  state.selection = null;
  state.selectionKind = null;
  state.lowering = null;
  graphView.setGraph({ nodes: [], edges: [], applications: [] }).catch(() => {});
  graphEmpty.hidden = false;
  renderFacts();
  renderProjection();
}

async function analyze({ quiet = false } = {}) {
  const requestId = ++state.request;
  state.controller?.abort();
  state.controller = new AbortController();
  state.source = editor.value;
  analyzeButton.disabled = true;
  analyzeButton.textContent = "analyzing…";
  setCapability("requesting compiler projection");
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: state.source }),
      signal: state.controller.signal,
    });
    const result = await response.json().catch(() => ({ error: `analysis HTTP ${response.status}` }));
    if (!response.ok) throw new Error(result.detail || result.error || `analysis HTTP ${response.status}`);
    if (requestId !== state.request) return false;
    const lexical = Idol.tokenize(state.source);
    state.bundle = remoteBundle({ source: state.source, response: result, authority, tokens: lexical });
    state.index = buildSemanticIndex(state.bundle);
    state.selection = null;
    state.selectionKind = null;
    state.lowering = null;
    await graphView.setGraph(state.bundle.graph || { nodes: [], edges: [], applications: [] });
    graphEmpty.hidden = Boolean((state.bundle.graph?.nodes || []).length);
    const nodeCount = state.bundle.graph?.nodes?.length || 0;
    const edgeCount = state.bundle.graph?.edges?.length || 0;
    setCapability(`${nodeCount} nodes · ${edgeCount} exact structural edges`, "published");
    renderFacts();
    renderProjection();
    if (!quiet) Idol.toast?.("Compiler projection received");
    if (globalThis.innerWidth <= 699) setMobileMode("graph");
    return true;
  } catch (error) {
    if (error.name === "AbortError") return false;
    if (requestId !== state.request) return false;
    clearGraph();
    setCapability(`analysis refused · ${error.message}`, "refused");
    if (!quiet) Idol.toast?.(error.message, true);
    return false;
  } finally {
    if (requestId === state.request) {
      analyzeButton.disabled = false;
      analyzeButton.textContent = "analyze";
    }
  }
}

async function lower() {
  state.source = editor.value;
  lowerButton.disabled = true;
  lowerButton.textContent = "lowering…";
  try {
    if (!state.bundle) await analyze({ quiet: true });
    const response = await fetch("/api/lower", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: state.source, target: "native", emit: "asm", opt: "3" }),
    });
    const result = await response.json().catch(() => ({ error: `lowering HTTP ${response.status}` }));
    state.lowering = { status: response.ok ? "published physical evidence" : "refused", ...result };
    setProjection("machine");
    if (globalThis.innerWidth <= 699) setMobileMode("projection");
    if (!response.ok) throw new Error(result.detail || result.error || `lowering HTTP ${response.status}`);
  } catch (error) {
    state.lowering = { status: "refused", error: error.message };
    setProjection("machine");
    Idol.toast?.(error.message, true);
  } finally {
    lowerButton.disabled = false;
    lowerButton.textContent = "lower";
  }
}

function resetSource() {
  const selected = state.samples.find((sample) => sample.id === sampleSelect.value) || state.samples[0];
  if (selected) editor.value = selected.source;
  clearGraph();
  setCapability(selected ? `${selected.status} · explicit analyze required` : "source projection unavailable");
}

function fillSamples(manifest) {
  state.samples = (manifest?.examples || []).filter((sample) => typeof sample.source === "string" && sample.source.trim());
  sampleSelect.replaceChildren();
  for (const sample of state.samples) {
    const option = document.createElement("option");
    option.value = sample.id;
    option.textContent = `${sample.title} · ${sample.status}`;
    sampleSelect.appendChild(option);
  }
  resetSource();
}

async function loadAuthority() {
  const [authorityRecord, law, manifest, homes, worlds] = await Promise.all([
    fetch("/runtime/authority.json", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).catch(() => null),
    fetch("/runtime/source-law.json", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).catch(() => null),
    fetch("/content/source-examples.json", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).catch(() => null),
    fetch("/api/libs", { cache: "no-store" }).then((response) => response.ok ? response.json() : ({ libs: [] })).catch(() => ({ libs: [] })),
    fetch("/api/worlds", { cache: "no-store" }).then((response) => response.ok ? response.json() : ({ worlds: [] })).catch(() => ({ worlds: [] })),
  ]);
  authority.repository = authorityRecord?.language?.repository || "clpi/idol";
  authority.commit = authorityRecord?.language?.commit || "not-published";
  q("#studio-authority").textContent = authority.commit;
  q("#studio-native").textContent = authorityRecord?.native?.commit || "not-published";
  q("#studio-law").textContent = law?.source_law?.sha256 || authorityRecord?.language?.source_law?.sha256 || "not-published";
  const homeRecords = homes.libs || [];
  const worldRecords = worlds.worlds || [];
  q("#studio-corpus").textContent = `${worldRecords.length} worlds · ${homeRecords.length} homes`;
  if (manifest) fillSamples(manifest);
  else setCapability("source examples unavailable", "refused");
}

Shell.boot("site", { title: "Idol Studio", keys: [["⌘↵", "analyze"], ["⌘K", "commands"], ["1–4", "mobile projection"]] });
IdolShell.crumbs([{ label: "studio" }, { label: "semantic projection" }]);
IdolShell.commands([
  { id: "analyze", label: "Analyze current source", detail: "compiler projection", keywords: "run graph", run: analyze },
  { id: "lower", label: "Lower current source", detail: "native physical evidence", keywords: "machine asm", run: lower },
  { id: "fit", label: "Fit semantic graph", detail: "current view", keywords: "zoom graph", run: () => graphView.fit?.() || graphView.fitIfFirst?.() },
]);

document.querySelectorAll("[data-projection]").forEach((button) => button.addEventListener("click", () => setProjection(button.dataset.projection)));
document.querySelectorAll("[data-studio-mode]").forEach((button) => button.addEventListener("click", () => setMobileMode(button.dataset.studioMode)));
q('[data-action="analyze"]').addEventListener("click", analyze);
q('[data-action="lower"]').addEventListener("click", lower);
q('[data-action="reset"]').addEventListener("click", resetSource);
q('[data-action="fit"]').addEventListener("click", () => graphView.fit?.() || graphView.fitIfFirst?.());
q('[data-action="facts"]').addEventListener("click", () => {
  root.dataset.factsOpen = root.dataset.factsOpen === "true" ? "false" : "true";
  if (globalThis.innerWidth <= 699) setMobileMode("facts");
});
sampleSelect.addEventListener("change", resetSource);
editor.addEventListener("input", () => {
  if (state.bundle) {
    clearGraph();
    setCapability("source changed · analyze to publish a new projection");
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); analyze(); }
  if (!event.metaKey && !event.ctrlKey && !event.altKey && ["1", "2", "3", "4"].includes(event.key) && globalThis.innerWidth <= 699) {
    const modes = ["source", "graph", "facts", "projection"];
    setMobileMode(modes[Number(event.key) - 1]);
  }
});

renderFacts();
renderProjection();
loadAuthority();
