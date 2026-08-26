/* Exact token renderer for the browser IDE.
   The ordinary browser lexer remains the immediate pre-analysis presentation.
   When /v1/ide/analyze publishes exact token spans, this adapter replaces the
   visible token layer with those spans instead of decorating browser guesses. */
(function installIdolIdeSemanticLayer(global) {
"use strict";

if (!global.Idol?.editor || global.__idolIdeSemanticLayerInstalled) return;
global.__idolIdeSemanticLayerInstalled = true;

const originalEditor = global.Idol.editor;
const originalFetch = global.fetch.bind(global);
let pendingTokens = null;
let currentEditor = null;

function sourceSpan(token, sourceLength) {
  const span = Array.isArray(token?.span)
    ? token.span
    : [token?.start ?? token?.s, token?.end ?? token?.e];
  const start = Number(span[0]);
  const end = Number(span[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sourceLength) {
    throw new Error("invalid compiler token span");
  }
  return [start, end];
}

function tokenClass(token) {
  const face = String(token?.source_face || token?.face || "").toLowerCase();
  const lexical = String(token?.lexical_identity || token?.kind || token?.t || "token").toLowerCase();
  const faces = {
    call: "tk-fn",
    relation: "tk-fn",
    subject: "tk-subject",
    projection: "tk-member",
    member: "tk-member",
    declaration: "tk-decl",
    binding: "tk-decl",
    parameter: "tk-param",
    descriptor: "tk-type",
    type: "tk-type",
    world: "tk-world",
    provenance: "tk-com",
    value: "tk-num",
  };
  const lexicalClasses = {
    keyword: "tk-kw", kw: "tk-kw", literal: "tk-kw", lit: "tk-kw",
    type: "tk-type", descriptor: "tk-type", string: "tk-str", str: "tk-str",
    number: "tk-num", num: "tk-num", comment: "tk-com", com: "tk-com",
    operator: "tk-op", op: "tk-op", delimiter: "tk-delim", delim: "tk-delim",
    world: "tk-world", directive: "tk-direct", direct: "tk-direct", name: "tk-name",
  };
  return faces[face] || lexicalClasses[lexical] || "tk-name";
}

function normalizeTokens(records, source) {
  if (!Array.isArray(records)) throw new Error("compiler tokens must be an array");
  const normalized = records.map((token, index) => {
    const span = sourceSpan(token, source.length);
    return Object.freeze({ ...token, index, span: Object.freeze(span) });
  }).sort((left, right) => left.span[0] - right.span[0] || left.span[1] - right.span[1]);
  let end = -1;
  for (const token of normalized) {
    if (token.span[0] < end) throw new Error("compiler token spans overlap");
    end = token.span[1];
  }
  return Object.freeze(normalized.map((token, index) => token.index === index
    ? token
    : Object.freeze({ ...token, index })));
}

function publishedTokens(payload) {
  const result = payload?.schema === "idol.web.ide.analysis.v1" ? payload.result : payload;
  return result?.tokens ?? result?.source_tokens ?? result?.semantic?.tokens ?? null;
}

function renderPendingWhenAdmitted() {
  if (!pendingTokens || !currentEditor) return;
  const label = document.querySelector("#capability span")?.textContent || "";
  if (!/remote native|browser wasm/i.test(label)) return;
  try {
    currentEditor.setSemanticTokens(pendingTokens);
    pendingTokens = null;
  } catch (error) {
    console.error("exact token projection refused", error);
  }
}

global.fetch = async function idolIdeFetch(input, init) {
  const response = await originalFetch(input, init);
  try {
    const url = new URL(input instanceof Request ? input.url : String(input), global.location.href);
    if (url.pathname === "/v1/ide/analyze" && response.ok) {
      response.clone().json().then((payload) => {
        const records = publishedTokens(payload);
        if (Array.isArray(records)) {
          pendingTokens = records;
          queueMicrotask(renderPendingWhenAdmitted);
          setTimeout(renderPendingWhenAdmitted, 0);
        }
      }).catch(() => {});
    }
  } catch {
    // Ordinary fetch behavior is preserved when a URL or response is not an
    // IDE semantic result.
  }
  return response;
};

global.Idol.editor = function exactAwareEditor(mount, options = {}) {
  let semanticTokens = null;
  const wrapped = {
    ...options,
    oninput(source) {
      semanticTokens = null;
      options.oninput?.(source);
    },
  };
  const editor = originalEditor(mount, wrapped);
  const lexicalTokens = editor.tokens.bind(editor);
  const lexicalSetSource = editor.setSource.bind(editor);
  const lexicalRepaint = editor.repaint.bind(editor);

  function renderSemanticTokens(records) {
    const source = editor.source;
    semanticTokens = normalizeTokens(records, source);
    const code = editor.pre.querySelector("code");
    if (!code) throw new Error("IDE code layer is unavailable");
    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const token of semanticTokens) {
      if (token.span[0] > position) fragment.append(document.createTextNode(source.slice(position, token.span[0])));
      const span = document.createElement("span");
      span.className = `tk ${tokenClass(token)}`;
      span.dataset.i = String(token.index);
      span.dataset.s = String(token.span[0]);
      span.dataset.e = String(token.span[1]);
      span.dataset.binding = token.binding?.status || token.binding_status || "not-published";
      span.textContent = source.slice(token.span[0], token.span[1]);
      span.tabIndex = 0;
      span.setAttribute("role", "button");
      span.setAttribute("aria-label", `${span.textContent}, ${token.lexical_identity || "token"}, ${span.dataset.binding}`);
      if (span.dataset.binding === "published") span.classList.add("semantic-published");
      if (span.dataset.binding === "ambiguous") span.classList.add("semantic-ambiguous");
      span.addEventListener("click", (event) => {
        event.stopPropagation();
        options.onTokenClick?.(token, span, event);
      });
      span.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        options.onTokenClick?.(token, span, event);
      });
      fragment.append(span);
      position = token.span[1];
    }
    if (position < source.length) fragment.append(document.createTextNode(source.slice(position)));
    code.replaceChildren(fragment);
  }

  editor.setSemanticTokens = renderSemanticTokens;
  editor.clearSemanticTokens = () => {
    semanticTokens = null;
    lexicalRepaint();
  };
  editor.setSource = (source) => {
    semanticTokens = null;
    lexicalSetSource(source);
  };
  editor.repaint = () => semanticTokens ? renderSemanticTokens(semanticTokens) : lexicalRepaint();
  editor.tokens = () => semanticTokens || lexicalTokens();
  currentEditor = editor;

  const capability = document.querySelector("#capability span");
  if (capability) new MutationObserver(renderPendingWhenAdmitted).observe(capability, { childList: true, characterData: true, subtree: true });
  queueMicrotask(renderPendingWhenAdmitted);
  return editor;
};

})(window);
