/* ============================================================================
   idol.js — Idol language surface for the web
   Lexer (closed lexical grammar) · highlighter · editor · token explorer ·
   graph binding · API client. Vanilla, no dependencies.

   Law anchors follow the supreme law (docs/spec/law.md upstream):
   () application · [] computed projection · {} structure · . one static
   projection · : subject relation · @ current world.
   ========================================================================== */
(function (global) {
"use strict";

/* ------------------------------------------------------------------ lexicon */

const KW = new Set([
  // Lua foundation
  "and","break","continue","do","else","elseif","end","false","for","function",
  "fun","global","goto","if","in","local","nil","not","or","repeat","return",
  "then","true","until","while",
  // descriptors
  "const","enum","i8","i16","i32","i64","u8","u16","u32","u64","f32","f64",
  "bool","void","str",
]);
const CTX = new Set([ // contextual — may still bind as a name
  "match","try","catch","defer","async","await","concept","alias","private",
  "extends","macro","comptime","by","let",
]);
const TYPES = new Set(["i8","i16","i32","i64","u8","u16","u32","u64","f32",
  "f64","bool","void","str","enum","const"]);

const LAW = {
  "(":   ["application", "() ordinary relation application · grouping · operand/result boundaries"],
  ")":   ["application", "closes an application or group"],
  "[":   ["projection", "[] computed or indexed projection"],
  "]":   ["projection", "closes a computed projection"],
  "{":   ["structure", "{} structured pack · table · descriptor structure"],
  "}":   ["structure", "closes a structure"],
  ".":   ["projection", ". exactly one static projection — never dynamic search · x.r is projection, not subject"],
  ":":   ["relation", ": subject-oriented relation · declaration-side specialization (x:r = …, x:r(kg) = …)"],
  "@":   ["world", "@ current world · access · injection · qualification"],
  "=":   ["binding", "introduces or replaces a binding"],
  "==":  ["law", "identity comparison"],
  ",":   ["pack", "operand/pack separator — exact role correspondence"],
};

/* law faces for identifiers — the highlighter teaches the delimiter law */
const FACE_NOTE = {
  call:    "name applied — relation application face",
  subject: "subject face — the semantic role after : (not argument zero)",
  member:  "static projection member — x.name, no subject implied",
  decl:    "binding introduced here — spelling is provenance, identity is the graph",
  param:   "callable operand — ordinary runtime data, not a specialization axis",
  type:    "descriptor — one descriptor system, no parallel type kingdom",
};

function lawNote(tok) {
  if (LAW[tok.v]) return { face: LAW[tok.v][0], note: LAW[tok.v][1] };
  if (tok.f && FACE_NOTE[tok.f]) return { face: tok.f, note: FACE_NOTE[tok.f] };
  if (tok.t === "kw") return { face: "grammar", note: "grammar keyword of the one source law" };
  if (tok.t === "type") return { face: "descriptor", note: FACE_NOTE.type };
  if (tok.t === "ctx") return { face: "grammar", note: "contextual keyword — lawful as a binding name too" };
  if (tok.t === "str") return { face: "value", note: "text value; exact bytes are provenance" };
  if (tok.t === "num") return { face: "value", note: "number value; range facts qualify the graph id" };
  if (tok.t === "com") return { face: "provenance", note: "comment — source bytes, never semantics" };
  if (tok.t === "name") return { face: "provenance", note: "spelling is provenance; identity is the graph id" };
  return { face: "grammar", note: "operator" };
}

/* ------------------------------------------------------------------- lexer */

// Token: {t, v, s, e, l, c}  type value start end line col (1-based)
function lex(src) {
  const T = [];
  const n = src.length;
  let i = 0, l = 1, c = 1;
  const push = (t, s, e) => T.push({ t, v: src.slice(s, e), s, e, l: lineOf(src, s), c: colOf(src, s) });
  // incremental line/col cache
  let lastIdx = 0, lastLine = 1, lastCol = 1;
  function lineOf(s, x) { return s; }
  function colOf(s, x) { return s; }
  // We'll compute line/col after, cheaply, in one pass.
  function tok(t, s, e) { T.push({ t, v: src.slice(s, e), s, e }); }

  const isIdStart = (ch) => /[A-Za-z_]/.test(ch);
  const isId = (ch) => /[A-Za-z0-9_]/.test(ch);
  const isD = (ch) => ch >= "0" && ch <= "9";

  while (i < n) {
    const ch = src[i];
    // whitespace
    if (ch === "\n") { i++; tok("nl", i - 1, i); continue; }
    if (ch === " " || ch === "\t" || ch === "\r") { i++; continue; }
    // long comment --[[ ... ]] (with = levels)
    if (ch === "-" && src[i + 1] === "-") {
      if (src[i + 2] === "[") {
        const m = /^--\[(=*)\[/.exec(src.slice(i, i + 100));
        if (m) {
          const close = "]" + m[1] + "]";
          let j = i + m[0].length, depth = 1;
          const end = src.indexOf(close, j);
          j = end === -1 ? n : end + close.length;
          tok("com", i, j); i = j; continue;
        }
      }
      let j = i + 2;
      while (j < n && src[j] !== "\n") j++;
      tok("com", i, j); i = j; continue;
    }
    // long string [[ ]]
    if (ch === "[") {
      const m = /^\[(=*)\[/.exec(src.slice(i, i + 100));
      if (m) {
        const close = "]" + m[1] + "]";
        const end = src.indexOf(close, i + m[0].length);
        const j = end === -1 ? n : end + close.length;
        tok("str", i, j); i = j; continue;
      }
    }
    // quoted strings
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === ch || src[j] === "\n") { j++; break; }
        j++;
      }
      tok("str", i, Math.min(j, n)); i = Math.min(j, n); continue;
    }
    // numbers
    if (isD(ch) || (ch === "." && isD(src[i + 1]))) {
      let j = i;
      if (ch === "0" && (src[i + 1] === "x" || src[i + 1] === "X")) {
        j = i + 2;
        while (j < n && /[0-9a-fA-F_]/.test(src[j])) j++;
      } else {
        while (j < n && (isD(src[j]) || src[j] === "_")) j++;
        if (src[j] === ".") { j++; while (j < n && (isD(src[j]) || src[j] === "_")) j++; }
        if (src[j] === "e" || src[j] === "E") {
          let k = j + 1;
          if (src[k] === "+" || src[k] === "-") k++;
          if (isD(src[k])) { j = k; while (j < n && isD(src[j])) j++; }
        }
      }
      tok("num", i, j); i = j; continue;
    }
    // names / keywords / world directives
    if (isIdStart(ch)) {
      let j = i;
      while (j < n && isId(src[j])) j++;
      const v = src.slice(i, j);
      if (KW.has(v)) tok(v === "true" || v === "false" || v === "nil" ? "lit" : "kw", i, j);
      else if (TYPES.has(v)) tok("type", i, j);
      else if (CTX.has(v)) tok("ctx", i, j);
      else tok("name", i, j);
      i = j; continue;
    }
    // world sigil / directive: @name
    if (ch === "@") {
      let j = i + 1;
      while (j < n && isId(src[j])) j++;
      tok(j > i + 1 ? "direct" : "world", i, j); i = j; continue;
    }
    // multi-char operators
    const three = src.substr(i, 3);
    const two = src.substr(i, 2);
    if (three === "...") { tok("op", i, i + 3); i += 3; continue; }
    if (["==","~=","<=",">=","..","::","->","+=","-=","*=","/=","%="].includes(two)) {
      tok(two === ".." ? "op" : (two === "::" ? "delim" : "op"), i, i + 2); i += 2; continue;
    }
    if ("+-*/%^#<>=~".includes(ch)) { tok("op", i, i + 1); i++; continue; }
    if ("()[]{}.:,;".includes(ch)) { tok("delim", i, i + 1); i++; continue; }
    // anything else — single char
    tok("op", i, i + 1); i++;
  }

  // annotate line/col (1-based) in one pass
  let line = 1, col = 1;
  for (const t of T) {
    t.l = line; t.c = col;
    for (let k = t.s; k < t.e; k++) {
      if (src[k] === "\n") { line++; col = 1; } else col++;
    }
  }
  // drop newline markers (kept above only to advance line/col)
  const out = [];
  for (const t of T) {
    if (t.t === "nl") continue;
    t.cls = t.t; out.push(t);
  }
  return out;
}

/* -------------------------------------------------------------- faces */

/**
 * Contextual face pass — the highlighter teaches the source law.
 * Faces: call · subject · member · decl · param. Purely derived from
 * token neighborhoods; conservative, never a second parser.
 */
function faces(tokens) {
  const d = new Set(); // decl indices (kept for compatibility)
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const pv = tokens[i - 1], nx = tokens[i + 1];
    if (t.t === "name" || t.t === "ctx") {
      // declaration: name = / name(…)(…) = / name: r = subject-specialized decl
      if (nx && nx.v === "=" && (nx.t === "op" || nx.t === "delim")) { t.f = "decl"; d.add(i); }
      // subject face in declaration or call: `name:` before a relation name
      else if (nx && nx.v === ":" && nx.t === "delim") {
        const after = tokens[i + 2];
        // `x:r` — x is the subject (call face or declaration face)
        if (after && (after.t === "name" || after.t === "ctx" || after.t === "kw")) {
          t.f = "subject"; d.add(i);
        }
      }
      // member: after `.`
      else if (pv && pv.v === "." && pv.t === "delim") t.f = "member";
      // call: name directly before `(`
      else if (nx && nx.v === "(" && nx.t === "delim") {
        t.f = "call";
        // `x:r(…)` — r after `:` is the relation being applied
        if (pv && pv.v === ":" && pv.t === "delim") t.f = "call";
      }
    }
  }
  // params: names inside the `(` group of a callable decl or fn keyword
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].v !== "(" || tokens[i].t !== "delim") continue;
    const prev = tokens[i - 1];
    const opens =
      (prev && ((prev.f === "decl") || (prev.f === "call" && prev.f !== undefined && tokens[i - 2] && tokens[i - 2].v === "="))) ||
      (prev && prev.t === "kw" && (prev.v === "fun" || prev.v === "function")) ||
      (prev && prev.v === "=" );
    if (!opens) continue;
    let depth = 0, j = i;
    for (; j < tokens.length; j++) {
      const tk = tokens[j];
      if (tk.v === "(" && tk.t === "delim") depth++;
      else if (tk.v === ")" && tk.t === "delim") { depth--; if (!depth) break; }
      else if ((tk.t === "name" || tk.t === "ctx") && !tk.f) {
        const nx2 = tokens[j + 1];
        if (nx2 && (nx2.v === "," || nx2.v === ")" || (nx2.v === ":" && nx2.t === "delim"))) {
          tk.f = "param"; d.add(j);
        }
      }
    }
  }
  return d;
}

const CLS = {
  kw: "tk-kw", lit: "tk-kw", type: "tk-type", ctx: "tk-ctx", str: "tk-str",
  num: "tk-num", com: "tk-com", op: "tk-op", delim: "tk-delim",
  world: "tk-world", direct: "tk-direct", name: "tk-name",
  call: "tk-fn", subject: "tk-subject", member: "tk-member",
  decl: "tk-decl", param: "tk-param",
};

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** class of a token: face overrides base when present */
function tcls(t) {
  if (t.f && CLS[t.f]) return CLS[t.f];
  return CLS[t.t] || "tk";
}

/** Render tokens to HTML with per-token data-i hooks. */
function render(tokens, src, opts) {
  opts = opts || {};
  let html = "";
  let pos = 0;
  tokens.forEach((t, i) => {
    if (t.s > pos) html += esc(src.slice(pos, t.s));
    // delimiter law coloring: : and @ are the semantic orientation faces
    let cls = tcls(t);
    if (t.t === "delim" && t.v === ":") cls = "tk-colon";
    html += `<span class="tk ${cls}" data-i="${i}">${esc(t.v)}</span>`;
    pos = t.e;
  });
  html += esc(src.slice(pos));
  return html;
}

/* compatibility: decls() is now faces() */
const decls = faces;

/* ----------------------------------------------------- static code views */

/**
 * Read-only hoverable code block: highlight + token popover, no editor.
 * mount: element to fill. opts: {source, graph, explain, maxH}
 */
function doccode(mount, opts) {
  opts = opts || {};
  const root = typeof mount === "string" ? document.querySelector(mount) : mount;
  root.classList.add("doccode");
  const src = opts.source || "";
  const tokens = lex(src);
  faces(tokens);
  const pre = document.createElement("pre");
  pre.innerHTML = render(tokens, src);
  if (opts.maxH) pre.style.maxHeight = opts.maxH;
  root.innerHTML = "";
  root.appendChild(pre);

  const ctx = {
    graph: opts.graph, explain: opts.explain, tokens,
    onReveal: opts.onReveal, onLib: opts.onLib,
  };
  const pop = new Popover();
  const bindCache = bindGraph(tokens, opts.graph);

  root.addEventListener("mouseover", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.classList.contains("tk")) return;
    if (pop.pinned) return;
    const tok = tokens[+el.dataset.i];
    if (!tok) return;
    pop.show(popoverBody(tok, bindCache.get(+el.dataset.i) || null, ctx), e.clientX, e.clientY, false);
  });
  root.addEventListener("mouseleave", () => { if (!pop.pinned) pop.hide(); });
  root.addEventListener("click", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.classList.contains("tk")) return;
    if (e.target.closest("button")) return;
    const tok = tokens[+el.dataset.i];
    if (!tok) return;
    pop.show(popoverBody(tok, bindCache.get(+el.dataset.i) || null, ctx), e.clientX, e.clientY, true);
    fetchWhysInto(pop, tok.v);
  });
  pop.el.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.act === "law") global.open("https://docs.idol.id/law", "_blank");
    if (btn.dataset.act === "lib" && opts.onLib) {
      const lex = pop.el.querySelector(".lex");
      if (lex) opts.onLib(lex.textContent);
      pop.pinned = false; pop.hide();
    }
  });
  return { root, tokens, popover: pop };
}

/* --------------------------------------------------------------- editor */

/**
 * Dual-layer editor: textarea for input, <pre> behind for faces.
 * Emits: oninput(source), onTokenHover(tok, el, ev), onTokenClick(tok, el, ev).
 */
function editor(mount, opts) {
  opts = opts || {};
  const root = typeof mount === "string" ? document.querySelector(mount) : mount;
  root.classList.add("editor-wrap");
  root.innerHTML = "";

  const box = document.createElement("div");
  box.style.cssText = "position:relative;flex:1;display:flex;min-height:0;";

  const pre = document.createElement("pre");
  pre.className = "codelayer-pre";
  pre.style.cssText = [
    "position:absolute;inset:0;margin:0;padding:14px 18px 60vh 58px",
    "overflow:auto;white-space:pre;z-index:1;user-select:none;-webkit-user-select:none",
    "font:var(--fs-code)/var(--lh-code) var(--mono);pointer-events:auto;cursor:text",
  ].join(";");
  const preIn = document.createElement("code");

  const ta = document.createElement("textarea");
  ta.className = "editor-input";
  ta.style.cssText = [
    "position:absolute;setSelectionColor:none;padding:14px 18px 60vh 58px",
    "background:transparent;color:transparent;caret-color:#fff;border:0;outline:0;resize:none",
    "white-space:pre;overflow:auto;z-index:2;pointer-events:none",
    "font:var(--fs-code)/var(--lh-code) var(--mono)",
  ].join(";").replace("setSelectionColor:none;", "");
  ta.spellcheck = false;
  ta.setAttribute("autocapitalize", "off");
  ta.setAttribute("autocomplete", "off");

  const selStyle = document.createElement("style");
  selStyle.textContent = ".editor-input::selection{background:rgba(255,255,255,0.14)}";
  root.appendChild(selStyle);

  const gut = document.createElement("div");
  gut.className = "gutter";

  box.appendChild(pre); box.appendChild(ta); box.appendChild(gut);
  root.appendChild(box);

  let tokens = [], src = opts.source || "";
  let hoverTok = null;

  function paint() {
    tokens = lex(src);
    faces(tokens);                 // sets t.f — render() picks faces up
    preIn.innerHTML = render(tokens, src);
    pre.appendChild(preIn);
    const lines = src.split("\n").length;
    gut.innerHTML = Array.from({ length: lines }, (_, k) => k + 1).join("<br>");
    gut.style.paddingTop = "14px";
  }

  function sync() { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; }
  ta.addEventListener("scroll", sync);

  ta.addEventListener("input", () => {
    src = ta.value;
    paint(); sync();
    opts.oninput && opts.oninput(src);
  });

  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = ta.selectionStart, epos = ta.selectionEnd;
      ta.setRangeText("  ", s, epos, "end");
      ta.dispatchEvent(new Event("input"));
    }
    opts.onkeydown && opts.onkeydown(e);
  });

  /* Hit-testing lands on the pre (pointer-events:auto); the textarea above
     is pointer-events:none. Map a point to a source character index, then
     drive the invisible textarea's caret/selection programmatically. */
  function charAtPoint(x, y) {
    let rng = null;
    if (document.caretRangeFromPoint) rng = document.caretRangeFromPoint(x, y);
    else if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p) { rng = document.createRange(); rng.setStart(p.offsetNode, p.offset); }
    }
    if (!rng) return 0;
    // absolute offset within <code> text
    function off(node, n) {
      let t = 0;
      const walk = (nd) => {
        if (nd === node) { t += n; return true; }
        if (nd.nodeType === 3) t += nd.length;
        else for (const c of nd.childNodes) if (walk(c)) return true;
        return false;
      };
      walk(preIn);
      return t;
    }
    return Math.min(src.length, off(rng.startContainer, rng.startOffset));
  }

  let anchor = null;
  pre.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const i = charAtPoint(e.clientX, e.clientY);
    anchor = i;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(i, i);
  });
  pre.addEventListener("dblclick", (e) => {
    e.preventDefault();
    const i = charAtPoint(e.clientX, e.clientY);
    let a = i, b = i;
    while (a > 0 && /[\w.:@]/.test(src[a - 1] || "")) a--;
    while (b < src.length && /[\w.:@]/.test(src[b] || "")) b++;
    ta.setSelectionRange(a, b);
  });
  window.addEventListener("mousemove", (e) => {
    if (anchor === null || e.buttons !== 1) return;
    if (!pre.contains(e.target) && e.target !== document.body) return;
    const i = charAtPoint(e.clientX, e.clientY);
    ta.setSelectionRange(Math.min(anchor, i), Math.max(anchor, i));
  });
  box.addEventListener("mouseleave", () => {
    hoverTok = null;
    opts.onTokenHover && opts.onTokenHover(null, null, null);
  });
  box.addEventListener("click", (e) => {
    const h = hit(e);
    if (h && opts.onTokenClick) opts.onTokenClick(h.tok, h.el, e);
  });

  function setSource(s) {
    src = s; ta.value = s; paint();
  }
  setSource(src);

  return {
    el: root, ta, pre,
    get source() { return src; },
    setSource,
    tokens: () => tokens,
    repaint: paint,
    elementFor: (i) => preIn.querySelector(`[data-i="${i}"]`),
  };
}

/* ------------------------------------------------------ graph binding */

/**
 * Bind tokens to graph nodes. sim-v0 (v6..v14) nodes carry line/col for
 * func/local/param/value/call. Strategy:
 *   1. exact (line, col) match
 *   2. same line + name match
 *   3. name + kind match anywhere (scope-free fallback)
 */
function bindGraph(tokens, graph) {
  if (!graph || !graph.nodes) return new Map();
  // compiler positions are 0-based; the lexer emits 1-based — probe both
  const byPos = new Map();
  for (const nd of graph.nodes) {
    if (nd.line === undefined || nd.line === null) continue;
    byPos.set(nd.line + ":" + nd.col, nd);
    byPos.set((nd.line + 1) + ":" + nd.col, nd);
    byPos.set(nd.line + ":" + (nd.col + 1), nd);
    byPos.set((nd.line + 1) + ":" + (nd.col + 1), nd);
  }
  const byLineName = new Map();
  for (const nd of graph.nodes) {
    if (!nd.name || nd.line === undefined) continue;
    const k = nd.line + "|" + nd.name;
    if (!byLineName.has(k)) byLineName.set(k, nd);
  }
  const byNameKind = new Map();
  for (const nd of graph.nodes) {
    if (!nd.name) continue;
    const k = nd.name + "/" + nd.kind;
    if (!byNameKind.has(k)) byNameKind.set(k, []);
    byNameKind.get(k).push(nd);
  }
  const out = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.t !== "name" && t.t !== "ctx") continue;
    let nd = byPos.get(t.l + ":" + t.c);
    if (!nd) nd = byLineName.get((t.l - 1) + "|" + t.v);
    if (!nd && byNameKind.has(t.v + "/func")) nd = byNameKind.get(t.v + "/func")[0];
    if (!nd && byNameKind.has(t.v + "/local")) nd = byNameKind.get(t.v + "/local")[0];
    if (nd) out.set(i, nd);
  }
  return out;
}

/** name occurrences across the file — reference faces for a token */
function refsOf(tokens, tok) {
  const out = [];
  if (!tok || (tok.t !== "name" && tok.t !== "ctx")) return out;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].v === tok.v && (tokens[i].t === "name" || tokens[i].t === "ctx")) out.push(i);
  }
  return out;
}

/* ------------------------------------------------------------- popover */

class Popover {
  constructor() {
    this.el = document.createElement("div");
    this.el.className = "popover";
    this.el.style.display = "none";
    document.body.appendChild(this.el);
    this.pinned = false;
    const close = (e) => {
      if (!this.pinned && !this.el.contains(e.target)) this.hide();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { this.pinned = false; this.hide(); }
    });
  }
  show(html, x, y, pin) {
    this.el.innerHTML = html;
    this.el.style.display = "block";
    this.pinned = !!pin;
    const r = this.el.getBoundingClientRect();
    let nx = x + 14, ny = y + 16;
    if (nx + r.width > innerWidth - 12) nx = x - r.width - 14;
    if (ny + r.height > innerHeight - 12) ny = Math.max(8, y - r.height - 12);
    this.el.style.left = Math.max(8, nx) + "px";
    this.el.style.top = Math.max(8, ny) + "px";
  }
  hide() { this.el.style.display = "none"; }
  get open() { return this.el.style.display !== "none"; }
}

function refName(graph, id) {
  const nd = (graph.nodes || []).find((x) => x.id === id);
  if (nd && nd.kind === "module") return "module";
  return nd ? (nd.name ? nd.name : nd.kind) : "#" + id;
}

function relationFace(e) {
  return `${e.relation}→${"#" + e.to}`;
}

function nodeFacts(nd, graph) {
  const rows = [];
  const edges = (graph.edges || []);
  const outs = edges.filter((e) => e.from === nd.id);
  const ins = edges.filter((e) => e.to === nd.id);
  rows.push(["kind", nd.kind]);
  if (nd.name) rows.push(["name", nd.name]);
  if (nd.scope !== undefined) rows.push(["scope", refName(graph, nd.scope)]);
  rows.push(["graph id", "#" + nd.id + " · line " + (nd.line || "?")]);
  if (outs.length) rows.push(["relations out", outs.map(relationFace).join("  ")]);
  if (ins.length) rows.push(["relations in", ins.map(relationFace).join("  ")]);
  const apps = (graph.applications || []).filter((a) =>
    a.application === nd.id || a.subject === nd.id || (a.arguments || []).includes(nd.id) || (a.results || []).includes(nd.id));
  for (const a of apps.slice(0, 4)) {
    rows.push(["application", `relation ${refName(graph, a.relation)} · subject ${refName(graph, a.subject)} · demand ${a.demand || "—"}`]);
  }
  for (const w of graph.worlds || []) {
    if (w.world === nd.id || (w.members || []).includes(nd.id)) {
      rows.push(["world", `home ${refName(graph, w.home)} · reach ${w.reach || "—"}`]);
    }
  }
  for (const dr of graph.draws || []) {
    if (dr.world && dr.world.id === nd.id) {
      rows.push(["world draw", `application ${dr.application} · effect ${(dr.effect && dr.effect.card) === "one" ? "world-bound" : "none"}`]);
    }
  }
  for (const lk of graph.callable_linkages || []) {
    if (lk.callable === nd.id) {
      rows.push(["lowering", `${lk.origin} · ${lk.exposure} · \`${lk.symbol}\``]);
    }
  }
  const cs = (graph.call_shapes || []).find((s) => s.node === nd.id);
  if (cs) rows.push(["call shape", `${cs.callee_kind} · ${cs.arg_count} operand${cs.arg_count === 1 ? "" : "s"}${cs.specializable ? " · specializable" : ""}`]);
  return rows;
}

function knowledgeFor(name, explain) {
  if (!explain || !explain.knowledge_snapshot) return [];
  return (explain.knowledge_snapshot.entities || [])
    .filter((x) => x.name === name)
    .slice(0, 3)
    .map((x) => `${x.kind} · ${x.phase} · knowledge ${x.knowledge} · ${x.representation}`);
}
/* --------------------------------------------- shared popover body */

const whysCache = new Map();

/** cross-world references for a subject, rendered into an open popover */
function fetchWhysInto(pop, subject) {
  if (!subject || subject.length < 2) return;
  const key = subject;
  const mount = pop.el.querySelector(".whys-mount");
  if (!mount) return;
  if (whysCache.has(key)) return renderWhys(mount, whysCache.get(key));
  mount.innerHTML = `<div class="fact dim">asking the worlds…</div>`;
  api.get("/api/whys?subject=" + encodeURIComponent(subject)).then((r) => {
    whysCache.set(key, r);
    if (pop.open && pop.el.querySelector(".whys-mount") === mount) renderWhys(mount, r);
  }).catch(() => { mount.innerHTML = ""; });
}

function renderWhys(mount, r) {
  const facts = (r && r.facts) || [];
  if (!facts.length) { mount.innerHTML = `<div class="fact dim">no world declares this spelling</div>`; return; }
  mount.innerHTML = facts.slice(0, 5).map((f) =>
    `<div class="fact">${esc(f.cause)}${f.detail ? ` <span class="dim">· ${esc(f.detail)}</span>` : ""}</div>`).join("");
}

function popoverBody(tok, nd, ctx) {
  ctx = ctx || {};
  const law = lawNote(tok);
  const tokens = ctx.tokens || [];
  let h = `<div class="p-title"><span class="lex">${esc(tok.v)}</span>` +
    `<span class="kind">${tok.t}${tok.f ? " · " + tok.f : ""}${nd ? " · " + nd.kind : ""}</span></div>`;
  h += `<div class="p-law"><span class="face-tag face-${esc(law.face)}">${esc(law.face)}</span>` +
    `<span class="mono-note">${esc(law.note)}</span></div>`;
  if (nd && ctx.graph) {
    const rows = nodeFacts(nd, ctx.graph);
    h += `<div class="p-sec"><div class="lbl">graph</div>` +
      rows.map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${esc(String(v))}</span></div>`).join("") +
      `</div>`;
  }
  const kn = knowledgeFor(tok.v, ctx.explain);
  if (kn.length) {
    h += `<div class="p-sec"><div class="lbl">knowledge</div><div class="facts">` +
      kn.map((x) => `<div class="fact">${esc(x)}</div>`).join("") + `</div></div>`;
  }
  const rr = refsOf(tokens, tok);
  if (rr.length > 1) {
    h += `<div class="p-sec"><div class="lbl">references · ${rr.length}</div><div class="facts">` +
      rr.slice(0, 6).map((i) => `<div class="fact">line ${tokens[i].l} col ${tokens[i].c}</div>`).join("") +
      (rr.length > 6 ? `<div class="fact dim">+${rr.length - 6} more</div>` : "") + `</div></div>`;
  }
  if ((tok.t === "name" || tok.t === "ctx") && !ctx.noWhys) {
    h += `<div class="p-sec"><div class="lbl">elsewhere</div><div class="facts whys-mount"></div></div>`;
  }
  h += `<div class="p-actions">` +
    (nd && ctx.onReveal ? `<button data-act="reveal">reveal in graph</button>` : ``) +
    (rr.length > 1 ? `<button data-act="refs">flash references</button>` : ``) +
    (ctx.onLib && (tok.t === "name" || tok.t === "ctx") ? `<button data-act="lib">find in lib</button>` : ``) +
    `<button data-act="law">law</button></div>`;
  return h;
}


/**
 * Wires hover/click popovers over an editor or static code view.
 * data: {graph, explain, sim, onReveal(nodeId)}
 */
function explore(ed, data) {
  const pop = new Popover();
  let pinnedTok = null;

  function popoverHTML(tok, nd) {
    return popoverBody(tok, nd, {
      graph: data.graph, explain: data.explain,
      tokens: ed.tokens(), onReveal: data.onReveal, onLib: data.onLib,
    });
  }

  function flashRefs(tok) {
    const rr = refsOf(ed.tokens(), tok);
    ed.pre.querySelectorAll(".tk.ref-flash").forEach((e) => e.classList.remove("ref-flash"));
    for (const i of rr) {
      const el = ed.elementFor(i);
      if (el) el.classList.add("ref-flash");
    }
    setTimeout(() => {
      ed.pre.querySelectorAll(".tk.ref-flash").forEach((e) => e.classList.remove("ref-flash"));
    }, 900);
  }

  ed.el.addEventListener("mouseover", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.classList.contains("tk")) return;
    if (pop.pinned) return;
    const i = +el.dataset.i;
    const tok = ed.tokens()[i];
    if (!tok) return;
    pop.show(popoverHTML(tok, bindCache.get(i) || null), e.clientX, e.clientY, false);
  });
  ed.el.addEventListener("mouseleave", () => { if (!pop.pinned) pop.hide(); });

  ed.el.addEventListener("click", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.classList.contains("tk")) return;
    if (e.target.closest("button")) return;
    const i = +el.dataset.i;
    const tok = ed.tokens()[i];
    if (!tok) return;
    pinnedTok = tok;
    ed.pre.querySelectorAll(".tk.selected").forEach((x) => x.classList.remove("selected"));
    el.classList.add("selected");
    pop.show(popoverHTML(tok, bindCache.get(i) || null), e.clientX, e.clientY, true);
    fetchWhysInto(pop, tok.v);
  });

  pop.el.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.dataset.act;
    const lexFind = pop.el.querySelector(".lex");
    const v = lexFind ? lexFind.textContent : "";
    const toks = ed.tokens();
    const tok = toks.find((t) => t.v === v) || pinnedTok;
    if (act === "reveal" && tok && data.onReveal) {
      const i = toks.indexOf(tok);
      data.onReveal(bindCache.get(i));
      pop.pinned = false; pop.hide();
    } else if (act === "refs" && tok) {
      flashRefs(tok);
    } else if (act === "lib" && tok && data.onLib) {
      data.onLib(tok.v);
      pop.pinned = false; pop.hide();
    } else if (act === "law") {
      global.open("https://docs.idol.id/law", "_blank");
    }
  });

  let bindCache = new Map();
  function rebind() { bindCache = bindGraph(ed.tokens(), data.graph); }
  rebind();
  return { rebind, popover: pop };
}

/* ------------------------------------------------------------- api client */

const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    return r.json();
  },
  async text(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(String(r.status));
    return r.text();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.status);
    return j;
  },
};

/* ------------------------------------------------------------------ utils */

function toast(msg, err) {
  let w = document.querySelector(".toast-wrap");
  if (!w) { w = document.createElement("div"); w.className = "toast-wrap"; document.body.appendChild(w); }
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  const flat = [];
  for (const k of kids) Array.isArray(k) ? flat.push(...k.flat(Infinity)) : flat.push(k);
  for (const k of flat) {
    if (k == null) continue;
    e.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
  }
  return e;
}

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}

global.Idol = {
  lex, render, faces, decls, editor, explore, doccode, bindGraph, refsOf,
  lawNote, popoverBody, nodeFacts, knowledgeFor,
  Popover, api, toast, el, fmtBytes, KW, CTX, TYPES,
};

})(window);
