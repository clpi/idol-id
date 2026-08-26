/* Exact token renderer and stale-analysis guard for the browser IDE.
   Browser lexing is immediate presentation only. Compiler-published spans
   replace covered source regions; uncovered lexical regions remain clickable. */
(function installIdolIdeSemanticLayer(global) {
"use strict";

if (!global.Idol?.editor || global.__idolIdeSemanticLayerInstalled) return;
global.__idolIdeSemanticLayerInstalled = true;

const originalEditor = global.Idol.editor;
const originalFetch = global.fetch.bind(global);
const encoder = new TextEncoder();
let pendingTokens = null;
let currentEditor = null;

function sourceSpan(token, sourceLength) {
  const span = Array.isArray(token?.span) ? token.span : [token?.start ?? token?.s, token?.end ?? token?.e];
  const start = Number(span[0]);
  const end = Number(span[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sourceLength) {
    throw new Error("invalid compiler token span");
  }
  return [start, end];
}

function tokenClass(token) {
  const face = String(token?.source_face || token?.face || token?.f || "").toLowerCase();
  const lexical = String(token?.lexical_identity || token?.kind || token?.t || "token").toLowerCase();
  const faces = { call:"tk-fn", relation:"tk-fn", subject:"tk-subject", projection:"tk-member", member:"tk-member", declaration:"tk-decl", binding:"tk-decl", parameter:"tk-param", descriptor:"tk-type", type:"tk-type", world:"tk-world", provenance:"tk-com", value:"tk-num" };
  const lexicalClasses = { keyword:"tk-kw", kw:"tk-kw", literal:"tk-kw", lit:"tk-kw", type:"tk-type", descriptor:"tk-type", string:"tk-str", str:"tk-str", number:"tk-num", num:"tk-num", comment:"tk-com", com:"tk-com", operator:"tk-op", op:"tk-op", delimiter:"tk-delim", delim:"tk-delim", world:"tk-world", directive:"tk-direct", direct:"tk-direct", name:"tk-name" };
  return faces[face] || lexicalClasses[lexical] || "tk-name";
}

function exactRecords(records, source) {
  if (!Array.isArray(records)) throw new Error("compiler tokens must be an array");
  const normalized = records.map((token) => Object.freeze({ ...token, span:Object.freeze(sourceSpan(token, source.length)) }))
    .sort((left,right)=>left.span[0]-right.span[0]||left.span[1]-right.span[1]);
  let end = -1;
  for (const token of normalized) {
    if (token.span[0] < end) throw new Error("compiler token spans overlap");
    end = token.span[1];
  }
  return normalized;
}

function lexicalSpan(token, sourceLength) {
  return sourceSpan({ span:[token?.s ?? token?.start, token?.e ?? token?.end] }, sourceLength);
}

function uncovered(span, exact) {
  let segments = [span];
  for (const projected of exact) {
    const next = [];
    for (const [start,end] of segments) {
      if (projected.span[1] <= start || projected.span[0] >= end) { next.push([start,end]); continue; }
      if (projected.span[0] > start) next.push([start,Math.min(projected.span[0],end)]);
      if (projected.span[1] < end) next.push([Math.max(projected.span[1],start),end]);
    }
    segments = next;
    if (!segments.length) break;
  }
  return segments.filter(([start,end])=>end>start);
}

function fallbackRecord(token, span, source) {
  return Object.freeze({
    span:Object.freeze(span),
    value:source.slice(span[0],span[1]),
    lexical_identity:String(token?.t || token?.lexical_identity || "token"),
    source_face:String(token?.f || token?.source_face || token?.t || "token"),
    binding_status:"not-published",
    semantic_id:null,
    graph_ids:Object.freeze([]),
    application_ids:Object.freeze([]),
    edges:Object.freeze([]),
    lowering:Object.freeze([]),
    provenance:Object.freeze({ source:Object.freeze({ start:span[0], end:span[1] }) }),
  });
}

function mergeDisplayTokens(records, lexical, source) {
  const exact = exactRecords(records, source);
  const fallbacks = [];
  for (const token of Array.isArray(lexical) ? lexical : []) {
    const span = lexicalSpan(token, source.length);
    for (const segment of uncovered(span, exact)) fallbacks.push(fallbackRecord(token, segment, source));
  }
  return Object.freeze([...exact,...fallbacks]
    .sort((left,right)=>left.span[0]-right.span[0]||left.span[1]-right.span[1])
    .map((token,index)=>Object.freeze({ ...token, index })));
}

function publishedTokens(payload) {
  const result = payload?.schema === "idol.web.ide.analysis.v1" ? payload.result : payload;
  return result?.tokens ?? result?.source_tokens ?? result?.semantic?.tokens ?? null;
}

async function sha256(value) {
  const digest = await global.crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return [...new Uint8Array(digest)].map((byte)=>byte.toString(16).padStart(2,"0")).join("");
}

async function requestSnapshot(input, init, url) {
  if (url.pathname !== "/v1/ide/analyze") return null;
  let raw = "";
  if (input instanceof Request) raw = await input.clone().text();
  else if (typeof init?.body === "string") raw = init.body;
  if (!raw) return null;
  try {
    const body = JSON.parse(raw);
    return Object.freeze({
      workspace_id:String(body.workspace_id || ""),
      file_id:String(body.file_id || ""),
      path:String(body.path || ""),
      source:String(body.source ?? ""),
    });
  } catch {
    return null;
  }
}

function currentWorkspaceId() {
  const text = document.querySelector("#workspace-name")?.textContent || "";
  const marker = text.lastIndexOf(" · ");
  return marker >= 0 ? text.slice(marker + 3).trim() : "";
}

async function staleReason(snapshot, payload) {
  if (!snapshot || !currentEditor) return "missing request revision";
  if (currentEditor.source !== snapshot.source) return "source changed during analysis";
  if ((document.querySelector("#active-path")?.textContent || "") !== snapshot.path) return "active file changed during analysis";
  const workspace = currentWorkspaceId();
  if (workspace && workspace !== snapshot.workspace_id) return "workspace changed during analysis";
  const expectedHash = await sha256(snapshot.source);
  if (String(payload?.source_hash || "") !== expectedHash) return "compiler response hash does not match request source";
  return "";
}

function staleResponse(detail) {
  return new Response(JSON.stringify({ error:"IDE_ANALYSIS_STALE", detail }), {
    status:409,
    headers:{ "content-type":"application/json; charset=utf-8", "cache-control":"no-store" },
  });
}

function renderPendingWhenAdmitted() {
  if (!pendingTokens || !currentEditor) return;
  const label = document.querySelector("#capability span")?.textContent || "";
  if (!/remote native|browser wasm/i.test(label)) return;
  try { currentEditor.setSemanticTokens(pendingTokens); pendingTokens = null; }
  catch (error) { console.error("exact token projection refused", error); }
}

global.fetch = async function idolIdeFetch(input, init) {
  let url;
  try { url = new URL(input instanceof Request ? input.url : String(input), global.location.href); }
  catch { return originalFetch(input, init); }
  const snapshot = await requestSnapshot(input, init, url);
  const response = await originalFetch(input, init);
  if (url.pathname !== "/v1/ide/analyze" || !response.ok) return response;
  try {
    const payload = await response.clone().json();
    const reason = await staleReason(snapshot, payload);
    if (reason) return staleResponse(reason);
    const records = publishedTokens(payload);
    if (Array.isArray(records)) {
      pendingTokens = mergeDisplayTokens(records, currentEditor?.tokens?.() || [], snapshot.source);
      queueMicrotask(renderPendingWhenAdmitted);
      setTimeout(renderPendingWhenAdmitted,0);
    }
  } catch (error) {
    return staleResponse(error instanceof Error ? error.message : "semantic response validation failed");
  }
  return response;
};

global.Idol.editor = function exactAwareEditor(mount, options = {}) {
  let semanticTokens = null;
  const wrapped = { ...options, oninput(source) { semanticTokens=null; pendingTokens=null; options.oninput?.(source); } };
  const editor = originalEditor(mount, wrapped);
  const lexicalTokens = editor.tokens.bind(editor), lexicalSetSource = editor.setSource.bind(editor), lexicalRepaint = editor.repaint.bind(editor);

  function renderSemanticTokens(records) {
    const source = editor.source;
    semanticTokens = exactRecords(records, source).map((token,index)=>Object.freeze({ ...token, index }));
    const code = editor.pre.querySelector("code");
    if (!code) throw new Error("IDE code layer is unavailable");
    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const token of semanticTokens) {
      if (token.span[0] > position) fragment.append(document.createTextNode(source.slice(position,token.span[0])));
      const span = document.createElement("span");
      span.className=`tk ${tokenClass(token)}`;
      span.dataset.i=String(token.index);span.dataset.s=String(token.span[0]);span.dataset.e=String(token.span[1]);
      span.dataset.binding=token.binding?.status||token.binding_status||"not-published";
      span.textContent=source.slice(token.span[0],token.span[1]);span.tabIndex=0;span.setAttribute("role","button");span.setAttribute("aria-label",`${span.textContent}, ${token.lexical_identity||"token"}, ${span.dataset.binding}`);
      if(span.dataset.binding==="published")span.classList.add("semantic-published");if(span.dataset.binding==="ambiguous")span.classList.add("semantic-ambiguous");
      span.addEventListener("click",(event)=>{event.stopPropagation();options.onTokenClick?.(token,span,event);});
      span.addEventListener("keydown",(event)=>{if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();event.stopPropagation();options.onTokenClick?.(token,span,event);});
      fragment.append(span);position=token.span[1];
    }
    if(position<source.length)fragment.append(document.createTextNode(source.slice(position)));
    code.replaceChildren(fragment);
  }

  editor.setSemanticTokens=renderSemanticTokens;
  editor.clearSemanticTokens=()=>{semanticTokens=null;pendingTokens=null;lexicalRepaint();};
  editor.setSource=(source)=>{semanticTokens=null;pendingTokens=null;lexicalSetSource(source);};
  editor.repaint=()=>semanticTokens?renderSemanticTokens(semanticTokens):lexicalRepaint();
  editor.tokens=()=>semanticTokens||lexicalTokens();
  currentEditor=editor;
  const capability=document.querySelector("#capability span");
  if(capability)new MutationObserver(renderPendingWhenAdmitted).observe(capability,{childList:true,characterData:true,subtree:true});
  queueMicrotask(renderPendingWhenAdmitted);
  return editor;
};
})(window);
