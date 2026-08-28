function ensureSemanticSourceStyles() {
  if (typeof document === "undefined" || document.querySelector('link[href="/shared/observatory-syntax.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/shared/observatory-syntax.css";
  document.head.appendChild(link);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function slug(value) {
  return String(value || "not-published").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "not-published";
}
function frozen(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) { for (const item of value) frozen(item); return Object.freeze(value); }
  for (const item of Object.values(value)) frozen(item);
  return Object.freeze(value);
}

export function sourceTokenProjection(bundle) {
  if (!bundle || bundle.schema !== "idol.web.semantic.bundle.v1") throw new Error("semantic bundle is required");
  return Object.freeze(bundle.tokens.map((token, index) => frozen({
    ...token,
    index,
    ui_identity: token.token_id || `source-span:${token.span[0]}:${token.span[1]}`,
    published_source_face: token.binding?.status === "published" && token.source_face !== "not-published",
  })));
}

export function semanticTokenClass(token) {
  const classes = ["semantic-token", `lx-${slug(token.lexical_identity)}`, `binding-${slug(token.binding?.status)}`];
  if (token.published_source_face || (token.binding?.status === "published" && token.source_face !== "not-published")) classes.push(`sf-${slug(token.source_face)}`);
  if (token.semantic_id !== null) classes.push("has-semantic-identity");
  if ((token.graph_ids || []).length) classes.push("has-graph-link");
  if ((token.application_ids || []).length) classes.push("has-application-link");
  return classes.join(" ");
}

export function renderSemanticTokens(tokens, source) {
  const text = String(source);
  let cursor = 0;
  let html = "";
  for (const token of tokens) {
    const [start, end] = token.span;
    if (start < cursor || end > text.length) throw new Error("semantic token projection is not ordered within source");
    html += escapeHtml(text.slice(cursor, start));
    const semantic = token.semantic_id === null ? "semantic identity not published" : token.semantic_id;
    const title = token.binding?.status === "ambiguous" ? `ambiguous compiler binding · ${semantic}` : semantic;
    html += `<span class="${escapeHtml(semanticTokenClass(token))}" role="button" tabindex="0" data-token-index="${token.index}" data-token-id="${escapeHtml(token.ui_identity || token.token_id || "")}" data-binding-status="${escapeHtml(token.binding?.status || "not-published")}" data-semantic-id="${escapeHtml(token.semantic_id || "")}" aria-label="${escapeHtml(`${text.slice(start, end)} · ${title}`)}" title="${escapeHtml(title)}">${escapeHtml(text.slice(start, end))}</span>`;
    cursor = end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

export class SemanticSourceView {
  constructor(mount, options = {}) {
    if (!mount || typeof mount.appendChild !== "function") throw new Error("semantic source mount is required");
    ensureSemanticSourceStyles();
    this.mount = mount;
    this.options = options;
    this.bundle = null;
    this.tokens = Object.freeze([]);
    this.mode = options.mode === "edit" ? "edit" : "inspect";
    this.selected = -1;
    this.highlights = new Set();

    this.root = document.createElement("div");
    this.root.className = "semantic-source-view";
    this.root.dataset.mode = this.mode;
    this.pre = document.createElement("pre");
    this.pre.className = "semantic-source-code";
    this.pre.setAttribute("aria-label", "Inspectable Idol source");
    this.code = document.createElement("code");
    this.pre.appendChild(this.code);
    this.textarea = document.createElement("textarea");
    this.textarea.className = "semantic-source-editor";
    this.textarea.spellcheck = false;
    this.textarea.setAttribute("aria-label", "Edit Idol source");
    this.root.append(this.pre, this.textarea);
    mount.replaceChildren(this.root);

    this.code.addEventListener("click", (event) => this.#activate(event));
    this.code.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this.#activate(event);
    });
    this.code.addEventListener("pointerover", (event) => {
      const element = event.target.closest?.("[data-token-index]");
      if (!element) return;
      const token = this.tokens[Number(element.dataset.tokenIndex)];
      if (token) this.options.onHover?.(token, Number(element.dataset.tokenIndex), element);
    });
    this.code.addEventListener("focusin", (event) => {
      const element = event.target.closest?.("[data-token-index]");
      if (!element) return;
      const token = this.tokens[Number(element.dataset.tokenIndex)];
      if (token) this.options.onHover?.(token, Number(element.dataset.tokenIndex), element);
    });
    this.textarea.addEventListener("input", () => this.options.onInput?.(this.textarea.value));
    this.textarea.addEventListener("scroll", () => { this.pre.scrollTop = this.textarea.scrollTop; this.pre.scrollLeft = this.textarea.scrollLeft; });
  }

  #activate(event) {
    const element = event.target.closest?.("[data-token-index]");
    if (!element) return;
    const index = Number(element.dataset.tokenIndex);
    const token = this.tokens[index];
    if (!token) return;
    this.select(index);
    this.options.onSelect?.(token, index, element);
  }

  setBundle(bundle) {
    this.bundle = bundle;
    this.tokens = sourceTokenProjection(bundle);
    this.textarea.value = bundle.source;
    this.code.innerHTML = renderSemanticTokens(this.tokens, bundle.source);
    this.#paint();
  }
  setSource(source) { this.textarea.value = String(source); }
  getSource() { return this.mode === "edit" ? this.textarea.value : (this.bundle?.source || this.textarea.value); }
  setMode(mode) {
    if (!new Set(["edit", "inspect"]).has(mode)) throw new Error(`unsupported source mode ${mode}`);
    this.mode = mode;
    this.root.dataset.mode = mode;
    if (mode === "edit") this.textarea.focus();
  }
  select(index, { focus = false } = {}) {
    this.selected = Number.isInteger(index) ? index : -1;
    this.#paint();
    const element = this.code.querySelector(`[data-token-index="${this.selected}"]`);
    element?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    if (focus) element?.focus?.();
  }
  setHighlights(indexes = []) { this.highlights = new Set(indexes.filter(Number.isInteger)); this.#paint(); }
  #paint() {
    this.code.querySelectorAll("[data-token-index]").forEach((element) => {
      const index = Number(element.dataset.tokenIndex);
      element.classList.toggle("selected", index === this.selected);
      element.classList.toggle("related", this.highlights.has(index));
      element.setAttribute("aria-pressed", String(index === this.selected));
    });
  }
}
