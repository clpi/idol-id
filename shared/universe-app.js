const universe = document.getElementById("universe");
const catalogList = document.getElementById("catalog-list");
const catalogCount = document.getElementById("catalog-count");
const catalogSearch = document.getElementById("catalog-search");
const catalogSource = document.getElementById("catalog-source");
const selectionTray = document.getElementById("selection-tray");
const selectionCount = document.getElementById("selection-count");
const analysis = document.getElementById("universe-analysis");
const boundaryList = document.getElementById("boundary-list");
const history = document.getElementById("view-history");
const viewForm = document.getElementById("view-form");
const viewTitle = document.getElementById("view-title");
const viewLens = document.getElementById("view-lens");
const viewVisibility = document.getElementById("view-visibility");
const viewQuery = document.getElementById("view-query");
const policyEvidence = document.getElementById("policy-evidence");
const policyIdentity = document.getElementById("policy-identity");
const policyProjection = document.getElementById("policy-projection");
const publicLink = document.getElementById("public-link");
const mode = document.getElementById("universe-mode");
const heading = document.getElementById("view-heading");
const toastNode = document.getElementById("toast");

const BROWSER_VIEWS = "/v1/universe/browser/views";
const PUBLIC_VIEWS = "/v1/universe/public";
const state = {
  catalogs: [],
  selected: [],
  views: [],
  current: null,
  publicMode: location.hostname === "worlds.idol.id" || window.IDOL_CONFIG?.app === "worlds",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function toast(message) {
  toastNode.textContent = String(message);
  toastNode.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastNode.classList.remove("show"), 2600);
}

async function jsonRequest(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  if (path.startsWith("/v1/universe/browser/")) headers.set("x-idol-request", "browser");
  const response = await fetch(path, { ...init, headers });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) throw new Error(body?.detail || body?.error || `request failed (${response.status})`);
  return body;
}

function publishedCatalog(record) {
  const key = `${record.name}@${record.version}`;
  return Object.freeze({
    source: "published",
    key,
    name: record.name,
    version: record.version,
    summary: record.summary || "Published Idol world projection.",
    graph_id: record.graph_id === undefined || record.graph_id === null ? null : String(record.graph_id),
    tags: Array.isArray(record.tags) ? record.tags : [],
  });
}

function foreignCatalog(record) {
  return Object.freeze({
    source: "foreign",
    key: record.slug,
    name: record.name,
    version: record.version,
    summary: record.summary || "Foreign-origin candidate; semantic identity not published.",
    graph_id: null,
    tags: [record.provenance?.origin?.family, record.provenance?.origin?.ecosystem].filter(Boolean),
  });
}

async function loadCatalogs() {
  const [worlds, foreign] = await Promise.all([
    jsonRequest("/runtime/worlds.json"),
    jsonRequest("/runtime/foreign.json"),
  ]);
  state.catalogs = [
    ...(Array.isArray(worlds.worlds) ? worlds.worlds.map(publishedCatalog) : []),
    ...(Array.isArray(foreign.worlds) ? foreign.worlds.map(foreignCatalog) : []),
  ].sort((left, right) => left.name.localeCompare(right.name) || left.key.localeCompare(right.key));
  renderCatalog();
}

function selectionIdentity(value) {
  return `${value.source}:${value.key}`;
}

function selected(value) {
  const identity = selectionIdentity(value);
  return state.selected.some((candidate) => selectionIdentity(candidate) === identity);
}

function renderCatalog() {
  const query = String(catalogSearch.value || "").trim().toLowerCase();
  const source = catalogSource.value || "all";
  const filtered = state.catalogs.filter((record) => {
    if (source !== "all" && record.source !== source) return false;
    const haystack = [record.source, record.key, record.name, record.version, record.summary, ...record.tags].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });
  catalogCount.textContent = `${filtered.length}`;
  catalogList.innerHTML = filtered.length ? filtered.map((record) => `
    <button class="world-card" type="button" data-world="${escapeHtml(selectionIdentity(record))}" ${selected(record) ? "disabled" : ""}>
      <span class="world-title"><span class="source-dot ${record.source === "foreign" ? "foreign" : ""}"></span>${escapeHtml(record.name)}</span>
      <span class="world-key">${escapeHtml(record.source)} · ${escapeHtml(record.key)}${record.graph_id ? ` · graph ${escapeHtml(record.graph_id)}` : ""}</span>
      <span class="world-summary">${escapeHtml(record.summary)}</span>
    </button>`).join("") : '<div class="empty">No exact world records match this filter.</div>';
  catalogList.querySelectorAll("[data-world]").forEach((button) => {
    button.onclick = () => {
      const record = state.catalogs.find((candidate) => selectionIdentity(candidate) === button.dataset.world);
      if (!record || selected(record) || state.selected.length >= 32) return;
      state.selected.push(Object.freeze({ source: record.source, key: record.key }));
      renderSelection();
      renderCatalog();
      if (innerWidth < 700) setMobile("view");
    };
  });
}

function renderSelection() {
  selectionCount.textContent = `${state.selected.length} / 32`;
  selectionTray.innerHTML = state.selected.length ? state.selected.map((selection) => `
    <span class="selection"><code>${escapeHtml(selection.source)}:${escapeHtml(selection.key)}</code><button type="button" data-remove="${escapeHtml(selectionIdentity(selection))}" aria-label="Remove ${escapeHtml(selection.key)}">×</button></span>
  `).join("") : '<div class="empty">Choose at least one exact world record.</div>';
  selectionTray.querySelectorAll("[data-remove]").forEach((button) => {
    button.onclick = () => {
      state.selected = state.selected.filter((candidate) => selectionIdentity(candidate) !== button.dataset.remove);
      renderSelection();
      renderCatalog();
    };
  });
}

function boundaryRows(view) {
  const boundary = view?.boundary || {
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
  };
  return [
    ["semantic universes", boundary.semantic_universes, "good"],
    ["view kind", boundary.view_kind, "good"],
    ["composition", boundary.composition, "warn"],
    ["reachability", boundary.reachability, "warn"],
    ["compatibility", boundary.compatibility, "warn"],
    ["equivalence", boundary.equivalence, "warn"],
    ["injection", boundary.injection, "warn"],
    ["authority grant", boundary.authority_grant, "good"],
    ["source mutation", String(boundary.source_world_mutation), "good"],
    ["world publication", String(boundary.world_publication), "good"],
  ];
}

function renderBoundary(view) {
  boundaryList.innerHTML = boundaryRows(view).map(([label, value, kind]) => `
    <div class="boundary-row ${kind}"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>
  `).join("");
}

function worldLink(record) {
  if (record.source === "foreign") return `https://worlds.idol.id/world/${encodeURIComponent(record.key)}/integration`;
  return `https://worlds.idol.id/world/${encodeURIComponent(record.name)}`;
}

function renderAnalysis(view) {
  if (!view) {
    analysis.innerHTML = '<div class="empty">Save or open a view to inspect evidence-safe analysis.</div>';
    renderBoundary(null);
    return;
  }
  const facts = view.analysis || {};
  const resolved = Array.isArray(view.resolved) ? view.resolved : [];
  const violations = Array.isArray(facts.violations) ? facts.violations : [];
  const activeLens = viewLens.value || view.lens;
  analysis.innerHTML = `
    <div class="metric-grid">
      <div class="metric"><div class="label">selected</div><div class="value">${Number(facts.selection_count || resolved.length)}</div></div>
      <div class="metric"><div class="label">unpublished identity</div><div class="value">${Number(facts.unpublished_identity_count || 0)}</div></div>
      <div class="metric"><div class="label">unverified projections</div><div class="value">${Number(facts.unverified_projection_count || 0)}</div></div>
      <div class="metric"><div class="label">policy refusals</div><div class="value">${Number(facts.violation_count || 0)}</div></div>
    </div>
    <section class="section"><h3>${escapeHtml(activeLens)} lens</h3><div class="facts">${(facts.vocabulary || []).map((fact) => `<span class="fact">${escapeHtml(fact)}</span>`).join("") || '<span class="fact">no published vocabulary</span>'}</div></section>
    <section class="section"><h3>Exact world records</h3><div class="resolved-list">${resolved.map((record) => `
      <a class="resolved" href="${worldLink(record)}"><strong>${escapeHtml(record.name)} · ${escapeHtml(record.version)}</strong><code>${escapeHtml(record.source)}:${escapeHtml(record.key)} · identity ${escapeHtml(record.identity_status)}${record.graph_id ? ` · graph ${escapeHtml(record.graph_id)}` : ""}</code></a>
    `).join("") || '<div class="empty">Resolved records are not published in this projection.</div>'}</div></section>
    <section class="section"><h3>Exact refusals</h3><div class="violation-list">${violations.map((entry) => `<div class="violation"><strong>${escapeHtml(entry.code)}</strong><code>${escapeHtml(entry.source)}:${escapeHtml(entry.key)}</code></div>`).join("") || '<div class="resolved"><strong>No selected policy refused this view.</strong><code>This is not evidence of compatibility, composition, or authority.</code></div>'}</div></section>
  `;
  renderBoundary(view);
}

function fillView(view) {
  state.current = view;
  state.selected = (view.selections || []).map((selection) => Object.freeze({ source: selection.source, key: selection.key }));
  viewTitle.value = view.title || "";
  viewLens.value = view.lens || "constellation";
  viewVisibility.value = view.visibility || "private";
  viewQuery.value = view.query || "";
  policyEvidence.checked = Boolean(view.policy?.require_evidence);
  policyIdentity.checked = Boolean(view.policy?.deny_unpublished_identity);
  policyProjection.checked = Boolean(view.policy?.deny_unverified_projection);
  heading.textContent = view.title || "Universe View";
  publicLink.hidden = view.visibility !== "public";
  if (!publicLink.hidden) {
    publicLink.href = `https://worlds.idol.id/universe/${encodeURIComponent(view.id)}`;
    publicLink.textContent = `worlds.idol.id/universe/${view.id}`;
  }
  document.querySelectorAll("[data-lens]").forEach((button) => button.classList.toggle("here", button.dataset.lens === viewLens.value));
  renderSelection();
  renderCatalog();
  renderAnalysis(view);
}

function clearView() {
  state.current = null;
  state.selected = [];
  viewForm.reset();
  viewLens.value = "constellation";
  viewVisibility.value = "private";
  heading.textContent = "New constellation";
  publicLink.hidden = true;
  renderSelection();
  renderCatalog();
  renderAnalysis(null);
}

function inputDocument() {
  return {
    title: viewTitle.value,
    visibility: viewVisibility.value,
    lens: viewLens.value,
    query: viewQuery.value,
    policy: {
      require_evidence: policyEvidence.checked,
      deny_unpublished_identity: policyIdentity.checked,
      deny_unverified_projection: policyProjection.checked,
    },
    selections: state.selected,
  };
}

async function saveView(event) {
  event.preventDefault();
  if (!state.selected.length) return toast("Select at least one exact world record.");
  const path = state.current ? `${BROWSER_VIEWS}/${encodeURIComponent(state.current.id)}` : BROWSER_VIEWS;
  const method = state.current ? "PATCH" : "POST";
  const view = await jsonRequest(path, { method, body: JSON.stringify(inputDocument()) });
  fillView(view);
  await loadHistory();
  toast(view.visibility === "public" ? "Public read-only projection saved." : "Private Universe View saved.");
}

async function loadHistory() {
  if (state.publicMode) {
    const body = await jsonRequest(PUBLIC_VIEWS);
    state.views = body.views || [];
  } else {
    const body = await jsonRequest(BROWSER_VIEWS);
    state.views = body.views || [];
  }
  history.innerHTML = state.views.length ? state.views.map((view) => `
    <button type="button" class="history-card ${view.id === state.current?.id ? "here" : ""}" data-view-id="${escapeHtml(view.id)}">
      <span class="history-title">${escapeHtml(view.title)}</span><span class="history-meta">${escapeHtml(view.visibility)} · ${escapeHtml(view.lens)} · ${Number(view.selection_count || 0)} worlds · ${Number(view.violation_count || 0)} refusals</span>
    </button>`).join("") : `<div class="empty">${state.publicMode ? "No public Universe Views have been published." : "No saved Universe Views."}</div>`;
  history.querySelectorAll("[data-view-id]").forEach((button) => {
    button.onclick = () => openView(button.dataset.viewId);
  });
}

async function openView(id) {
  const view = state.publicMode
    ? await jsonRequest(`${PUBLIC_VIEWS}/${encodeURIComponent(id)}`)
    : await jsonRequest(`${BROWSER_VIEWS}/${encodeURIComponent(id)}`);
  fillView(view);
  history.querySelectorAll("[data-view-id]").forEach((button) => button.classList.toggle("here", button.dataset.viewId === id));
  if (!state.publicMode) history.replaceChildren(...history.childNodes);
  if (innerWidth < 700) setMobile("view");
}

function publicIdFromPath() {
  const match = /^\/universe\/([^/]+)\/?$/.exec(location.pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

function setMobile(value) {
  universe.dataset.mobile = value;
  document.querySelectorAll(".mobile-nav [data-view]").forEach((button) => button.classList.toggle("here", button.dataset.view === value));
}

function installInteractions() {
  catalogSearch.addEventListener("input", renderCatalog);
  catalogSource.addEventListener("change", renderCatalog);
  viewForm.addEventListener("submit", saveView);
  document.getElementById("new-view").onclick = clearView;
  document.querySelectorAll("[data-lens]").forEach((button) => {
    button.onclick = () => {
      viewLens.value = button.dataset.lens;
      document.querySelectorAll("[data-lens]").forEach((candidate) => candidate.classList.toggle("here", candidate === button));
      if (state.current) renderAnalysis({ ...state.current, lens: button.dataset.lens });
    };
  });
  document.querySelectorAll(".mobile-nav [data-view]").forEach((button) => button.onclick = () => setMobile(button.dataset.view));
}

async function boot() {
  Shell.boot("universe", { title: "Universe Views", keys: [["⌘K", "catalog"], ["1–4", "surface"], ["S", "save"]] });
  IdolShell.crumbs([{ label: state.publicMode ? "worlds" : "platform" }, { label: "universe" }]);
  mode.textContent = state.publicMode ? "public · read-only" : "private/public · Access";
  mode.classList.add("live");
  installInteractions();
  renderBoundary(null);
  try {
    await loadCatalogs();
    await loadHistory();
    const publicId = state.publicMode ? publicIdFromPath() : null;
    if (publicId) await openView(publicId);
    else if (!state.publicMode && state.views[0]) await openView(state.views[0].id);
    else clearView();
    if (state.publicMode) {
      viewForm.hidden = true;
      catalogSearch.placeholder = "Search immutable world records";
      if (!publicId) heading.textContent = "Public Universe Views";
    }
  } catch (error) {
    toast(error.message);
    analysis.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

boot();
