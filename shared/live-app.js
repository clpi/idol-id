const PROJECTS_API = "/v1/live/browser/projects";
const state = {
  session: null,
  projects: [],
  selectedProject: null,
  graph: null,
  selectedRecord: null,
  mobileView: "catalog",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const exact = (value) => value === undefined || value === null || value === "" ? "—" : String(value);
const json = (value) => JSON.stringify(value, null, 2);

function errorMessage(error) {
  return error?.detail || error?.message || String(error || "Live operation failed");
}
function message(value, isError = false) {
  const node = $("#live-message");
  if (!node) return;
  node.hidden = !value;
  node.textContent = value || "";
  node.classList.toggle("error", isError);
}
async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
    headers.set("x-idol-request", "browser");
  }
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  let body;
  try { body = await response.json(); }
  catch { body = { error: `HTTP_${response.status}` }; }
  if (!response.ok) {
    const error = new Error(body.detail || body.error || `HTTP ${response.status}`);
    Object.assign(error, body, { status: response.status });
    throw error;
  }
  return body;
}
function buttonRecord(label, detail, kind, value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "live-record";
  button.dataset.recordKind = kind;
  button.innerHTML = `<strong></strong><span></span>`;
  $("strong", button).textContent = exact(label);
  $("span", button).textContent = exact(detail);
  button.addEventListener("click", () => selectRecord(kind, value));
  return button;
}
function selectRecord(kind, value) {
  state.selectedRecord = { kind, value };
  const facts = $("#facts-panel");
  const raw = $("#raw-record");
  if (facts) {
    facts.replaceChildren();
    const title = document.createElement("h3");
    title.textContent = kind;
    const boundary = document.createElement("p");
    boundary.textContent = "semantic identity not published · authority grant none";
    const pairs = document.createElement("dl");
    for (const [key, item] of Object.entries(value || {})) {
      const term = document.createElement("dt"); term.textContent = key;
      const definition = document.createElement("dd"); definition.textContent = typeof item === "object" ? json(item) : exact(item);
      pairs.append(term, definition);
    }
    facts.append(title, boundary, pairs);
  }
  if (raw) raw.textContent = json(value);
  setMobileView("facts");
}
function setMobileView(view) {
  state.mobileView = view;
  $$('[data-mobile-view]').forEach((button) => {
    const here = button.dataset.mobileView === view;
    button.classList.toggle("here", here);
    button.setAttribute("aria-pressed", String(here));
  });
  $$(".live-view").forEach((node) => node.classList.toggle("mobile-here", node.id === `live-${view}`));
}
function projectDetail(id) { return `${PROJECTS_API}/${encodeURIComponent(id)}`; }
function renderProjects() {
  const mount = $("#project-list");
  if (!mount) return;
  mount.replaceChildren();
  if (!state.projects.length) {
    const empty = document.createElement("div");
    empty.className = "live-empty";
    empty.textContent = "No Live projects yet.";
    mount.appendChild(empty);
    return;
  }
  for (const project of state.projects) {
    const button = buttonRecord(project.name, `${project.slug} · ${project.frontier_admitted_count || 0} admitted`, "project", project);
    button.classList.toggle("here", project.id === state.selectedProject?.id);
    button.addEventListener("click", () => selectProject(project.id), { once: true });
    mount.appendChild(button);
  }
}
function renderHeader() {
  const project = state.selectedProject;
  const empty = $("#project-empty");
  const dashboard = $("#project-dashboard");
  if (empty) empty.hidden = Boolean(project);
  if (dashboard) dashboard.hidden = !project;
  if (!project) return;
  for (const [selector, value] of [
    ["#project-title", project.name],
    ["#project-summary", project.summary],
    ["#project-id", project.id],
    ["#project-visibility", project.visibility],
    ["#project-world-view", project.universe_view_id || "not bound"],
    ["#project-authority", "authority grant none"],
  ]) { const node = $(selector); if (node) node.textContent = exact(value); }
}
function renderGraph() {
  const graph = state.graph;
  const mount = $("#graph-visual");
  if (!mount) return;
  mount.replaceChildren();
  if (!graph) return;
  const nodeSection = document.createElement("section");
  nodeSection.className = "live-record-grid";
  for (const node of graph.nodes || []) {
    nodeSection.appendChild(buttonRecord(node.label || node.id, `${node.category} · ${node.id}`, "node", node));
  }
  const applicationSection = document.createElement("section");
  applicationSection.className = "live-record-grid";
  for (const application of graph.applications || []) {
    applicationSection.appendChild(buttonRecord(application.relation, `application · ${application.id}`, "application", application));
  }
  const edgeSection = document.createElement("section");
  edgeSection.className = "live-edge-list";
  for (const edge of graph.edges || []) {
    const detail = `${edge.source} → ${edge.target}`;
    edgeSection.appendChild(buttonRecord(edge.role, detail, "edge", edge));
  }
  mount.append(nodeSection, applicationSection, edgeSection);
}
function renderHistory() {
  const graph = state.graph;
  const mount = $("#history-list");
  if (!mount) return;
  mount.replaceChildren();
  if (!graph) return;
  for (const event of graph.history || []) {
    mount.appendChild(buttonRecord(event.kind, `${event.id} · ${event.predecessor_ids?.length || 0} predecessors`, "event", event));
  }
  for (const decision of graph.frontier?.decisions || []) {
    mount.appendChild(buttonRecord(decision.state, `${decision.event_id} · ${decision.reason}`, "frontier", decision));
  }
}
function renderBoundary() {
  const graph = state.graph;
  const values = {
    "#boundary-universe": graph?.boundary?.semantic_universes ?? 1,
    "#boundary-frontier": graph?.boundary?.accepted_frontiers ?? 1,
    "#boundary-authority": graph?.boundary?.world_authority_grant ?? "none",
    "#boundary-dispatch": graph?.boundary?.dispatcher_access ? "granted" : "none",
  };
  for (const [selector, value] of Object.entries(values)) { const node = $(selector); if (node) node.textContent = exact(value); }
}
function renderAll() {
  renderProjects();
  renderHeader();
  renderGraph();
  renderHistory();
  renderBoundary();
  $$('[data-project-form]').forEach((form) => {
    for (const control of form.elements) control.disabled = !state.selectedProject;
  });
}
async function loadProjects(selectFirst = true) {
  const body = await request(PROJECTS_API);
  state.projects = body.projects || [];
  renderProjects();
  if (selectFirst && !state.selectedProject && state.projects[0]) await selectProject(state.projects[0].id);
}
async function selectProject(id) {
  state.selectedProject = await request(projectDetail(id));
  state.graph = await request(`${projectDetail(id)}/graph`);
  state.selectedRecord = null;
  renderAll();
  setMobileView("graph");
}
async function mutate(path, method, body, success) {
  message("");
  try {
    const result = await request(path, { method, body: JSON.stringify(body) });
    message(success);
    if (state.selectedProject) await selectProject(state.selectedProject.id);
    else await loadProjects();
    return result;
  } catch (error) {
    message(errorMessage(error), true);
    throw error;
  }
}
function fields(form) { return Object.fromEntries(new FormData(form).entries()); }
function list(value) { return String(value || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean); }

$("#live-project-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = fields(event.currentTarget);
  const project = await mutate(PROJECTS_API, "POST", input, "Project created.");
  event.currentTarget.reset();
  await loadProjects(false);
  await selectProject(project.id);
});
$("#node-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = fields(event.currentTarget);
  if (input.category === "world-view") input.category = "context";
  input.data = input.data ? JSON.parse(input.data) : {};
  await mutate(`${projectDetail(state.selectedProject.id)}/nodes`, "POST", input, "Node appended.");
  event.currentTarget.reset();
});
$("#application-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = fields(event.currentTarget);
  input.target ||= null;
  for (const key of ["operands", "results", "worlds", "witnesses"]) input[key] = list(input[key]);
  input.demand = input.demand ? JSON.parse(input.demand) : {};
  input.provenance = input.provenance ? JSON.parse(input.provenance) : {};
  await mutate(`${projectDetail(state.selectedProject.id)}/applications`, "POST", input, "Application fact appended.");
  event.currentTarget.reset();
});
$("#event-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = fields(event.currentTarget);
  const kindMap = { "witness-produced": "witnessed", "external-injected": "injected", "context-invalidated": "invalidated" };
  input.kind = kindMap[input.kind] || input.kind;
  input.predecessor_ids = list(input.predecessor_ids);
  input.application_ids = list(input.application_ids);
  input.intent_id ||= null;
  input.payload = input.note ? { note: input.note } : {};
  delete input.note;
  await mutate(`${projectDetail(state.selectedProject.id)}/events`, "POST", input, "Causal event appended.");
  event.currentTarget.reset();
});
$("#frontier-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await mutate(`${projectDetail(state.selectedProject.id)}/frontier`, "POST", fields(event.currentTarget), "Frontier decision appended.");
  event.currentTarget.reset();
});
$("#world-view-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await mutate(`${projectDetail(state.selectedProject.id)}/world-view`, "PUT", fields(event.currentTarget), "Universe View reference bound; authority grant none.");
  event.currentTarget.reset();
});
$$('[data-mobile-view]').forEach((button) => button.addEventListener("click", () => setMobileView(button.dataset.mobileView)));
document.addEventListener("keydown", (event) => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
  const map = { "1": "catalog", "2": "graph", "3": "history", "4": "facts" };
  if (map[event.key]) setMobileView(map[event.key]);
  if (event.key === "Escape") { state.selectedRecord = null; const raw = $("#raw-record"); if (raw) raw.textContent = "Select an exact record."; }
});

async function boot() {
  try {
    state.session = await request("/v1/live/browser/session");
    const identity = $("#live-identity");
    if (identity) identity.textContent = state.session.profile?.email || "verified Access identity";
    await loadProjects();
    renderAll();
  } catch (error) {
    message(errorMessage(error), true);
    const login = $("#live-login");
    if (login && [401, 403].includes(error.status)) login.hidden = false;
  }
}
boot();
