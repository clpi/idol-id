import { publishedGraphModel, deterministicLayout, selectionNeighbourhood, edgePresentation } from "/shared/graph-model.js";

const app = document.getElementById("book-app");
const spine = document.getElementById("spine");
const sourceEl = document.getElementById("source");
const outEl = document.getElementById("out");
const runBtn = document.getElementById("run");
const langEl = document.getElementById("chapter-lang");
const graphSvg = document.getElementById("graph");
const graphState = document.getElementById("graph-state");
const rail = document.getElementById("rail");

Shell.boot("book", { title: "Book", keys: [["n", "next"], ["p", "prev"], ["Enter", "run"]] });

let catalog = { chapters: [] };
let model = null;
let selected = "";

function currentId() {
  return new URL(location.href).searchParams.get("ch") || catalog.chapters[0]?.id || "open";
}
function chapterById(id) {
  return catalog.chapters.find((c) => c.id === id) || catalog.chapters[0];
}
function hrefFor(id) {
  const url = new URL(location.href);
  if (id === catalog.chapters[0]?.id) url.searchParams.delete("ch");
  else url.searchParams.set("ch", id);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

function tokenize(source) {
  const tokens = [];
  const re = /(\s+)|(\/\/[^\n]*)|("[^"\\]*(?:\\.[^"\\]*)*")|(\d[\w.]*)|(@[A-Za-z_]\w*|[A-Za-z_]\w*)|([()\[\]{}.:=,+\-*/])/g;
  let last = 0;
  let match;
  while ((match = re.exec(source))) {
    if (match.index > last) tokens.push({ kind: "text", text: source.slice(last, match.index) });
    if (match[1]) tokens.push({ kind: "ws", text: match[1] });
    else if (match[2]) tokens.push({ kind: "comment", text: match[2] });
    else if (match[3]) tokens.push({ kind: "str", text: match[3] });
    else if (match[4]) tokens.push({ kind: "num", text: match[4] });
    else if (match[5]) tokens.push({ kind: "tok", text: match[5], id: match[5].replace(/^@/, "") });
    else tokens.push({ kind: "punct", text: match[6] });
    last = match.index + match[0].length;
  }
  if (last < source.length) tokens.push({ kind: "text", text: source.slice(last) });
  return tokens;
}

function localGraph(source, language) {
  const names = [...new Set(tokenize(source).filter((t) => t.kind === "tok").map((t) => t.id))];
  const nodes = names.map((id) => ({ id, label: id, language }));
  const edges = [];
  const mentioned = tokenize(source).filter((t) => t.kind === "tok").map((t) => t.id);
  for (let i = 0; i < mentioned.length - 1; i += 1) {
    if (mentioned[i] === mentioned[i + 1]) continue;
    edges.push({ id: `${mentioned[i]}>${mentioned[i + 1]}:${i}`, source: mentioned[i], target: mentioned[i + 1], role: "precede" });
  }
  return { nodes, edges, applications: [], language, published: false };
}

function renderSpine() {
  spine.replaceChildren();
  const here = currentId();
  for (const chapter of catalog.chapters) {
    const a = document.createElement("a");
    a.href = hrefFor(chapter.id);
    a.textContent = chapter.name;
    a.className = chapter.id === here ? "here" : "";
    spine.append(a);
  }
}

function renderSource(source) {
  sourceEl.replaceChildren();
  for (const token of tokenize(source)) {
    if (token.kind === "tok") {
      const mark = document.createElement("span");
      mark.className = "tok";
      mark.dataset.id = token.id;
      mark.textContent = token.text;
      mark.addEventListener("click", (event) => {
        event.preventDefault();
        select(token.id);
      });
      sourceEl.append(mark);
    } else {
      const span = document.createElement("span");
      span.className = token.kind === "ws" || token.kind === "text" ? "" : token.kind;
      span.textContent = token.text;
      sourceEl.append(span);
    }
  }
}

function renderGraph() {
  graphSvg.replaceChildren();
  if (!model) {
    graphState.textContent = "not published";
    return;
  }
  const layout = deterministicLayout(model);
  const nodes = layout.nodes || model.nodes || [];
  const edges = model.edges || [];
  const xs = nodes.map((n) => n.x ?? 0);
  const ys = nodes.map((n) => n.y ?? 0);
  const minX = Math.min(0, ...xs) - 24;
  const minY = Math.min(0, ...ys) - 24;
  const maxX = Math.max(320, ...xs) + 48;
  const maxY = Math.max(240, ...ys) + 48;
  graphSvg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  const pos = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const a = pos.get(edge.source) || pos.get(edge.from);
    const b = pos.get(edge.target) || pos.get(edge.to);
    if (!a || !b) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", `M ${a.x ?? 0} ${a.y ?? 0} L ${b.x ?? 0} ${b.y ?? 0}`);
    line.setAttribute("class", `e${selected && (edge.source === selected || edge.target === selected || edge.from === selected || edge.to === selected) ? " here" : ""}`);
    graphSvg.append(line);
  }
  for (const node of nodes) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", node.x ?? 0);
    c.setAttribute("cy", node.y ?? 0);
    c.setAttribute("r", 7);
    c.setAttribute("class", `n${node.id === selected ? " here" : ""}`);
    c.addEventListener("click", () => select(node.id));
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", (node.x ?? 0) + 10);
    label.setAttribute("y", (node.y ?? 0) + 3);
    label.setAttribute("class", "nl");
    label.textContent = node.label || node.id;
    g.append(c, label);
    graphSvg.append(g);
  }
  graphState.textContent = model.published ? "published" : "local projection";
}

function select(id) {
  selected = id;
  for (const mark of sourceEl.querySelectorAll(".tok")) mark.classList.toggle("here", mark.dataset.id === id);
  renderGraph();
  if (!model || !id) {
    rail.textContent = "Select any token.";
    return;
  }
  let neighbourhood = { nodes: [], edges: [] };
  try { neighbourhood = selectionNeighbourhood(model, id) || neighbourhood; } catch { /* local */ }
  const edges = (neighbourhood.edges || model.edges || []).filter((edge) => [edge.source, edge.target, edge.from, edge.to].includes(id));
  const links = edges.map((edge) => {
    const other = edge.source === id || edge.from === id ? (edge.target || edge.to) : (edge.source || edge.from);
    let role = "edge";
    try { role = edgePresentation(edge).label; } catch { role = edge.role || "edge"; }
    return `<a href="${hrefFor(currentId())}" data-id="${other}"><span class="edge">${role}</span> ${other}</a>`;
  });
  rail.innerHTML = `<strong>${id}</strong><br>${links.join("<br>") || "no published edges"}`;
  for (const a of rail.querySelectorAll("a[data-id]")) {
    a.addEventListener("click", (event) => {
      event.preventDefault();
      select(a.dataset.id);
    });
  }
}

async function loadPublishedGraph(chapter) {
  try {
    const response = await fetch(`/content/book/${chapter.id}.graph.json`, { cache: "no-store" });
    if (!response.ok) return null;
    return publishedGraphModel(await response.json());
  } catch {
    return null;
  }
}

async function openChapter() {
  const chapter = chapterById(currentId());
  langEl.textContent = chapter?.language || "";
  const source = await fetch(chapter.source, { cache: "no-store" }).then((r) => r.text());
  renderSpine();
  renderSource(source);
  const published = await loadPublishedGraph(chapter);
  if (published) model = published;
  else {
    try { model = Object.assign(publishedGraphModel(localGraph(source, chapter.language)), { published: false }); }
    catch { model = { ...localGraph(source, chapter.language), published: false }; }
  }
  selected = "";
  renderGraph();
  rail.textContent = "Select any token.";
  outEl.hidden = true;
}

async function runChapter() {
  const chapter = chapterById(currentId());
  outEl.hidden = false;
  outEl.textContent = "running…";
  try {
    const response = await fetch("/api/book/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chapter: chapter.id, language: chapter.language }),
    });
    if (response.ok) {
      outEl.textContent = await response.text();
      return;
    }
  } catch { /* no run transport yet */ }
  outEl.textContent = `${chapter.language} · ${chapter.id}\ngraph ${model?.nodes?.length || 0} identities · ${model?.edges?.length || 0} edges\nrun transport not published`;
}

runBtn.addEventListener("click", () => { runChapter(); });
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea")) return;
  const ids = catalog.chapters.map((c) => c.id);
  const index = ids.indexOf(currentId());
  if (event.key === "n" && index < ids.length - 1) location.href = hrefFor(ids[index + 1]);
  if (event.key === "p" && index > 0) location.href = hrefFor(ids[index - 1]);
  if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) runChapter();
});
window.addEventListener("popstate", () => { openChapter(); });

const loaded = await fetch("/content/book/chapters.json", { cache: "no-store" }).then((r) => r.json());
catalog = loaded;
await openChapter();
