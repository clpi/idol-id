/*
 * idol.js — non-authoritative browser presentation for Idol source.
 *
 * This file owns no grammar, keyword table, descriptor table, operator table,
 * declaration analysis, subject inference, semantic identity, or graph
 * resolution. It performs only lossless lexical segmentation for presentation.
 * Exact semantic identities may enter only through compiler-published source
 * spans. Until then every token says: semantic identity not published.
 */
(function (global) {
"use strict";

const PERMANENT_DELIMITERS = new Set(["(", ")", "[", "]", "{", "}", ".", ":", "@"]);
const TOKEN_CLASSES = Object.freeze({
  name: "tk-name",
  number: "tk-num",
  text: "tk-str",
  bytes: "tk-str",
  comment: "tk-com",
  delimiter: "tk-delim",
  symbol: "tk-op",
});

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isNameStart(character) {
  return typeof character === "string" && /[A-Za-z_]/.test(character);
}

function isNameContinue(character) {
  return typeof character === "string" && /[A-Za-z0-9_]/.test(character);
}

function isDigit(character) {
  return typeof character === "string" && character >= "0" && character <= "9";
}

function locate(source, offset) {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function token(source, type, start, end) {
  const position = locate(source, start);
  return Object.freeze({
    t: type,
    cls: type,
    v: source.slice(start, end),
    s: start,
    e: end,
    l: position.line,
    c: position.column,
    source_span: Object.freeze({ start, end }),
    semantic_id: null,
    binding_status: "not-published",
  });
}

function quotedEnd(source, start, quote) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (source[index] === quote) return index + 1;
    if (source[index] === "\n") return index;
    index += 1;
  }
  return source.length;
}

function numberEnd(source, start) {
  let index = start;
  if (source[index] === "0" && /[xX]/.test(source[index + 1] || "")) {
    index += 2;
    while (/[0-9A-Fa-f_]/.test(source[index] || "")) index += 1;
    return index;
  }
  while (/[0-9_]/.test(source[index] || "")) index += 1;
  if (source[index] === "." && isDigit(source[index + 1])) {
    index += 1;
    while (/[0-9_]/.test(source[index] || "")) index += 1;
  }
  if (/[eE]/.test(source[index] || "")) {
    let exponent = index + 1;
    if (/[+-]/.test(source[exponent] || "")) exponent += 1;
    if (isDigit(source[exponent])) {
      index = exponent + 1;
      while (/[0-9_]/.test(source[index] || "")) index += 1;
    }
  }
  return index;
}

/**
 * Losslessly segment visible source without deciding what any spelling means.
 * This is deliberately not a parser and not a closed lexical grammar.
 */
function lex(input) {
  const source = String(input || "");
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (character === "#") {
      let end = index + 1;
      while (end < source.length && source[end] !== "\n") end += 1;
      tokens.push(token(source, "comment", index, end));
      index = end;
      continue;
    }

    if (character === '"') {
      const end = quotedEnd(source, index, character);
      tokens.push(token(source, "text", index, end));
      index = end;
      continue;
    }

    if (character === "'") {
      const end = quotedEnd(source, index, character);
      tokens.push(token(source, "bytes", index, end));
      index = end;
      continue;
    }

    if (isNameStart(character)) {
      let end = index + 1;
      while (isNameContinue(source[end])) end += 1;
      tokens.push(token(source, "name", index, end));
      index = end;
      continue;
    }

    if (isDigit(character) || (character === "." && isDigit(source[index + 1]))) {
      const end = numberEnd(source, index);
      tokens.push(token(source, "number", index, end));
      index = end;
      continue;
    }

    if (PERMANENT_DELIMITERS.has(character)) {
      tokens.push(token(source, "delimiter", index, index + 1));
      index += 1;
      continue;
    }

    let end = index + 1;
    while (
      end < source.length
      && !/\s/.test(source[end])
      && source[end] !== "#"
      && source[end] !== '"'
      && source[end] !== "'"
      && !isNameStart(source[end])
      && !isDigit(source[end])
      && !PERMANENT_DELIMITERS.has(source[end])
    ) end += 1;
    tokens.push(token(source, "symbol", index, end));
    index = end;
  }

  return Object.freeze(tokens);
}

/** Compatibility API: presentation never assigns semantic faces. */
function faces() {
  return new Set();
}
const decls = faces;

function tokenClass(value) {
  if (value.t === "delimiter" && value.v === ":") return "tk-colon";
  if (value.t === "delimiter" && value.v === "@") return "tk-world";
  return TOKEN_CLASSES[value.t] || "tk";
}

function render(tokens, source) {
  let output = "";
  let position = 0;
  tokens.forEach((value, index) => {
    if (value.s > position) output += esc(source.slice(position, value.s));
    output += `<span class="tk ${tokenClass(value)}" data-i="${index}">${esc(value.v)}</span>`;
    position = value.e;
  });
  output += esc(source.slice(position));
  return output;
}

function lexicalNote(value) {
  if (value.t === "comment") return "comment bytes under the selected source law";
  if (value.t === "text") return "double-quoted text bytes";
  if (value.t === "bytes") return "single-quoted byte sequence";
  if (value.t === "number") return "number spelling; range and descriptor facts are not inferred here";
  if (value.t === "name") return "name spelling is provenance, never semantic identity";
  if (value.t === "delimiter") return "delimiter spelling; consult the pinned source-law projection for meaning";
  return "unclassified source symbol; no operator identity is inferred";
}

function lawNote(value, binding) {
  if (binding) {
    return {
      face: "compiler projection",
      note: "exact compiler-published source span and semantic facts",
    };
  }
  return {
    face: "lexical preview",
    note: `${lexicalNote(value)}; semantic identity not published`,
  };
}

function spanOf(candidate) {
  const span = candidate && (candidate.source_span || candidate.span || candidate.provenance?.source_span);
  const start = Number(candidate?.start ?? span?.start);
  const end = Number(candidate?.end ?? span?.end);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) return null;
  return { start, end };
}

function exactTokenCandidates(graph) {
  const collections = [
    graph?.tokens,
    graph?.token_projections,
    graph?.source_tokens,
    graph?.exact_tokens,
  ];
  return collections.find(Array.isArray) || [];
}

/**
 * Bind only exact compiler-published source spans. There is no spelling,
 * line-number, name, kind, nearest-node, or first-match fallback.
 */
function bindGraph(tokens, graph) {
  const candidates = exactTokenCandidates(graph);
  if (!candidates.length) return new Map();

  const bySpan = new Map();
  for (const candidate of candidates) {
    const span = spanOf(candidate);
    if (!span) continue;
    const key = `${span.start}:${span.end}`;
    if (!bySpan.has(key)) bySpan.set(key, []);
    bySpan.get(key).push(candidate);
  }

  const bindings = new Map();
  tokens.forEach((value, index) => {
    const candidatesForSpan = bySpan.get(`${value.s}:${value.e}`) || [];
    if (candidatesForSpan.length === 1) bindings.set(index, candidatesForSpan[0]);
  });
  return bindings;
}

function exactIdentity(value) {
  const candidate = value?.semantic_id ?? value?.identity ?? value?.graph_id ?? value?.id;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  if (Number.isSafeInteger(candidate)) return String(candidate);
  return null;
}

/** Same-spelling lexical occurrences, not semantic references. */
function refsOf(tokens, selected) {
  if (!selected || selected.t !== "name") return [];
  const occurrences = [];
  tokens.forEach((value, index) => {
    if (value.t === "name" && value.v === selected.v) occurrences.push(index);
  });
  return occurrences;
}

function graphCollections(graph) {
  const values = [];
  for (const [name, collection] of Object.entries(graph || {})) {
    if (Array.isArray(collection)) values.push([name, collection]);
  }
  return values;
}

function nodeFacts(binding, graph) {
  const rows = [];
  const identity = exactIdentity(binding);
  if (identity) rows.push(["semantic identity", identity]);

  const span = spanOf(binding);
  if (span) rows.push(["source span", `${span.start}:${span.end}`]);

  for (const key of ["relation", "subject", "operand", "result", "projection", "descriptor", "world", "witness", "demand", "target", "origin", "provenance", "kind", "status"]) {
    const value = binding?.[key];
    if (value !== undefined && value !== null && typeof value !== "object") rows.push([key, String(value)]);
  }

  if (identity) {
    for (const [collectionName, collection] of graphCollections(graph)) {
      const matches = collection.filter((record) => {
        if (!record || typeof record !== "object") return false;
        return Object.values(record).some((value) => String(value) === identity);
      }).length;
      if (matches) rows.push([collectionName, `${matches} exact record${matches === 1 ? "" : "s"}`]);
    }
  }

  return rows;
}

function knowledgeFor(identity, explain) {
  if (!identity || !Array.isArray(explain?.knowledge_snapshot?.entities)) return [];
  return explain.knowledge_snapshot.entities
    .filter((entity) => exactIdentity(entity) === identity)
    .slice(0, 4)
    .map((entity) => ["knowledge", String(entity.knowledge ?? entity.status ?? "published")]);
}

class Popover {
  constructor() {
    this.el = document.createElement("div");
    this.el.className = "popover";
    this.el.style.display = "none";
    document.body.appendChild(this.el);
    this.pinned = false;
    document.addEventListener("mousedown", (event) => {
      if (!this.pinned && !this.el.contains(event.target)) this.hide();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.pinned = false;
        this.hide();
      }
    });
  }

  show(html, x, y, pin) {
    this.el.innerHTML = html;
    this.el.style.display = "block";
    this.pinned = Boolean(pin);
    const bounds = this.el.getBoundingClientRect();
    let left = x + 14;
    let top = y + 16;
    if (left + bounds.width > innerWidth - 12) left = x - bounds.width - 14;
    if (top + bounds.height > innerHeight - 12) top = Math.max(8, y - bounds.height - 12);
    this.el.style.left = `${Math.max(8, left)}px`;
    this.el.style.top = `${Math.max(8, top)}px`;
  }

  hide() {
    this.el.style.display = "none";
  }

  get open() {
    return this.el.style.display !== "none";
  }
}

function popoverBody(value, binding, context = {}) {
  const identity = exactIdentity(binding);
  const note = lawNote(value, binding);
  let html = `<div class="p-title"><span class="lex">${esc(value.v)}</span>`
    + `<span class="kind">${binding ? "compiler projection" : "lexical preview"}</span></div>`;
  html += `<div class="p-law"><span class="face-tag">${esc(note.face)}</span>`
    + `<span class="mono-note">${esc(note.note)}</span></div>`;
  html += `<div class="p-sec"><div class="lbl">provenance</div>`
    + `<div class="kv"><span class="k">exact source span</span><span class="v">${value.s}:${value.e}</span></div>`
    + `<div class="kv"><span class="k">line / column</span><span class="v">${value.l}:${value.c}</span></div>`
    + `</div>`;

  if (binding && context.graph) {
    const rows = [...nodeFacts(binding, context.graph), ...knowledgeFor(identity, context.explain)];
    html += `<div class="p-sec"><div class="lbl">compiler-published facts</div>`
      + rows.map(([key, fact]) => `<div class="kv"><span class="k">${esc(key)}</span><span class="v">${esc(fact)}</span></div>`).join("")
      + `</div>`;
  } else {
    html += `<div class="p-sec"><div class="lbl">semantic boundary</div>`
      + `<div class="fact dim">semantic identity not published; spelling, adjacency, path, and token kind cannot supply it</div></div>`;
  }

  const spelling = refsOf(context.tokens || [], value);
  if (spelling.length > 1) {
    html += `<div class="p-sec"><div class="lbl">same spelling · ${spelling.length}</div>`
      + `<div class="fact dim">presentation occurrences only; not a reference or identity claim</div></div>`;
  }

  html += `<div class="p-actions">`
    + (binding && context.onReveal ? `<button data-act="reveal">reveal exact graph fact</button>` : "")
    + (spelling.length > 1 ? `<button data-act="spelling">flash same spelling</button>` : "")
    + (identity && context.onLib ? `<button data-act="lib">open exact identity</button>` : "")
    + `<button data-act="law">source law</button></div>`;
  return html;
}

function wirePopover(root, tokens, graph, options = {}) {
  const popover = new Popover();
  let bindings = bindGraph(tokens, graph);
  let pinnedIndex = null;

  function show(event, pin) {
    const element = event.target.closest?.(".tk");
    if (!element || !root.contains(element)) return;
    const index = Number(element.dataset.i);
    const value = tokens[index];
    if (!value) return;
    pinnedIndex = pin ? index : pinnedIndex;
    popover.show(popoverBody(value, bindings.get(index) || null, {
      graph,
      explain: options.explain,
      tokens,
      onReveal: options.onReveal,
      onLib: options.onLib,
    }), event.clientX, event.clientY, pin);
  }

  root.addEventListener("mouseover", (event) => {
    if (!popover.pinned) show(event, false);
  });
  root.addEventListener("mouseleave", () => {
    if (!popover.pinned) popover.hide();
  });
  root.addEventListener("click", (event) => {
    if (event.target.closest?.("button")) return;
    const selected = event.target.closest?.(".tk");
    if (!selected || !root.contains(selected)) return;
    root.querySelectorAll(".tk.selected").forEach((element) => element.classList.remove("selected"));
    selected.classList.add("selected");
    show(event, true);
  });

  popover.el.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const value = tokens[pinnedIndex];
    const binding = bindings.get(pinnedIndex);
    if (button.dataset.act === "law") global.open("https://docs.idol.id/law", "_blank");
    if (button.dataset.act === "reveal" && binding && options.onReveal) options.onReveal(binding);
    if (button.dataset.act === "lib" && binding && options.onLib) options.onLib(exactIdentity(binding));
    if (button.dataset.act === "spelling" && value) {
      root.querySelectorAll(".tk.ref-flash").forEach((element) => element.classList.remove("ref-flash"));
      for (const index of refsOf(tokens, value)) root.querySelector(`[data-i="${index}"]`)?.classList.add("ref-flash");
      setTimeout(() => root.querySelectorAll(".tk.ref-flash").forEach((element) => element.classList.remove("ref-flash")), 900);
    }
  });

  return {
    popover,
    rebind(nextGraph = graph) {
      graph = nextGraph;
      bindings = bindGraph(tokens, graph);
      return bindings;
    },
  };
}

function doccode(mount, options = {}) {
  const root = typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!root) throw new TypeError("doccode mount is required");
  root.classList.add("doccode");
  const source = String(options.source || "");
  const tokens = lex(source);
  const pre = document.createElement("pre");
  pre.innerHTML = render(tokens, source);
  if (options.maxH) pre.style.maxHeight = options.maxH;
  root.replaceChildren(pre);
  const wired = wirePopover(root, tokens, options.graph, options);
  return { root, tokens, popover: wired.popover, rebind: wired.rebind };
}

function editor(mount, options = {}) {
  const root = typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!root) throw new TypeError("editor mount is required");
  root.classList.add("editor-wrap");
  root.replaceChildren();

  const box = document.createElement("div");
  box.style.cssText = "position:relative;flex:1;display:flex;min-height:0;";
  const pre = document.createElement("pre");
  pre.className = "codelayer-pre";
  pre.style.cssText = "position:absolute;inset:0;margin:0;padding:14px 18px 60vh 58px;overflow:auto;white-space:pre;z-index:1;user-select:none;font:var(--fs-code)/var(--lh-code) var(--mono);";
  const code = document.createElement("code");
  pre.appendChild(code);
  const input = document.createElement("textarea");
  input.className = "editor-input";
  input.style.cssText = "position:absolute;inset:0;padding:14px 18px 60vh 58px;background:transparent;color:transparent;caret-color:#fff;border:0;outline:0;resize:none;white-space:pre;overflow:auto;z-index:2;font:var(--fs-code)/var(--lh-code) var(--mono);";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocomplete", "off");
  const gutter = document.createElement("div");
  gutter.className = "gutter";
  box.append(pre, input, gutter);
  root.appendChild(box);

  let source = String(options.source || "");
  let tokens = [];

  function paint() {
    tokens = lex(source);
    code.innerHTML = render(tokens, source);
    gutter.innerHTML = Array.from({ length: source.split("\n").length }, (_, index) => index + 1).join("<br>");
    gutter.style.paddingTop = "14px";
  }

  function sync() {
    pre.scrollTop = input.scrollTop;
    pre.scrollLeft = input.scrollLeft;
    gutter.scrollTop = input.scrollTop;
  }

  input.addEventListener("scroll", sync);
  input.addEventListener("input", () => {
    source = input.value;
    paint();
    sync();
    options.oninput?.(source);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const start = input.selectionStart;
      input.setRangeText("  ", start, input.selectionEnd, "end");
      input.dispatchEvent(new Event("input"));
    }
    options.onkeydown?.(event);
  });

  function setSource(next) {
    source = String(next || "");
    input.value = source;
    paint();
  }

  setSource(source);
  return {
    el: root,
    ta: input,
    pre,
    get source() { return source; },
    setSource,
    tokens: () => tokens,
    repaint: paint,
    elementFor: (index) => code.querySelector(`[data-i="${index}"]`),
  };
}

function explore(editorView, data = {}) {
  const popover = new Popover();
  let bindings = bindGraph(editorView.tokens(), data.graph);
  let pinnedIndex = null;

  function selected(event) {
    const element = event.target.closest?.(".tk");
    if (!element || !editorView.pre.contains(element)) return null;
    const index = Number(element.dataset.i);
    return { element, index, value: editorView.tokens()[index] };
  }

  editorView.pre.addEventListener("mouseover", (event) => {
    if (popover.pinned) return;
    const hit = selected(event);
    if (!hit?.value) return;
    popover.show(popoverBody(hit.value, bindings.get(hit.index) || null, {
      graph: data.graph,
      explain: data.explain,
      tokens: editorView.tokens(),
      onReveal: data.onReveal,
      onLib: data.onLib,
    }), event.clientX, event.clientY, false);
  });
  editorView.pre.addEventListener("mouseleave", () => {
    if (!popover.pinned) popover.hide();
  });
  editorView.pre.addEventListener("click", (event) => {
    const hit = selected(event);
    if (!hit?.value) return;
    pinnedIndex = hit.index;
    editorView.pre.querySelectorAll(".tk.selected").forEach((element) => element.classList.remove("selected"));
    hit.element.classList.add("selected");
    popover.show(popoverBody(hit.value, bindings.get(hit.index) || null, {
      graph: data.graph,
      explain: data.explain,
      tokens: editorView.tokens(),
      onReveal: data.onReveal,
      onLib: data.onLib,
    }), event.clientX, event.clientY, true);
  });
  popover.el.addEventListener("click", (event) => {
    const action = event.target.closest("button")?.dataset.act;
    const value = editorView.tokens()[pinnedIndex];
    const binding = bindings.get(pinnedIndex);
    if (action === "law") global.open("https://docs.idol.id/law", "_blank");
    if (action === "reveal" && binding && data.onReveal) data.onReveal(binding);
    if (action === "lib" && binding && data.onLib) data.onLib(exactIdentity(binding));
    if (action === "spelling" && value) {
      for (const index of refsOf(editorView.tokens(), value)) editorView.elementFor(index)?.classList.add("ref-flash");
      setTimeout(() => editorView.pre.querySelectorAll(".tk.ref-flash").forEach((element) => element.classList.remove("ref-flash")), 900);
    }
  });

  return {
    popover,
    rebind() {
      bindings = bindGraph(editorView.tokens(), data.graph);
      return bindings;
    },
  };
}

const api = Object.freeze({
  async get(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || String(response.status));
    return response.json();
  },
  async text(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(String(response.status));
    return response.text();
  },
  async post(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const document = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(document.error || String(response.status));
    return document;
  },
});

function toast(message, error) {
  let wrapper = document.querySelector(".toast-wrap");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "toast-wrap";
    document.body.appendChild(wrapper);
  }
  const item = document.createElement("div");
  item.className = `toast${error ? " err" : ""}`;
  item.textContent = String(message);
  wrapper.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function el(tag, attributes, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes || {})) {
    if (key === "class") element.className = value;
    else if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined) continue;
    element.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return element;
}

function fmtBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

global.Idol = Object.freeze({
  lex,
  render,
  faces,
  decls,
  editor,
  explore,
  doccode,
  bindGraph,
  refsOf,
  lawNote,
  popoverBody,
  nodeFacts,
  knowledgeFor,
  Popover,
  api,
  toast,
  el,
  fmtBytes,
});

})(window);
