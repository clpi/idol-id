(() => {
  "use strict";

  const API = "/v1/live/browser";
  const state = {
    session: null,
    projects: [],
    project: null,
    graph: null,
    selected: null,
    mobile: "projects",
    lens: "graph",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const text = (value) => String(value ?? "");
  const escapeHtml = (value) => text(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const commaList = (value) => [...new Set(text(value).split(",").map((part) => part.trim()).filter(Boolean))];

  function notice(message, error = false) {
    const node = $("#live-notice");
    if (!node) return;
    node.hidden = !message;
    node.classList.toggle("error", error);
    node.textContent = message || "";
  }

  async function request(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set("accept", "application/json");
    if (init.body !== undefined) {
      headers.set("content-type", "application/json");
      headers.set("x-idol-request", "browser");
    }
    const response = await fetch(`${API}${path}`, { credentials: "same-origin", ...init, headers });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : { detail: await response.text() };
    if (!response.ok) {
      const error = new Error(body.detail || body.error || `request failed (${response.status})`);
      error.code = body.error || "LIVE_REQUEST_FAILED";
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function setMobile(view) {
    state.mobile = view;
    document.body.dataset.mobile = view;
    for (const button of $$("[data-mobile-view]")) {
      const selected = button.dataset.mobileView === view;
      button.classList.toggle("here", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  function setLens(lens) {
    state.lens = lens;
    for (const button of $$("[data-live-lens]")) {
      const selected = button.dataset.liveLens === lens;
      button.classList.toggle("here", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    for (const panel of $$(".live-lens")) panel.classList.toggle("here", panel.id === `live-${lens}-lens`);
  }

  function projectSummary(project) {
    return `<button class="live-project${state.project?.id === project.id ? " here" : ""}" type="button" data-project-id="${escapeHtml(project.id)}">
      <strong>${escapeHtml(project.name)}</strong>
      <code>${escapeHtml(project.slug)} · ${escapeHtml(project.id)}</code>
      <span class="live-muted">${escapeHtml(project.summary || "No summary")}</span>
    </button>`;
  }

  function renderProjects() {
    const list = $("#live-project-list");
    if (!list) return;
    list.innerHTML = state.projects.length ? state.projects.map(projectSummary).join("") : `<div class="live-empty">No projects yet. Create the first causal workspace below.</div>`;
  }

  function recordButton(record, type, label, kind = type) {
    const id = record?.id || `${type}:${label}`;
    return `<button type="button" class="live-record${state.selected?.id === id ? " here" : ""}" data-record-type="${escapeHtml(type)}" data-record-id="${escapeHtml(id)}">
      <span class="kind">${escapeHtml(kind)}</span>
      <span class="label">${escapeHtml(label || id)}</span>
      <span class="id">${escapeHtml(id)}</span>
    </button>`;
  }

  function renderProjectHeader() {
    const title = $("#live-project-title");
    const summary = $("#live-project-summary");
    const exact = $("#live-project-id");
    if (!state.project) {
      title.textContent = "Select a project";
      summary.textContent = "Projects retain one immutable causal history and one accepted frontier. Nothing here grants semantic or world authority.";
      exact.textContent = "semantic identity not published";
      return;
    }
    title.textContent = state.project.name;
    summary.textContent = state.project.summary || "No project summary";
    exact.textContent = `${state.project.id} · ${state.project.slug}`;
  }

  function renderGraph() {
    const graph = state.graph;
    const nodeRoot = $("#live-node-grid");
    const appRoot = $("#live-application-grid");
    const edgeRoot = $("#live-edge-list");
    const counts = {
      nodes: graph?.nodes?.length || 0,
      applications: graph?.applications?.length || 0,
      edges: graph?.edges?.length || 0,
    };
    $("#live-node-count").textContent = `${counts.nodes}`;
    $("#live-application-count").textContent = `${counts.applications}`;
    $("#live-edge-count").textContent = `${counts.edges}`;
    nodeRoot.innerHTML = counts.nodes
      ? graph.nodes.map((node) => recordButton(node, "node", node.label, node.category)).join("")
      : `<div class="live-empty">No nodes have been published to this project graph.</div>`;
    appRoot.innerHTML = counts.applications
      ? graph.applications.map((application) => recordButton(application, "application", application.relation, "application · relation identity")).join("")
      : `<div class="live-empty">No application records. Operations remain relation identities, never edge kinds.</div>`;
    edgeRoot.innerHTML = counts.edges
      ? graph.edges.map((edge) => `<button type="button" class="live-edge" data-record-type="edge" data-record-id="${escapeHtml(edge.id)}">
          <span class="role">${escapeHtml(edge.role)}</span>
          <span class="path">${escapeHtml(edge.source)} → ${escapeHtml(edge.target)}</span>
        </button>`).join("")
      : `<div class="live-empty">Structural edges are derived from application facts; none are present yet.</div>`;
  }

  function renderHistory() {
    const graph = state.graph;
    const events = graph?.history || [];
    const frontier = graph?.frontier?.decisions || [];
    $("#live-event-count").textContent = `${events.length}`;
    $("#live-frontier-count").textContent = `${frontier.length}`;
    $("#live-history-list").innerHTML = events.length
      ? events.map((event) => `<button type="button" class="live-event" data-record-type="event" data-record-id="${escapeHtml(event.id)}">
          <span class="kind">${escapeHtml(event.kind)}</span>
          <span class="meta">${escapeHtml(event.id)}<br>predecessors ${escapeHtml((event.predecessor_ids || []).join(", ") || "none")}</span>
        </button>`).join("")
      : `<div class="live-empty">History is immutable. No events have been appended.</div>`;
    $("#live-frontier-list").innerHTML = frontier.length
      ? frontier.map((decision) => `<button type="button" class="live-frontier-row" data-state="${escapeHtml(decision.state)}" data-record-type="frontier" data-record-id="${escapeHtml(decision.id)}">
          <span class="state">${escapeHtml(decision.state)}</span>
          <span class="meta">${escapeHtml(decision.event_id)} · ${escapeHtml(decision.id)}</span>
        </button>`).join("")
      : `<div class="live-empty">No frontier decisions. Attempts remain visible even before admission.</div>`;
  }

  function findRecord(type, id) {
    const graph = state.graph;
    if (!graph) return null;
    if (type === "project") return state.project;
    if (type === "node") return graph.nodes.find((record) => record.id === id);
    if (type === "application") return graph.applications.find((record) => record.id === id);
    if (type === "edge") return graph.edges.find((record) => record.id === id);
    if (type === "event") return graph.history.find((record) => record.id === id);
    if (type === "frontier") return graph.frontier.decisions.find((record) => record.id === id);
    return null;
  }

  function renderInspector() {
    const root = $("#live-inspector-record");
    const selected = state.selected;
    if (!selected) {
      root.innerHTML = `<div class="live-empty">Select a project, node, application, structural edge, history event, or frontier decision to inspect its exact record.</div>`;
      return;
    }
    const record = findRecord(selected.type, selected.id) || selected.record;
    if (!record) {
      root.innerHTML = `<div class="live-empty">Selected record is no longer in the current projection.</div>`;
      return;
    }
    const relation = selected.type === "application" ? record.relation : "";
    const role = selected.type === "edge" ? record.role : "";
    root.innerHTML = `<div class="live-inspector-card">
      <div class="live-kicker">${escapeHtml(selected.type)}</div>
      <h3>${escapeHtml(record.label || relation || role || record.kind || record.state || record.id)}</h3>
      <dl>
        <dt>identity</dt><dd>${escapeHtml(record.id || "not published")}</dd>
        <dt>semantic id</dt><dd>${escapeHtml(record.semantic_id ?? "not published")}</dd>
        <dt>identity state</dt><dd>${escapeHtml(record.identity_status || "operational record")}</dd>
        ${relation ? `<dt>relation identity</dt><dd>${escapeHtml(relation)}</dd>` : ""}
        ${role ? `<dt>structural role</dt><dd>${escapeHtml(role)}</dd>` : ""}
        <dt>authority</dt><dd>none granted by this view</dd>
      </dl>
      <pre class="live-raw">${escapeHtml(JSON.stringify(record, null, 2))}</pre>
    </div>`;
  }

  function updateFormReferences() {
    const nodes = state.graph?.nodes || [];
    const events = state.graph?.history || [];
    const apps = state.graph?.applications || [];
    for (const list of [$("#live-node-ids"), $("#live-subject-ids"), $("#live-target-ids")]) {
      if (list) list.innerHTML = nodes.map((node) => `<option value="${escapeHtml(node.id)}"></option>`).join("");
    }
    const eventList = $("#live-event-ids");
    if (eventList) eventList.innerHTML = events.map((event) => `<option value="${escapeHtml(event.id)}"></option>`).join("");
    const appList = $("#live-application-ids");
    if (appList) appList.innerHTML = apps.map((application) => `<option value="${escapeHtml(application.id)}"></option>`).join("");
  }

  function renderAll() {
    renderProjects();
    renderProjectHeader();
    renderGraph();
    renderHistory();
    renderInspector();
    updateFormReferences();
    const disabled = !state.project;
    for (const form of $$("[data-project-form]")) for (const control of form.elements) control.disabled = disabled;
  }

  async function loadProjects(selectId = null) {
    const response = await request("/projects");
    state.projects = response.projects || [];
    const requested = selectId || new URL(location.href).searchParams.get("project") || state.project?.id || state.projects[0]?.id;
    renderProjects();
    if (requested) await selectProject(requested);
    else renderAll();
  }

  async function selectProject(id) {
    state.project = await request(`/projects/${encodeURIComponent(id)}`);
    state.graph = await request(`/projects/${encodeURIComponent(id)}/graph`);
    state.selected = { type: "project", id: state.project.id, record: state.project };
    const url = new URL(location.href);
    url.searchParams.set("project", id);
    history.replaceState(null, "", url);
    renderAll();
    if (matchMedia("(max-width: 700px)").matches) setMobile("graph");
  }

  async function refreshProject() {
    if (!state.project) return;
    await selectProject(state.project.id);
  }

  async function submit(form, task) {
    const button = form.querySelector("button[type=submit]");
    if (button) button.disabled = true;
    notice("");
    try {
      await task(new FormData(form));
      form.reset();
      await refreshProject();
    } catch (error) {
      notice(`${error.code || "LIVE_REQUEST_FAILED"}: ${error.message}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindForms() {
    $("#live-project-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(event.currentTarget, async (data) => {
        const created = await request("/projects", { method: "POST", body: JSON.stringify({ name: data.get("name"), slug: data.get("slug"), summary: data.get("summary"), visibility: data.get("visibility") }) });
        await loadProjects(created.id);
      });
    });
    $("#live-node-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(event.currentTarget, (data) => request(`/projects/${state.project.id}/nodes`, { method: "POST", body: JSON.stringify({ category: data.get("category") === "world-view" ? "context" : data.get("category"), label: data.get("label"), summary: data.get("summary"), data: {} }) }));
    });
    $("#live-application-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(event.currentTarget, (data) => request(`/projects/${state.project.id}/applications`, { method: "POST", body: JSON.stringify({ relation: data.get("relation"), subject: data.get("subject"), target: data.get("target") || null, operands: commaList(data.get("operands")), results: commaList(data.get("results")), worlds: commaList(data.get("worlds")), witnesses: commaList(data.get("witnesses")), demand: data.get("demand") ? { fact: data.get("demand") } : {}, provenance: { actor: state.session?.profile?.subject || "browser" } }) }));
    });
    $("#live-event-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(event.currentTarget, (data) => {
        const eventKinds = { "witness-produced": "witnessed", "external-injected": "injected", "context-invalidated": "invalidated" };
        return request(`/projects/${state.project.id}/events`, { method: "POST", body: JSON.stringify({ kind: eventKinds[data.get("kind")] || data.get("kind"), predecessor_ids: commaList(data.get("predecessors")), intent_id: data.get("intent") || null, application_ids: commaList(data.get("applications")), payload: { note: data.get("note") || "" } }) });
      });
    });
    $("#live-frontier-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(event.currentTarget, (data) => request(`/projects/${state.project.id}/frontier`, { method: "POST", body: JSON.stringify({ event_id: data.get("event"), state: data.get("state"), reason: data.get("reason") || "" }) }));
    });
    $("#live-world-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(event.currentTarget, (data) => request(`/projects/${state.project.id}/world-view`, { method: "PUT", body: JSON.stringify({ universe_view_id: data.get("universe_view_id") }) }));
    });
  }

  function bindSelection() {
    document.addEventListener("click", async (event) => {
      const project = event.target.closest("[data-project-id]");
      if (project) {
        try { await selectProject(project.dataset.projectId); } catch (error) { notice(error.message, true); }
        return;
      }
      const record = event.target.closest("[data-record-type][data-record-id]");
      if (record) {
        state.selected = { type: record.dataset.recordType, id: record.dataset.recordId };
        renderGraph();
        renderInspector();
        if (matchMedia("(max-width: 700px)").matches) setMobile("facts");
      }
    });
    for (const button of $$("[data-live-lens]")) button.addEventListener("click", () => setLens(button.dataset.liveLens));
    for (const button of $$("[data-mobile-view]")) button.addEventListener("click", () => setMobile(button.dataset.mobileView));
    document.addEventListener("keydown", (event) => {
      if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
      const modes = { "1": "projects", "2": "graph", "3": "history", "4": "facts" };
      if (modes[event.key]) setMobile(modes[event.key]);
      if (event.key === "g") setLens("graph");
      if (event.key === "h") setLens("history");
      if (event.key === "Escape") setMobile("graph");
    });
  }

  async function boot() {
    Shell.boot("live", { title: "Live", keys: [["1–4", "mobile views"], ["G/H", "graph/history"]] });
    IdolShell.crumbs([{ label: "live" }, { label: "projects" }]);
    bindForms();
    bindSelection();
    setLens("graph");
    setMobile("projects");
    try {
      const session = await request("/session");
      state.session = session;
      const identity = $("#live-identity");
      if (identity) identity.textContent = session.profile?.display_name || session.profile?.email || "verified identity";
      await loadProjects();
    } catch (error) {
      notice(`${error.code || "LIVE_BOOT_FAILED"}: ${error.message}`, true);
      renderAll();
    }
  }

  boot();
})();
