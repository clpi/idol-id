Shell.boot("platform", {
  title: "Repository Observatory",
  keys: [["⌘K", "repository"], ["1–4", "lens"], ["S", "scaffold"], ["T", "transform"]],
});
IdolShell.crumbs([{ label: "platform" }, { label: "repositories" }]);

const api = "/v1/repository/browser/";
const state = {
  observations: [],
  scaffolds: [],
  transformations: [],
  selected: null,
  lens: "inventory",
  scaffold: null,
  transformation: null,
  file: 0,
  transformFile: 0,
};
const $ = (id) => document.getElementById(id);
const repo = $("repo");
const historyList = $("history");
const workspace = $("workspace");
const rail = $("rail");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]);
}

async function request(path, init = {}) {
  const response = await fetch(api + path, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-idol-request": "browser",
      ...(init.headers || {}),
    },
  });
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body.detail || body.error || `request answered ${response.status}`);
  return body;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 1800);
}

function setView(view) {
  repo.dataset.mobile = view;
  document.querySelectorAll(".mobile-nav button").forEach((button) => {
    button.classList.toggle("here", button.dataset.view === view);
  });
}

function deepLink(kind, id) {
  window.history.replaceState(null, "", `/repo/${kind}/${encodeURIComponent(id)}`);
}

function selectedIdFromPath() {
  const match = /^\/repo\/(observation|scaffold|transformation)\/([^/]+)\/?$/.exec(location.pathname);
  if (!match) return null;
  try { return { kind: match[1], id: decodeURIComponent(match[2]) }; } catch { return null; }
}

function fmtBytes(value) {
  const bytes = Number(value || 0);
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${(bytes / 1048576).toFixed(1)} MiB`;
}

function renderHistory() {
  historyList.innerHTML = "";
  if (!state.observations.length) {
    historyList.innerHTML = '<div class="empty">No observations yet. Public metadata is fetched only when you submit a repository.</div>';
    return;
  }
  for (const item of state.observations) {
    const button = document.createElement("button");
    button.className = `observation${state.selected?.id === item.id && state.lens !== "transform" ? " here" : ""}`;
    button.innerHTML = `<span class="coord">${escapeHtml(item.coordinate)}</span><span class="meta"><span>${escapeHtml(item.resolved_revision?.slice(0, 12))}</span><span>${item.inventory?.file_count || 0} files</span><span>${escapeHtml(item.created_at?.slice(0, 10))}</span></span>`;
    button.onclick = () => selectObservation(item.id);
    historyList.append(button);
  }
  if (state.transformations.length) {
    const label = document.createElement("div");
    label.className = "history-label";
    label.textContent = "derived previews";
    historyList.append(label);
    for (const item of state.transformations) {
      const button = document.createElement("button");
      button.className = `observation${state.transformation?.id === item.id ? " here" : ""}`;
      button.innerHTML = `<span class="coord">${escapeHtml(item.id)}</span><span class="meta"><span>${escapeHtml(item.status)}</span><span>${item.selected_file_count || 0} files</span><span>${escapeHtml(item.evidence_status)}</span></span>`;
      button.onclick = () => selectTransformation(item.id);
      historyList.append(button);
    }
  }
}

function metric(label, value) {
  return `<div class="metric"><label>${escapeHtml(label)}</label><strong>${escapeHtml(value || "not observed")}</strong></div>`;
}

function row(key, value, mono = false) {
  return `<div class="row"><div class="key">${escapeHtml(key)}</div><div class="value${mono ? " identity" : ""}">${escapeHtml(value || "not observed")}</div></div>`;
}

function chips(values) {
  return `<div class="chips">${(values?.length ? values : ["none observed"])
    .map((value) => `<span class="chip">${escapeHtml(value)}</span>`)
    .join("")}</div>`;
}

function current() {
  return state.selected;
}

function renderRail() {
  if (state.lens === "transform" && state.transformation) {
    const item = state.transformation;
    rail.innerHTML = `
      <div class="factcard"><label>transformation</label><div>${escapeHtml(item.id)}</div></div>
      <div class="factcard"><label>status</label><div>${escapeHtml(item.status)}</div></div>
      <div class="factcard"><label>patch SHA-256</label><div>${escapeHtml(item.patch_sha256 || "not produced")}</div></div>
      <div class="factcard"><label>parent revision</label><div>${escapeHtml(item.parent_world?.revision)}</div></div>
      <div class="factcard"><label>derived identity</label><div>${escapeHtml(item.derived_world?.semantic_id ?? "not published")}</div></div>
      <div class="factcard"><label>evidence</label><div>${escapeHtml(item.evidence?.status || "unexecuted")}</div></div>
      <div class="factcard"><label>execution</label><div>${String(item.executed)}</div></div>
      <div class="factcard"><label>source world mutated</label><div>${String(item.source_world_mutated)}</div></div>
      <div class="factcard"><label>repository write</label><div>${String(item.repository_written)}</div></div>
      <div class="factcard"><label>world publication</label><div>${String(item.world_published)}</div></div>
    `;
    return;
  }
  const item = current();
  if (!item) {
    rail.innerHTML = '<div class="empty">No exact record selected.</div>';
    return;
  }
  rail.innerHTML = `
    <div class="factcard"><label>observation</label><div>${escapeHtml(item.id)}</div></div>
    <div class="factcard"><label>provider coordinate</label><div>${escapeHtml(item.coordinate)}</div></div>
    <div class="factcard"><label>resolved revision</label><div>${escapeHtml(item.resolved_revision)}</div></div>
    <div class="factcard"><label>semantic identity</label><div>${escapeHtml(item.semantic_id ?? "not published")}</div></div>
    <div class="factcard"><label>world authority</label><div>not granted</div></div>
    <div class="factcard"><label>source transfer</label><div>tree metadata only</div></div>
    <div class="factcard"><label>repository mutation</label><div>false</div></div>
  `;
}

function renderInventory(item) {
  const inventory = item.inventory || {};
  return `
    <div class="metric-grid">
      ${metric("resolved revision", item.resolved_revision)}
      ${metric("files", String(inventory.file_count || 0))}
      ${metric("known bytes", fmtBytes(inventory.bytes?.known))}
      ${metric("tree", inventory.truncated ? "truncated / incomplete" : "provider projection complete")}
      ${metric("default branch", item.default_branch)}
      ${metric("requested ref", item.requested_ref)}
    </div>
    <section class="section"><div class="section-head"><h2>Language candidates</h2></div><div style="padding:14px">${chips(Object.entries(inventory.languages || {}).map(([name, files]) => `${name} · ${files}`))}</div></section>
    <section class="section"><div class="section-head"><h2>Build and workflow evidence</h2></div><div class="rows">${row("build systems", (inventory.build_systems || []).map((value) => value.id).join(", "))}${row("test evidence", (inventory.tests || []).join(", "))}${row("benchmark evidence", (inventory.benchmarks || []).join(", "))}${row("CI", (inventory.ci || []).join(", "))}</div></section>
    <section class="section"><div class="section-head"><h2>Observed paths</h2></div><pre>${escapeHtml((inventory.paths || []).join("\n"))}</pre></section>
  `;
}

function renderWorld(item) {
  const world = item.candidate_world || {};
  return `
    <section class="section"><div class="section-head"><h2>Candidate foreign-origin world</h2></div><div class="rows">${row("identity status", world.identity_status)}${row("semantic identity", world.semantic_id ?? "not published", true)}${row("origin", world.origin, true)}${row("repository", item.coordinate, true)}${row("revision", item.resolved_revision, true)}</div></section>
    <section class="section"><div class="section-head"><h2>Uncertainty</h2></div><div style="padding:14px">${chips((world.uncertainty || []).map((value) => typeof value === "string" ? value : (value.fact ? `${value.fact}: ${value.detail}` : JSON.stringify(value))))}</div></section>
    <section class="section boundary"><strong>Authority boundary</strong><p class="muted">This observation describes provider metadata and path evidence. It does not prove declarations, behavior, ownership, effects, compatibility, equivalence, or world authority. Those remain unresolved until source and executed evidence are admitted.</p></section>
  `;
}

function capabilityControls() {
  const all = ["authority", "build", "test", "bench", "ci", "graph"];
  return `<div class="capabilities">${all.map((value) => `<label class="capability"><input type="checkbox" value="${value}" ${["authority", "ci", "graph"].includes(value) ? "checked" : ""}>${value}</label>`).join("")}</div>`;
}

function renderScaffold() {
  if (!state.scaffold) {
    return `<div class="scaffold-controls"><section class="section"><div class="section-head"><h2>Choose projected capabilities</h2></div><div style="padding:15px">${capabilityControls()}<p class="muted" style="margin-top:12px">The result is a review-only patch. It does not create a branch, commit, pull request, or world.</p><div class="actions"><button class="primary" id="generate">Generate preview</button></div></div></section></div>`;
  }
  const scaffold = state.scaffold;
  const files = scaffold.files || [];
  const selected = files[state.file] || files[0];
  return `
    <section class="section boundary"><strong>${escapeHtml(scaffold.status)}</strong><p class="muted">repository_written: ${String(scaffold.repository_written)} · semantic identity: not published</p></section>
    <section class="section"><div class="section-head"><h2>Generated files</h2><span class="spacer"></span><span class="identity">${files.length}</span></div><div class="filetabs">${files.map((file, index) => `<button class="filetab${index === state.file ? " here" : ""}" data-file="${index}">${escapeHtml(file.path)}</button>`).join("")}</div><pre>${escapeHtml(selected?.content || "")}</pre></section>
    <section class="section"><div class="section-head"><h2>Unified patch</h2></div><pre>${escapeHtml(scaffold.patch || "")}</pre></section>
    <div class="actions"><button id="download-patch">Download patch</button><button id="download-json">Download JSON</button><button class="primary" id="open-transform">Project derived preview</button></div>
  `;
}

function transformationFileControls(files) {
  return `<div class="transform-options">${files.map((file) => `<label class="transform-option"><input type="checkbox" value="${escapeHtml(file.path)}" checked><span>${escapeHtml(file.path)}</span></label>`).join("")}</div>`;
}

function evidenceControls() {
  return `<div class="capabilities transform-evidence">${["build", "test", "bench", "graph", "semantic-diff"].map((value) => `<label class="capability"><input type="checkbox" value="${value}" ${["test", "semantic-diff"].includes(value) ? "checked" : ""}>${value}</label>`).join("")}</div>`;
}

function renderTransformation() {
  if (!state.scaffold) {
    return `<section class="section boundary"><strong>Scaffold required</strong><p class="muted">Create or select an exact scaffold preview before projecting a derived world.</p><div class="actions"><button class="primary" id="open-scaffold">Open scaffold</button></div></section>`;
  }
  if (state.scaffold.status !== "preview") {
    return `<section class="section boundary"><strong>Transformation refused</strong><p class="muted">The selected scaffold did not produce a lawful preview. No derived delta can be projected.</p></section>`;
  }
  if (!state.transformation) {
    return `
      <section class="section boundary"><strong>Derived preview only</strong><p class="muted">Select an exact subset of scaffold files. The platform records an isolated delta and unresolved evidence request. It does not execute, mutate the source world, write a repository, or publish a world.</p></section>
      <section class="section"><div class="section-head"><h2>Transformation intent</h2></div><div class="transform-form"><label class="field-label" for="transform-intent">Review intent</label><input id="transform-intent" value="adopt Idol semantic control surface" maxlength="240"><div class="field-label">Selected scaffold files</div><div class="transform-file">${transformationFileControls(state.scaffold.files || [])}</div><div class="field-label">Requested evidence</div>${evidenceControls()}<div class="actions"><button class="primary" id="create-transform">Create derived preview</button></div></div></section>
    `;
  }
  const transformation = state.transformation;
  const files = transformation.files || [];
  const selected = files[state.transformFile] || files[0];
  const grants = (transformation.required_grants || []).map((grant) => `${grant.world}:${grant.capability} · ${grant.status}`);
  return `
    <section class="section boundary"><strong>${escapeHtml(transformation.status)} · non-executing</strong><p class="muted">source_world_mutated: ${String(transformation.source_world_mutated)} · repository_written: ${String(transformation.repository_written)} · world_published: ${String(transformation.world_published)}</p></section>
    <div class="metric-grid">
      ${metric("patch SHA-256", transformation.patch_sha256 || "not produced")}
      ${metric("selected files", String(transformation.selected_files?.length || 0))}
      ${metric("evidence", transformation.evidence?.status || "unexecuted")}
      ${metric("isolation", transformation.derived_world?.isolation)}
      ${metric("parent revision", transformation.parent_world?.revision)}
      ${metric("semantic identity", transformation.semantic_id ?? "not published")}
    </div>
    <section class="section"><div class="section-head"><h2>World separation</h2></div><div class="rows">${row("parent observation", transformation.parent_world?.observation_id, true)}${row("parent scaffold", transformation.derived_world?.parent_scaffold_id, true)}${row("derived identity", transformation.derived_world?.semantic_id ?? "not published", true)}${row("transformation face", transformation.transformation?.face, true)}${row("intent", transformation.intent)}</div></section>
    <section class="section"><div class="section-head"><h2>Required grants</h2></div><div style="padding:14px">${chips(grants)}</div></section>
    <section class="section"><div class="section-head"><h2>Requested evidence</h2></div><div style="padding:14px">${chips(transformation.evidence?.requested || [])}</div></section>
    <section class="section"><div class="section-head"><h2>Selected delta</h2><span class="spacer"></span><span class="identity">${files.length}</span></div><div class="filetabs">${files.map((file, index) => `<button class="filetab${index === state.transformFile ? " here" : ""}" data-transform-file="${index}">${escapeHtml(file.path)}</button>`).join("")}</div><pre>${escapeHtml(selected?.content || "")}</pre></section>
    <section class="section"><div class="section-head"><h2>Deterministic patch</h2></div><pre>${escapeHtml(transformation.patch || "")}</pre></section>
    <div class="actions"><button id="download-transform-patch">Download patch</button><button id="download-transform-json">Download transformation</button></div>
  `;
}

function renderWorkspace() {
  const item = current();
  if (!item) {
    workspace.innerHTML = '<div class="empty">Select or observe a repository.</div>';
    renderRail();
    return;
  }
  const panel = state.lens === "inventory"
    ? renderInventory(item)
    : state.lens === "world"
      ? renderWorld(item)
      : state.lens === "scaffold"
        ? renderScaffold()
        : renderTransformation();
  workspace.innerHTML = `
    <article class="work-inner">
      <div class="kicker"><span class="pill">${escapeHtml(item.provider)}</span><span>exact public revision</span></div>
      <h1 class="title">${escapeHtml(item.namespace)}/${escapeHtml(item.repository)}</h1>
      <p class="lede">${escapeHtml(item.summary || "Public repository metadata and tree evidence resolved to one exact provider revision.")}</p>
      <div class="tabs">
        <button class="tabx${state.lens === "inventory" ? " here" : ""}" data-lens="inventory">Inventory</button>
        <button class="tabx${state.lens === "world" ? " here" : ""}" data-lens="world">Candidate world</button>
        <button class="tabx${state.lens === "scaffold" ? " here" : ""}" data-lens="scaffold">Scaffold</button>
        <button class="tabx${state.lens === "transform" ? " here" : ""}" data-lens="transform">Transform</button>
      </div>
      <div class="panel">${panel}</div>
    </article>
  `;
  workspace.querySelectorAll("[data-lens]").forEach((button) => {
    button.onclick = () => {
      state.lens = button.dataset.lens;
      renderWorkspace();
      if (innerWidth < 700) setView("workspace");
    };
  });
  workspace.querySelectorAll("[data-file]").forEach((button) => {
    button.onclick = () => { state.file = Number(button.dataset.file); renderWorkspace(); };
  });
  workspace.querySelectorAll("[data-transform-file]").forEach((button) => {
    button.onclick = () => { state.transformFile = Number(button.dataset.transformFile); renderWorkspace(); };
  });
  const generate = $("generate");
  if (generate) generate.onclick = generateScaffold;
  const openScaffold = $("open-scaffold");
  if (openScaffold) openScaffold.onclick = () => { state.lens = "scaffold"; renderWorkspace(); };
  const openTransform = $("open-transform");
  if (openTransform) openTransform.onclick = () => { state.lens = "transform"; state.transformation = null; renderWorkspace(); };
  const createTransform = $("create-transform");
  if (createTransform) createTransform.onclick = generateTransformation;
  const patch = $("download-patch");
  if (patch) patch.onclick = () => download(`${item.repository}-idol.patch`, state.scaffold.patch, "text/x-diff");
  const scaffoldJson = $("download-json");
  if (scaffoldJson) scaffoldJson.onclick = () => download(`${item.repository}-idol-scaffold.json`, JSON.stringify(state.scaffold, null, 2), "application/json");
  const transformPatch = $("download-transform-patch");
  if (transformPatch) transformPatch.onclick = () => download(`${item.repository}-idol-transform.patch`, state.transformation.patch, "text/x-diff");
  const transformJson = $("download-transform-json");
  if (transformJson) transformJson.onclick = () => download(`${item.repository}-idol-transformation.json`, JSON.stringify(state.transformation, null, 2), "application/json");
  renderRail();
}

async function selectObservation(id) {
  const item = await request(`observations/${encodeURIComponent(id)}`);
  state.selected = item;
  state.scaffold = null;
  state.transformation = null;
  state.file = 0;
  state.transformFile = 0;
  deepLink("observation", id);
  renderHistory();
  renderWorkspace();
  if (innerWidth < 700) setView("workspace");
}

async function selectScaffold(id) {
  const scaffold = await request(`scaffolds/${encodeURIComponent(id)}`);
  state.scaffold = scaffold;
  state.transformation = null;
  state.file = 0;
  state.transformFile = 0;
  const item = await request(`observations/${encodeURIComponent(scaffold.observation_id)}`);
  state.selected = item;
  state.lens = "scaffold";
  deepLink("scaffold", id);
  renderHistory();
  renderWorkspace();
  if (innerWidth < 700) setView("workspace");
}

async function selectTransformation(id) {
  const transformation = await request(`transformations/${encodeURIComponent(id)}`);
  const scaffold = await request(`scaffolds/${encodeURIComponent(transformation.scaffold_id)}`);
  const item = await request(`observations/${encodeURIComponent(transformation.observation_id)}`);
  state.transformation = transformation;
  state.scaffold = scaffold;
  state.selected = item;
  state.lens = "transform";
  state.file = 0;
  state.transformFile = 0;
  deepLink("transformation", id);
  renderHistory();
  renderWorkspace();
  if (innerWidth < 700) setView("workspace");
}

async function generateScaffold() {
  const capabilities = [...document.querySelectorAll(".capability input:checked")].map((input) => input.value);
  state.scaffold = await request(`observations/${encodeURIComponent(state.selected.id)}/scaffolds`, {
    method: "POST",
    body: JSON.stringify({ capabilities }),
  });
  state.transformation = null;
  state.file = 0;
  state.transformFile = 0;
  deepLink("scaffold", state.scaffold.id);
  renderWorkspace();
  toast("Scaffold preview generated — repository unchanged");
}

async function generateTransformation() {
  const selectedFiles = [...document.querySelectorAll(".transform-file input:checked")].map((input) => input.value);
  const evidence = [...document.querySelectorAll(".transform-evidence input:checked")].map((input) => input.value);
  const intent = $("transform-intent")?.value || "review scaffold projection";
  state.transformation = await request(`scaffolds/${encodeURIComponent(state.scaffold.id)}/transformations`, {
    method: "POST",
    body: JSON.stringify({ intent, selected_files: selectedFiles, evidence }),
  });
  state.transformations = [state.transformation, ...state.transformations.filter((item) => item.id !== state.transformation.id)];
  state.transformFile = 0;
  deepLink("transformation", state.transformation.id);
  renderHistory();
  renderWorkspace();
  toast("Derived-world preview recorded — nothing executed or written");
}

function download(name, content, type) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type }));
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
}

async function load() {
  const [observationResponse, scaffoldResponse, transformationResponse] = await Promise.all([
    request("observations"),
    request("scaffolds"),
    request("transformations"),
  ]);
  state.observations = observationResponse.observations || [];
  state.scaffolds = scaffoldResponse.scaffolds || [];
  state.transformations = transformationResponse.transformations || [];
  renderHistory();
  const deep = selectedIdFromPath();
  if (deep?.kind === "transformation") await selectTransformation(deep.id);
  else if (deep?.kind === "scaffold") await selectScaffold(deep.id);
  else if (deep?.kind === "observation") await selectObservation(deep.id);
  else if (state.observations[0]) await selectObservation(state.observations[0].id);
  else renderWorkspace();
}

$("observe-form").onsubmit = async (event) => {
  event.preventDefault();
  const status = $("observe-status");
  status.textContent = "Resolving exact public revision…";
  try {
    const item = await request("observe", {
      method: "POST",
      body: JSON.stringify({ url: $("repo-url").value, ref: $("repo-ref").value }),
    });
    state.observations.unshift(item);
    status.textContent = "Observed provider metadata and tree facts; no source content or repository write.";
    await selectObservation(item.id);
    toast("Exact revision observed");
  } catch (error) {
    status.textContent = error.message;
  }
};

document.querySelectorAll(".mobile-nav button").forEach((button) => {
  button.onclick = () => setView(button.dataset.view);
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("repo-url").focus();
  }
  if (/[1234]/.test(event.key) && document.activeElement.tagName !== "INPUT") {
    state.lens = ["inventory", "world", "scaffold", "transform"][Number(event.key) - 1];
    renderWorkspace();
  }
  if (event.key.toLowerCase() === "s" && state.selected) {
    state.lens = "scaffold";
    renderWorkspace();
  }
  if (event.key.toLowerCase() === "t" && state.selected) {
    state.lens = "transform";
    renderWorkspace();
  }
});

load().catch((error) => {
  historyList.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  workspace.innerHTML = '<div class="empty">Repository Observatory refused closed.</div>';
});
