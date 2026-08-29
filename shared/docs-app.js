const DOCUMENTS = Object.freeze([
  { group: "authority", id: "law", name: "Compact law", status: "exact mirror" },
  { group: "authority", id: "faces", name: "Source faces", status: "bounded projection" },
  { group: "authority", id: "graph", name: "Semantic graph", status: "bounded projection" },
  { group: "authority", id: "worlds", name: "Worlds", status: "bounded projection" },
  { group: "interfaces", id: "api", name: "HTTP API", status: "operational transport" },
  { group: "interfaces", id: "mcp", name: "MCP", status: "operational transport" },
  { group: "products", id: "platform", name: "Platform", status: "operational projection" },
  { group: "products", id: "universe", name: "Universe views", status: "operational projection" },
  { group: "products", id: "repository", name: "Repository observatory", status: "operational projection" },
  { group: "blueprints", id: "live", name: "Idol Live", status: "product thesis" },
  { group: "blueprints", id: "spec", name: "Specification blueprint", status: "non-authoritative" },
  { group: "research", id: "synthesis", name: "Research synthesis", status: "historical until evidenced" },
]);

const app = document.getElementById("docs-app");
const nav = document.getElementById("docs-nav-list");
const main = document.getElementById("docs-content");
const authority = document.getElementById("docs-authority");
const search = document.getElementById("docs-search");
const searchHint = document.getElementById("docs-search-hint");
const mobileTitle = document.getElementById("docs-mobile-title");
const menuButton = document.getElementById("docs-menu");
const backdrop = document.getElementById("docs-backdrop");
const cache = new Map();
let searchGeneration = 0;
let documentGeneration = 0;
let searchTimer;

Shell.boot("docs", { title: "Docs", keys: [["/", "search"], ["Esc", "close navigation"]] });

function knownDocument(id) {
  return DOCUMENTS.find((entry) => entry.id === id) || DOCUMENTS[0];
}

function currentDocument() {
  const url = new URL(location.href);
  return knownDocument(url.searchParams.get("doc") || "law");
}

function documentUrl(id, heading = "") {
  const url = new URL(location.href);
  if (id === "law") url.searchParams.delete("doc");
  else url.searchParams.set("doc", id);
  url.searchParams.delete("q");
  url.hash = heading ? `#${heading}` : "";
  return `${url.pathname}${url.search}${url.hash}`;
}

function openNavigation() {
  app.classList.add("nav-open");
  document.documentElement.classList.add("docs-nav-open");
  menuButton.setAttribute("aria-expanded", "true");
  search.focus({ preventScroll: true });
}

function closeNavigation(restore = true) {
  app.classList.remove("nav-open");
  document.documentElement.classList.remove("docs-nav-open");
  menuButton.setAttribute("aria-expanded", "false");
  if (restore) menuButton.focus({ preventScroll: true });
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeHref(value) {
  const href = String(value || "").trim();
  // Reject protocol-relative (//), backslash, javascript:, data: URIs.
  if (/^\/\//.test(href) || /^[\\/]/.test(href) || /^(javascript|data):/i.test(href)) return "#";
  if (/^(https:\/\/|\/|\?|#)/.test(href)) return href;
  return "#";
}

function inline(value) {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => `<a href="${escapeHtml(safeHref(href))}">${label}</a>`);
  return output;
}

function slug(value) {
  return String(value).toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function renderMarkdown(source, documentId) {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let index = 0;
  let list = null;
  const closeList = () => {
    if (!list) return;
    output.push(`</${list}>`);
    list = null;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith("```")) {
      closeList();
      const language = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      output.push(`<pre data-lang="${escapeHtml(language)}"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length, 4);
      const text = heading[2].trim();
      const id = slug(text);
      output.push(`<h${level} id="${id}">${inline(text)}<a class="docs-anchor" href="${escapeHtml(documentUrl(documentId, id))}" aria-label="Link to ${escapeHtml(text)}">§</a></h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) {
      closeList();
      output.push("<hr>");
      index += 1;
      continue;
    }
    if (/^\|/.test(line) && lines[index + 1] && /^\|[-| :]+\|\s*$/.test(lines[index + 1])) {
      closeList();
      const headings = line.split("|").slice(1, -1).map((cell) => cell.trim());
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].startsWith("|")) {
        rows.push(lines[index].split("|").slice(1, -1).map((cell) => cell.trim()));
        index += 1;
      }
      output.push(`<div class="docs-table-wrap"><table><thead><tr>${headings.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const listItem = /^\s*(?:([-*])|(\d+)\.)\s+(.+)$/.exec(line);
    if (listItem) {
      const nextList = listItem[2] ? "ol" : "ul";
      if (list !== nextList) {
        closeList();
        output.push(`<${nextList}>`);
        list = nextList;
      }
      output.push(`<li>${inline(listItem[3])}</li>`);
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      closeList();
      output.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`);
      index += 1;
      continue;
    }
    if (!line.trim()) {
      closeList();
      index += 1;
      continue;
    }
    closeList();
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(?:#{1,4}\s|```|>|\||\s*(?:[-*]|\d+\.)\s+)/.test(lines[index])) paragraph.push(lines[index++].trim());
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  closeList();
  return output.join("\n");
}

function renderNavigation(filter = "") {
  const needle = filter.trim().toLowerCase();
  nav.replaceChildren();
  let group = "";
  const current = currentDocument().id;
  const visible = DOCUMENTS.filter((entry) => !needle || `${entry.name} ${entry.status} ${entry.group}`.toLowerCase().includes(needle));
  for (const entry of visible) {
    if (entry.group !== group) {
      group = entry.group;
      const label = document.createElement("div");
      label.className = "docs-group";
      label.textContent = group;
      nav.appendChild(label);
    }
    const link = document.createElement("a");
    link.className = `docs-link${entry.id === current ? " here" : ""}`;
    link.href = documentUrl(entry.id);
    if (entry.id === current) link.setAttribute("aria-current", "page");
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const status = document.createElement("span");
    status.textContent = entry.status;
    link.append(name, status);
    link.addEventListener("click", (event) => {
      event.preventDefault();
      history.pushState(null, "", link.href);
      closeNavigation(false);
      search.value = "";
      loadDocument();
    });
    nav.appendChild(link);
  }
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "docs-empty";
    empty.textContent = "No document title matches.";
    nav.appendChild(empty);
  }
}

async function sourceFor(entry) {
  // Delete rejected promises so transient network/cache failures can retry on next call.
  if (cache.has(entry.id)) {
    try { await cache.get(entry.id); } catch { cache.delete(entry.id); }
  }
  if (!cache.has(entry.id)) {
    const promise = fetch(`/content/docs/${entry.id}.md`, { headers: { accept: "text/markdown,text/plain" }, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(`${entry.name} returned HTTP ${response.status}`);
      return response.text();
    });
    cache.set(entry.id, promise);
  }
  return cache.get(entry.id);
}

function decodedHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return "";
  try { return decodeURIComponent(raw); } catch { return ""; }
}

function scrollToHash() {
  const id = decodedHash();
  if (!id) { scrollTo({ top: 0, behavior: "instant" }); return; }
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
}

function enhanceIdolCode() {
  if (!window.Idol?.doccode) return;
  for (const pre of main.querySelectorAll("pre[data-lang='id'], pre[data-lang='idol']")) {
    const holder = document.createElement("div");
    const source = pre.querySelector("code")?.textContent || "";
    pre.replaceWith(holder);
    window.Idol.doccode(holder, { source });
  }
}

function invalidateSearch() {
  clearTimeout(searchTimer);
  searchGeneration += 1;
}

async function loadDocument() {
  invalidateSearch();
  const generation = ++documentGeneration;
  const entry = currentDocument();
  renderNavigation(search.value);
  mobileTitle.textContent = entry.name;
  IdolShell.crumbs([{ label: "docs" }, { label: entry.name.toLowerCase() }]);
  authority.innerHTML = `<strong>${escapeHtml(entry.status)}.</strong> The compact law in <code>clpi/idol</code> remains the sole semantic authority. This page is a deployment projection and cannot claim implementation support that its source does not establish.`;
  main.className = "docs-content docs-loading";
  main.textContent = "Loading exact document projection…";
  try {
    const source = await sourceFor(entry);
    if (generation !== documentGeneration) return;
    main.className = "docs-content";
    main.innerHTML = renderMarkdown(source, entry.id);
    enhanceIdolCode();
    document.title = `${entry.name} — Idol docs`;
    scrollToHash();
  } catch (error) {
    if (generation !== documentGeneration) return;
    main.className = "docs-content docs-empty";
    main.textContent = error.message;
  }
}

function snippet(source, needle) {
  const plain = String(source).replace(/[`*_#>|\[\]()]/g, " ").replace(/\s+/g, " ").trim();
  const index = plain.toLowerCase().indexOf(needle);
  const start = Math.max(0, index - 60);
  return `${start ? "…" : ""}${plain.slice(start, start + 180)}${plain.length > start + 180 ? "…" : ""}`;
}

async function searchAll(query) {
  const generation = ++searchGeneration;
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) {
    searchHint.textContent = needle ? "Type at least two characters for full-text search." : "Press / or ⌘K to search all documents.";
    renderNavigation(query);
    return;
  }
  searchHint.textContent = "Searching exact deployed document projections…";
  const results = [];
  await Promise.all(DOCUMENTS.map(async (entry) => {
    try {
      const source = await sourceFor(entry);
      const haystack = `${entry.name}\n${source}`.toLowerCase();
      if (haystack.includes(needle)) results.push({ entry, source, index: haystack.indexOf(needle) });
    } catch {}
  }));
  if (generation !== searchGeneration) return;
  results.sort((left, right) => left.index - right.index || left.entry.name.localeCompare(right.entry.name));
  nav.replaceChildren();
  const mount = document.createElement("div");
  mount.className = "docs-search-results";
  for (const result of results) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "docs-search-result";
    const title = document.createElement("strong");
    title.textContent = result.entry.name;
    const detail = document.createElement("span");
    detail.textContent = snippet(result.source, needle);
    button.append(title, detail);
    button.addEventListener("click", () => {
      history.pushState(null, "", documentUrl(result.entry.id));
      search.value = "";
      closeNavigation(false);
      loadDocument();
    });
    mount.appendChild(button);
  }
  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "docs-empty";
    empty.textContent = "No deployed document contains that text.";
    mount.appendChild(empty);
  }
  nav.appendChild(mount);
  searchHint.textContent = `${results.length} document${results.length === 1 ? "" : "s"} matched.`;
}

search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchAll(search.value), 120);
});
menuButton.addEventListener("click", () => app.classList.contains("nav-open") ? closeNavigation() : openNavigation());
backdrop.addEventListener("click", () => closeNavigation());
addEventListener("popstate", loadDocument);
addEventListener("hashchange", scrollToHash);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && app.classList.contains("nav-open")) { event.preventDefault(); closeNavigation(); return; }
  if ((event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
    event.preventDefault();
    if (matchMedia("(max-width: 820px)").matches) openNavigation();
    search.focus();
    search.select();
  }
});

renderNavigation();
loadDocument();