(function sitePlayground(global) {
"use strict";

function start() {
  const shell = document.querySelector(".demo-shell");
  const list = document.getElementById("example-list");
  const editorMount = document.getElementById("demo-editor");
  const graphMount = document.getElementById("demo-graph");
  const factsMount = document.getElementById("demo-facts");
  const output = document.getElementById("demo-output");
  if (!shell || !list || !editorMount || !graphMount || !factsMount || !output || !global.Idol || !global.GraphView) return;

  const title = document.getElementById("demo-title");
  const capability = document.getElementById("demo-capability");
  const outputLabel = document.getElementById("demo-output-label");
  const observatoryLink = document.getElementById("demo-observatory-link");
  const ideLink = document.getElementById("demo-ide-link");
  const actionButtons = new Map([...document.querySelectorAll("[data-demo-action]")].map((button) => [button.dataset.demoAction, button]));
  const modeButtons = [...document.querySelectorAll("[data-demo-mode]")];

  const state = {
    manifest: null,
    examples: [],
    example: null,
    graph: null,
    explain: null,
    check: null,
    editor: null,
    explorer: null,
    graphView: null,
    request: 0,
    outputKind: "ready",
  };

  function unwrap(value) {
    if (value && typeof value === "object") return value.result ?? value.data ?? value;
    return value;
  }

  function errorText(error) {
    const value = error?.message ?? error?.error ?? error;
    if (typeof value === "string") return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }

  function exactIdentity(value) {
    const candidate = value?.semantic_id ?? value?.identity ?? value?.graph_id ?? value?.id;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (Number.isSafeInteger(candidate)) return String(candidate);
    return null;
  }

  function identityValues(value, values = new Set(), depth = 0) {
    if (depth > 3 || value === null || value === undefined) return values;
    if (typeof value === "string" || Number.isSafeInteger(value)) {
      values.add(String(value));
      return values;
    }
    if (Array.isArray(value)) {
      for (const item of value) identityValues(item, values, depth + 1);
      return values;
    }
    if (typeof value !== "object") return values;
    const keys = [
      "semantic_id", "identity", "graph_id", "id", "relation", "subject",
      "operand", "operands", "result", "results", "projection", "projections",
      "world", "witness", "witnesses", "demand", "target", "from", "to",
    ];
    for (const key of keys) if (Object.hasOwn(value, key)) identityValues(value[key], values, depth + 1);
    return values;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function row(key, value) {
    const node = el("div", "fact-row");
    node.append(el("span", "key", key), el("span", "value", value));
    return node;
  }

  function section(label, rows = [], note = "") {
    const node = el("section", "fact-section");
    node.appendChild(el("h4", "", label));
    for (const [key, value] of rows) node.appendChild(row(key, value));
    if (note) node.appendChild(el("p", "fact-note", note));
    return node;
  }

  function setOutput(label, value, isError = false) {
    state.outputKind = label;
    outputLabel.textContent = label;
    output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    output.classList.toggle("error", isError);
  }

  function setCapability(text, tone = "") {
    capability.textContent = text;
    capability.dataset.tone = tone;
  }

  function setBusy(active, label = "working") {
    for (const [action, button] of actionButtons) {
      if (["analyze", "run", "lower"].includes(action)) button.disabled = active || !state.example?.actions?.includes(action);
    }
    if (active) setCapability(label, "working");
  }

  function setMobileMode(mode) {
    if (!new Set(["source", "graph", "facts"]).has(mode)) return;
    shell.dataset.mobileMode = mode;
    for (const button of modeButtons) {
      const here = button.dataset.demoMode === mode;
      button.classList.toggle("here", here);
      button.setAttribute("aria-pressed", String(here));
    }
  }

  function graphRecords() {
    const graph = state.graph || {};
    return {
      nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph.edges) ? graph.edges : [],
      applications: Array.isArray(graph.applications) ? graph.applications : [],
    };
  }

  function clearTokenHighlights() {
    editorMount.querySelectorAll(".tk.related").forEach((node) => node.classList.remove("related"));
  }

  function highlightTokens(identities) {
    clearTokenHighlights();
    if (!state.graph || !state.editor) return;
    const wanted = new Set([...identities].map(String));
    const bindings = Idol.bindGraph(state.editor.tokens(), state.graph);
    for (const [index, binding] of bindings) {
      const exact = identityValues(binding);
      if ([...wanted].some((identity) => exact.has(identity))) state.editor.elementFor(index)?.classList.add("related");
    }
  }

  function renderExampleFacts(example = state.example) {
    factsMount.replaceChildren();
    if (!example) {
      factsMount.appendChild(el("div", "fact-empty", "Choose an example. Semantic identity is not published until the compiler returns exact token spans and graph records."));
      return;
    }
    const summary = el("div", "fact-summary");
    summary.append(el("h3", "", example.title), el("p", "", example.capability === "compiler-evidence"
      ? "Current-authority executable evidence. Analyze, run, and lower are fresh observations, not cached claims."
      : "Current law projection. Parser, lowering, execution, and machine realization remain unclaimed until the live compiler publishes them."));
    factsMount.appendChild(summary);
    factsMount.appendChild(section("authority", [
      ["repository", example.authority.repository],
      ["commit", example.authority.commit],
      ["source", example.authority.source],
      ["capability", example.capability],
    ]));
    factsMount.appendChild(section("admitted meaning", (example.meaning || []).map((value, index) => [`fact ${index + 1}`, value])));
    factsMount.appendChild(section("explicit refusals", (example.refuses || []).map((value, index) => [`refusal ${index + 1}`, value]),
      "These are authority-projected teaching facts, not browser-owned semantic graph records."));
  }

  function renderAnalysisSummary(document) {
    const records = graphRecords();
    factsMount.replaceChildren();
    const summary = el("div", "fact-summary");
    summary.append(el("h3", "", state.example?.title || "Compiler projection"));
    const published = records.nodes.length > 0;
    summary.append(el("p", "", published
      ? `${records.nodes.length} exact nodes and ${records.edges.length} structural edges were published by the compiler.`
      : "The compiler returned no exact graph records. Lexical highlighting remains a non-semantic preview."));
    factsMount.appendChild(summary);
    factsMount.appendChild(section("observation", [
      ["nodes", records.nodes.length],
      ["structural edges", records.edges.length],
      ["applications", records.applications.length],
      ["check", document?.check?.ok === true ? "pass" : document?.check?.ok === false ? "refused" : "not published"],
    ], published
      ? "Select an exact source token, graph node, or structural edge to inspect one record."
      : "Semantic identity is not published. Spelling, path, token class, and adjacency cannot replace it."));
    if (document?.authority) factsMount.appendChild(section("compiler authority", Object.entries(document.authority).filter(([, value]) => typeof value !== "object").map(([key, value]) => [key, value])));
    if (document?.check?.output) factsMount.appendChild(section("diagnostic", [["output", document.check.output]]));
  }

  function renderNode(node) {
    const id = exactIdentity(node);
    const records = graphRecords();
    factsMount.replaceChildren();
    const summary = el("div", "fact-summary");
    summary.append(el("h3", "", node.name ?? node.label ?? id ?? "exact node"), el("p", "", node.kind ?? node.category ?? "compiler-published semantic identity"));
    factsMount.appendChild(summary);

    const rows = Idol.nodeFacts(node.raw ?? node, state.graph).map(([key, value]) => [key, value]);
    if (id && !rows.some(([key]) => key === "semantic identity")) rows.unshift(["semantic identity", id]);
    factsMount.appendChild(section("exact facts", rows.length ? rows : [["record", JSON.stringify(node.raw ?? node, null, 2)]]));

    if (id) {
      const related = records.edges.filter((edge) => String(edge.from) === id || String(edge.to) === id);
      factsMount.appendChild(section("structural edges", related.map((edge) => [edge.role ?? edge.kind ?? "edge", `${edge.from} → ${edge.to}`]),
        related.length ? "Operation words remain relation identities; these labels are structural roles only." : "No structural edge for this identity was published."));
      highlightTokens(new Set([id]));
      state.graphView.setHighlights({ nodes: [id], edges: related.map((edge) => edge.id) });
    }
  }

  function renderEdge(edge) {
    const raw = edge.raw ?? edge;
    factsMount.replaceChildren();
    const summary = el("div", "fact-summary");
    summary.append(el("h3", "", raw.role ?? raw.kind ?? edge.presentation?.label ?? "structural edge"), el("p", "", "Compiler-published structural correspondence"));
    factsMount.appendChild(summary);
    const rows = Object.entries(raw)
      .filter(([, value]) => value !== undefined && value !== null && typeof value !== "object")
      .map(([key, value]) => [key, value]);
    factsMount.appendChild(section("exact edge", rows.length ? rows : [["record", JSON.stringify(raw, null, 2)]],
      "Edges express structural roles such as relation, subject, operand, result, projection, witness, demand, and target. They never rename operations."));
    const ids = new Set([raw.from, raw.to].filter(Boolean).map(String));
    highlightTokens(ids);
    state.graphView.setHighlights({ nodes: [...ids], edges: raw.id ? [raw.id] : [] });
  }

  async function setGraph(graph, explain, check, document) {
    state.graph = graph && Array.isArray(graph.nodes) ? graph : null;
    state.explain = explain || null;
    state.check = check || null;
    state.explorerData.graph = state.graph;
    state.explorerData.explain = state.explain;
    state.explorer.rebind();
    clearTokenHighlights();
    state.graphView.setHighlights({ nodes: [], edges: [] });
    await state.graphView.setGraph(state.graph || { nodes: [], edges: [], applications: [] });
    renderAnalysisSummary(document || { graph: state.graph, explain: state.explain, check: state.check });
  }

  function resetProjection(message = "Source changed. Analyze again to publish exact semantic identities.") {
    state.request += 1;
    state.graph = null;
    state.explain = null;
    state.check = null;
    state.explorerData.graph = null;
    state.explorerData.explain = null;
    state.explorer.rebind();
    clearTokenHighlights();
    state.graphView.setHighlights({ nodes: [], edges: [] });
    state.graphView.setGraph({ nodes: [], edges: [], applications: [] }).catch(() => {});
    renderExampleFacts();
    setOutput("ready", message);
    setCapability(state.example?.capability === "compiler-evidence" ? "compiler evidence · awaiting fresh observation" : "law projection · implementation unclaimed");
  }

  function updateLinks() {
    if (observatoryLink) observatoryLink.href = "https://graph.idol.id/";
    if (ideLink) ideLink.href = "https://platform.idol.id/ide";
  }

  function updateActions() {
    for (const [action, button] of actionButtons) {
      if (["analyze", "run", "lower"].includes(action)) button.disabled = !state.example?.actions?.includes(action);
    }
  }

  function syncUrl(id) {
    const url = new URL(global.location.href);
    url.searchParams.set("example", id);
    global.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function setExample(example, { updateUrl = true } = {}) {
    if (!example) return;
    state.example = example;
    state.editor.setSource(example.source);
    title.textContent = example.title;
    capability.textContent = example.capability === "compiler-evidence"
      ? "compiler evidence · fresh run required"
      : "law projection · implementation unclaimed";
    capability.dataset.tone = example.capability;
    for (const button of list.querySelectorAll(".example-tab")) {
      const here = button.dataset.exampleId === example.id;
      button.classList.toggle("here", here);
      button.setAttribute("aria-selected", String(here));
      button.tabIndex = here ? 0 : -1;
    }
    updateActions();
    updateLinks();
    resetProjection(example.summary);
    if (updateUrl) syncUrl(example.id);
  }

  async function analyze() {
    if (!state.example?.actions?.includes("analyze")) return;
    const request = ++state.request;
    setBusy(true, "analyzing exact compiler projection");
    setOutput("analyze", "requesting graph, explain, and check from the deployed compiler…");
    try {
      const document = unwrap(await Idol.api.post("/api/analyze", { source: state.editor.source }));
      if (request !== state.request) return;
      await setGraph(document?.graph, document?.explain, document?.check, document);
      const records = graphRecords();
      const ok = records.nodes.length > 0;
      setCapability(ok ? "compiler-published exact graph" : "compiler returned no graph", ok ? "published" : "refused");
      setOutput("analyze", JSON.stringify({
        authority: document?.authority ?? "not published",
        nodes: records.nodes.length,
        structural_edges: records.edges.length,
        applications: records.applications.length,
        check: document?.check ?? "not published",
      }, null, 2), document?.check?.ok === false);
      if (global.matchMedia("(max-width: 760px)").matches) setMobileMode(ok ? "graph" : "facts");
    } catch (error) {
      if (request !== state.request) return;
      await setGraph(null, null, { ok: false, output: errorText(error) }, { check: { ok: false, output: errorText(error) } });
      setCapability("analysis refused", "refused");
      setOutput("analyze", errorText(error), true);
      if (global.matchMedia("(max-width: 760px)").matches) setMobileMode("facts");
    } finally {
      if (request === state.request) setBusy(false);
    }
  }

  async function run() {
    if (!state.example?.actions?.includes("run")) return;
    setBusy(true, "running current source");
    setOutput("run", "executing through the deployed compiler origin…");
    try {
      const document = unwrap(await Idol.api.post("/api/run", { source: state.editor.source, args: [] }));
      const text = [
        `exit ${document?.rc ?? "not published"}`,
        document?.stdout ? `\nstdout\n${document.stdout}` : "",
        document?.stderr ? `\nstderr\n${document.stderr}` : "",
      ].filter(Boolean).join("\n");
      setOutput("run", text || JSON.stringify(document, null, 2), Number(document?.rc || 0) !== 0);
      setCapability(Number(document?.rc || 0) === 0 ? "execution observed" : "execution returned a nonzero result", Number(document?.rc || 0) === 0 ? "published" : "refused");
      if (global.matchMedia("(max-width: 760px)").matches) setMobileMode("facts");
    } catch (error) {
      setOutput("run", errorText(error), true);
      setCapability("execution refused", "refused");
    } finally { setBusy(false); }
  }

  async function lower() {
    if (!state.example?.actions?.includes("lower")) return;
    setBusy(true, "lowering for aarch64-linux");
    setOutput("lower", "requesting an explicit physical realization…");
    try {
      const document = unwrap(await Idol.api.post("/api/lower", {
        source: state.editor.source,
        target: "aarch64-linux",
        emit: "asm",
        opt: "3",
      }));
      const text = document?.text || [document?.stdout, document?.stderr].filter(Boolean).join("\n") || JSON.stringify(document, null, 2);
      setOutput("lower", text, document?.ok === false || Number(document?.rc || 0) !== 0);
      setCapability(document?.ok === false ? "realization refused" : "physical realization observed", document?.ok === false ? "refused" : "published");
      if (global.matchMedia("(max-width: 760px)").matches) setMobileMode("facts");
    } catch (error) {
      setOutput("lower", errorText(error), true);
      setCapability("realization refused", "refused");
    } finally { setBusy(false); }
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(state.editor.source);
      Idol.toast("source copied");
    } catch { Idol.toast("clipboard unavailable", true); }
  }

  function renderExamples() {
    list.replaceChildren();
    for (const example of state.examples) {
      const button = el("button", "example-tab");
      button.type = "button";
      button.dataset.exampleId = example.id;
      button.setAttribute("role", "tab");
      button.append(el("span", "example-title", example.title), el("span", "example-kind", example.capability.replaceAll("-", " ")));
      button.addEventListener("click", () => setExample(example));
      list.appendChild(button);
    }
  }

  state.editor = Idol.editor(editorMount, {
    source: "# loading authority-pinned examples",
    oninput() { resetProjection(); },
    onkeydown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); analyze(); }
      else if (event.shiftKey && event.key === "Enter") { event.preventDefault(); run(); }
    },
  });
  state.explorerData = {
    graph: null,
    explain: null,
    onReveal(binding) {
      const identity = exactIdentity(binding);
      if (identity) state.graphView.selectNode(identity, true);
    },
    onLib(identity) {
      if (identity) global.open(`https://graph.idol.id/?identity=${encodeURIComponent(identity)}`, "_blank", "noopener");
    },
  };
  state.explorer = Idol.explore(state.editor, state.explorerData);
  state.graphView = new GraphView(graphMount, {
    onSelectNode: renderNode,
    onSelectEdge: renderEdge,
  });
  state.graphView.setGraph({ nodes: [], edges: [], applications: [] }).catch(() => {});

  actionButtons.get("analyze")?.addEventListener("click", analyze);
  actionButtons.get("run")?.addEventListener("click", run);
  actionButtons.get("lower")?.addEventListener("click", lower);
  actionButtons.get("reset")?.addEventListener("click", () => setExample(state.example));
  actionButtons.get("copy")?.addEventListener("click", copySource);
  actionButtons.get("fit")?.addEventListener("click", () => state.graphView.fit());
  actionButtons.get("facts")?.addEventListener("click", () => {
    shell.dataset.factsOpen = shell.dataset.factsOpen === "true" ? "false" : "true";
  });
  for (const button of modeButtons) button.addEventListener("click", () => setMobileMode(button.dataset.demoMode));

  Promise.all([
    Idol.api.get("/content/source-examples.json"),
    Idol.api.get("/runtime/source-law.json"),
  ]).then(([manifest, law]) => {
    if (manifest.schema !== "idol.web.source-examples.v2") throw new Error(`unsupported example manifest ${manifest.schema}`);
    state.manifest = manifest;
    state.examples = manifest.examples || [];
    renderExamples();
    const requested = new URL(global.location.href).searchParams.get("example");
    const initial = state.examples.find((example) => example.id === requested) || state.examples[0];
    setExample(initial, { updateUrl: !requested });
    document.getElementById("law-edition").textContent = `${law.source_law.schema} · ${law.source_law.sha256.slice(0, 12)}`;
    document.getElementById("auth-edition").textContent = `law ${law.authority.commit.slice(0, 8)} · web projection`;
    document.getElementById("install-authority").textContent = manifest.authority.commit;
  }).catch((error) => {
    list.replaceChildren(el("div", "fact-empty", `Authority-pinned examples unavailable: ${errorText(error)}`));
    setCapability("example authority refused", "refused");
    setOutput("error", errorText(error), true);
    renderExampleFacts(null);
  });

  Promise.all([
    fetch("/api/libs").then((response) => response.ok ? response.json() : { libs: [] }).catch(() => ({ libs: [] })),
    fetch("/api/worlds").then((response) => response.ok ? response.json() : { worlds: [] }).catch(() => ({ worlds: [] })),
  ]).then(([homeDocument, worldDocument]) => {
    const homes = homeDocument.libs || [];
    const worlds = worldDocument.worlds || [];
    const lines = homes.reduce((sum, value) => sum + Number(value.lines || 0), 0);
    document.getElementById("corpus").replaceChildren(
      Object.assign(el("span"), { innerHTML: `<b class="sig">${worlds.length}</b> published world projections` }),
      Object.assign(el("span"), { innerHTML: `<b>${homes.length}</b> source homes` }),
      Object.assign(el("span"), { innerHTML: `<b>${lines.toLocaleString()}</b> source lines` }),
      el("span", "", "live registry evidence"),
    );
  });

  setMobileMode("source");
  setOutput("ready", "Select an example, inspect the highlighted source, then Analyze to request exact compiler-published token, graph, edge, demand, witness, and realization records.");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
})(window);
