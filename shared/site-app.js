(() => {
  "use strict";

  const state = {
    examples: [],
    example: null,
    source: "",
    graph: null,
    selected: null,
    pending: false,
  };

  const byId = (id) => document.getElementById(id);
  const editor = byId("source-editor");
  const highlight = byId("source-highlight");
  const tabs = byId("example-tabs");
  const shell = document.querySelector(".playground-shell");
  const output = byId("playground-output");
  const graphRecords = byId("graph-records");
  const factRecord = byId("fact-record");
  const status = byId("example-status");
  const sourcePath = byId("source-path");
  const graphCount = byId("graph-count");
  const evidenceKind = byId("evidence-kind");

  function escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function lexicalSegments(source) {
    const segments = [];
    let index = 0;
    while (index < source.length) {
      const start = index;
      const char = source[index];
      if (char === "#") {
        while (index < source.length && source[index] !== "\n") index += 1;
        segments.push({ kind: "comment", text: source.slice(start, index) });
        continue;
      }
      if (char === '"' || char === "'") {
        const quote = char;
        index += 1;
        while (index < source.length) {
          if (source[index] === "\\") { index += 2; continue; }
          const current = source[index++];
          if (current === quote) break;
        }
        segments.push({ kind: "string", text: source.slice(start, index) });
        continue;
      }
      if (/[0-9]/.test(char)) {
        index += 1;
        while (index < source.length && /[0-9._]/.test(source[index])) index += 1;
        segments.push({ kind: "number", text: source.slice(start, index) });
        continue;
      }
      if (/[A-Za-z_]/.test(char)) {
        index += 1;
        while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index += 1;
        segments.push({ kind: "name", text: source.slice(start, index) });
        continue;
      }
      if (/\s/.test(char)) {
        index += 1;
        while (index < source.length && /\s/.test(source[index])) index += 1;
        segments.push({ kind: "space", text: source.slice(start, index) });
        continue;
      }
      index += 1;
      segments.push({ kind: "punct", text: source.slice(start, index) });
    }
    return segments;
  }

  function renderHighlight() {
    highlight.innerHTML = lexicalSegments(state.source)
      .map((segment) => segment.kind === "space"
        ? escape(segment.text)
        : `<span class="lex-${segment.kind}">${escape(segment.text)}</span>`)
      .join("");
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
  }

  function setOutput(label, value, isError = false) {
    evidenceKind.textContent = label;
    output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    output.style.color = isError ? "var(--site-danger)" : "";
  }

  function exactString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  function exactArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeGraph(payload) {
    const candidate = payload?.graph && typeof payload.graph === "object" ? payload.graph : null;
    if (!candidate) return { nodes: [], edges: [], raw: payload };
    const nodes = exactArray(candidate.nodes)
      .filter((node) => node && exactString(node.id))
      .map((node) => Object.freeze({ ...node, id: String(node.id) }));
    const ids = new Set(nodes.map((node) => node.id));
    const edges = exactArray(candidate.edges)
      .filter((edge) => edge && exactString(edge.id) && exactString(edge.from) && exactString(edge.to) && ids.has(String(edge.from)) && ids.has(String(edge.to)))
      .map((edge) => Object.freeze({ ...edge, id: String(edge.id), from: String(edge.from), to: String(edge.to) }));
    return Object.freeze({ nodes, edges, raw: payload });
  }

  function recordLabel(record, fallback) {
    return exactString(record?.name) || exactString(record?.label) || exactString(record?.kind) || fallback;
  }

  function renderFacts(record, kind) {
    state.selected = record || null;
    document.querySelectorAll(".graph-record.selected").forEach((node) => node.classList.remove("selected"));
    if (!record) {
      factRecord.innerHTML = '<p class="empty-state">Select a compiler-published node or edge to inspect its exact record.</p>';
      return;
    }
    const button = document.querySelector(kind === "edge" ? `[data-edge-id="${CSS.escape(record.id)}"]` : `[data-node-id="${CSS.escape(record.id)}"]`);
    button?.classList.add("selected");
    const rows = Object.entries(record).map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(typeof value === "string" ? value : JSON.stringify(value))}</dd></div>`).join("");
    factRecord.innerHTML = `<dl>${rows}</dl>`;
    shell.dataset.view = "evidence";
    document.querySelectorAll("[data-view]").forEach((control) => {
      if (control.closest(".view-switch")) control.setAttribute("aria-pressed", String(control.dataset.view === "evidence"));
    });
  }

  function graphButton(record, kind) {
    const attribute = kind === "edge" ? "data-edge-id" : "data-node-id";
    const secondary = kind === "edge"
      ? `${exactString(record.role) || "structural edge"} · ${record.from} → ${record.to}`
      : exactString(record.kind) || "published node";
    return `<button type="button" class="graph-record" ${attribute}="${escape(record.id)}"><strong>${escape(recordLabel(record, record.id))}</strong><span>${escape(secondary)}</span></button>`;
  }

  function renderGraph() {
    const graph = state.graph;
    if (!graph || (!graph.nodes.length && !graph.edges.length)) {
      graphCount.textContent = "no graph published";
      graphRecords.innerHTML = '<p class="empty-state">The compiler response did not publish graph nodes and structural edges for this source. Nothing is inferred from spelling.</p>';
      renderFacts(null);
      return;
    }
    graphCount.textContent = `${graph.nodes.length} nodes · ${graph.edges.length} edges`;
    graphRecords.innerHTML = `
      <section class="graph-group"><h3>Nodes</h3>${graph.nodes.map((record) => graphButton(record, "node")).join("") || '<p class="empty-state">No nodes published.</p>'}</section>
      <section class="graph-group"><h3>Structural edges</h3>${graph.edges.map((record) => graphButton(record, "edge")).join("") || '<p class="empty-state">No edges published.</p>'}</section>`;
    graphRecords.querySelectorAll("[data-node-id]").forEach((button) => button.addEventListener("click", () => {
      renderFacts(graph.nodes.find((node) => node.id === button.dataset.nodeId), "node");
    }));
    graphRecords.querySelectorAll("[data-edge-id]").forEach((button) => button.addEventListener("click", () => {
      renderFacts(graph.edges.find((edge) => edge.id === button.dataset.edgeId), "edge");
    }));
  }

  function capabilityText(example) {
    if (!example) return "unavailable";
    return example.status === "compiler-executed" ? "compiler executed" : "compiler accepted";
  }

  function selectExample(id) {
    const next = state.examples.find((example) => example.id === id) || state.examples[0];
    if (!next) return;
    state.example = next;
    state.source = String(next.source || "");
    state.graph = null;
    state.selected = null;
    editor.value = state.source;
    sourcePath.textContent = next.authority?.path || next.id;
    status.textContent = capabilityText(next);
    tabs.querySelectorAll("button").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.exampleId === next.id)));
    graphCount.textContent = "not requested";
    graphRecords.innerHTML = '<p class="empty-state">Analyze to request exact nodes, structural edges, source spans, and facts from the compiler.</p>';
    renderFacts(null);
    setOutput("ready", next.summary || "Choose Run, Analyze, or Native.");
    renderHighlight();
  }

  function renderTabs() {
    tabs.replaceChildren();
    for (const example of state.examples) {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "tab";
      button.dataset.exampleId = example.id;
      button.setAttribute("aria-selected", "false");
      button.textContent = example.title;
      button.addEventListener("click", () => selectExample(example.id));
      tabs.appendChild(button);
    }
  }

  function apiError(response, body) {
    const message = body?.error?.message || body?.error || body?.message || `${response.status} ${response.statusText}`;
    return new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  async function request(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-idol-browser": "public-playground" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let value;
    try { value = text ? JSON.parse(text) : {}; }
    catch { value = { text }; }
    if (!response.ok) throw apiError(response, value);
    return value;
  }

  function sourceRequest() {
    return {
      source: state.source,
      path: state.example?.authority?.path || "public-playground.id",
      authority: state.example?.authority?.commit || null,
    };
  }

  async function runAction(action) {
    if (state.pending) return;
    state.pending = true;
    document.querySelectorAll("[data-action]").forEach((button) => { button.disabled = true; });
    setOutput(action, `${action} requested…`);
    try {
      if (action === "run") {
        const value = await request("/api/run", sourceRequest());
        const observed = value.stdout ?? value.output ?? value.result ?? value.text ?? value;
        setOutput("execution", observed);
      } else if (action === "analyze") {
        const value = await request("/api/analyze", sourceRequest());
        state.graph = normalizeGraph(value);
        renderGraph();
        shell.dataset.view = "graph";
        document.querySelectorAll(".view-switch [data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === "graph")));
        setOutput("analysis", value.check?.output || `Published ${state.graph.nodes.length} nodes and ${state.graph.edges.length} structural edges.`);
      } else if (action === "lower") {
        const value = await request("/api/lower", { ...sourceRequest(), target: "native", emit: "asm" });
        setOutput("native lowering", value.text ?? value.output ?? value.asm ?? value);
      }
    } catch (error) {
      setOutput("refused", error.message || String(error), true);
    } finally {
      state.pending = false;
      document.querySelectorAll("[data-action]").forEach((button) => { button.disabled = false; });
    }
  }

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(value);
      const prior = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = prior; }, 1000);
    } catch {
      setOutput("copy refused", "Clipboard permission is unavailable. Select the text manually.", true);
    }
  }

  function bind() {
    editor.addEventListener("input", () => {
      state.source = editor.value;
      state.graph = null;
      renderHighlight();
      graphCount.textContent = "source changed";
    });
    editor.addEventListener("scroll", renderHighlight);
    document.querySelectorAll(".view-switch [data-view]").forEach((button) => button.addEventListener("click", () => {
      shell.dataset.view = button.dataset.view;
      document.querySelectorAll(".view-switch [data-view]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    }));
    document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "reset") selectExample(state.example?.id);
      else if (action === "copy") copyText(state.source, button);
      else runAction(action);
    }));
    document.querySelectorAll("[data-copy-command]").forEach((button) => button.addEventListener("click", () => copyText(button.dataset.copyCommand, button)));
  }

  async function boot() {
    bind();
    try {
      const response = await fetch("/content/source-examples.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`examples unavailable (${response.status})`);
      const manifest = await response.json();
      if (manifest.schema !== "idol.web.compiler-examples.v1" || !Array.isArray(manifest.examples)) throw new Error("invalid compiler example projection");
      state.examples = manifest.examples.filter((example) => ["compiler-executed", "compiler-accepted"].includes(example.status));
      if (!state.examples.length) throw new Error("no compiler-verified public examples");
      renderTabs();
      selectExample(state.examples.find((example) => example.featured)?.id || state.examples[0].id);
      byId("footer-authority").textContent = String(manifest.authority?.commit || "").slice(0, 12);
    } catch (error) {
      status.textContent = "examples unavailable";
      setOutput("unavailable", error.message || String(error), true);
      tabs.innerHTML = '<span class="empty-state">Compiler-verified examples are unavailable.</span>';
    }
  }

  boot();
})();
