const CURRENT_PROTOCOL = "2026-07-28";
const ENDPOINT = "/mcp";
const MAX_RENDER_BYTES = 160 * 1024;
const encoder = new TextEncoder();

const token = document.getElementById("mcp-token");
const raw = document.getElementById("mcp-raw");
const status = document.getElementById("mcp-status");
const grid = document.getElementById("mcp-tool-grid");
const select = document.getElementById("mcp-tool-select");
const argumentsInput = document.getElementById("mcp-arguments");
const actionButtons = [...document.querySelectorAll("#mcp-discover, #mcp-tools, #mcp-call")];
let tools = [];
let requestGeneration = 0;
let activeRequest = null;

Shell.boot("mcp", { title: "MCP", keys: [["D", "discover"], ["T", "tools"], ["C", "call"]] });
IdolShell.crumbs([{ label: "mcp" }, { label: "streamable http" }]);

function setStatus(value, isError = false) {
  status.textContent = value;
  status.classList.toggle("live", !isError && value !== "idle");
  status.classList.toggle("error", isError);
}

function setBusy(busy) {
  for (const button of actionButtons) button.disabled = busy;
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `mcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function exactJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function boundedDisplay(value) {
  const source = typeof value === "string" ? value : exactJson(value);
  const buffer = new Uint8Array(MAX_RENDER_BYTES);
  const { read } = encoder.encodeInto(source, buffer);
  if (read === source.length) return source;
  return `${source.slice(0, read)}\n\n[response display truncated at ${MAX_RENDER_BYTES} UTF-8 bytes]`;
}

function show(value) {
  raw.textContent = boundedDisplay(value);
}

function toolCard(tool) {
  const card = document.createElement("article");
  card.className = "tool mcp-tool";
  const name = document.createElement("code");
  name.textContent = String(tool.name || "unnamed tool");
  const description = document.createElement("p");
  description.textContent = String(tool.description || "No description published.");
  const scopes = document.createElement("div");
  scopes.className = "mcp-scope";
  scopes.textContent = Array.isArray(tool.requiredScopes) && tool.requiredScopes.length
    ? tool.requiredScopes.join(" + ")
    : "scope projection unavailable";
  card.append(name, description, scopes);
  return card;
}

function renderTools(nextTools) {
  const unique = new Map();
  for (const tool of Array.isArray(nextTools) ? nextTools : []) {
    const name = String(tool?.name || "");
    if (!name || !name.startsWith("idol.") || unique.has(name)) continue;
    unique.set(name, tool);
  }
  tools = [...unique.values()].sort((left, right) => String(left.name).localeCompare(String(right.name)));
  grid.replaceChildren();
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = tools.length ? "Select a canonical tool" : "No canonical tools published";
  select.appendChild(placeholder);

  for (const tool of tools) {
    grid.appendChild(toolCard(tool));
    const option = document.createElement("option");
    option.value = tool.name;
    option.textContent = tool.name;
    select.appendChild(option);
  }

  if (!tools.length) {
    const empty = document.createElement("article");
    empty.className = "tool mcp-tool";
    const label = document.createElement("code");
    label.textContent = "tool projection unavailable";
    const detail = document.createElement("p");
    detail.textContent = "Authenticate and call tools/list to request the exact current inventory.";
    empty.append(label, detail);
    grid.appendChild(empty);
  }
}

async function loadPublicTools() {
  try {
    const response = await fetch("/runtime/mcp-tools.json", { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const projection = await response.json();
    renderTools(projection.tools);
  } catch {
    renderTools([]);
  }
}

async function rpc(method, params = {}, request) {
  const bearer = token.value.trim();
  if (!bearer) throw new Error("Paste a Platform API token first.");
  const name = method === "tools/call" ? String(params.name || "") : "";
  const headers = {
    authorization: `Bearer ${bearer}`,
    accept: "application/json",
    "content-type": "application/json",
    "MCP-Protocol-Version": CURRENT_PROTOCOL,
    "Mcp-Method": method,
  };
  if (name) headers["Mcp-Name"] = name;
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: requestId(), method, params }),
    cache: "no-store",
    signal: request.signal,
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); }
  catch { body = { error: { code: "MCP_INVALID_RESPONSE", detail: text.slice(0, 8192) } }; }
  if (!response.ok) {
    const error = new Error(body?.error?.detail || body?.error?.message || body?.error?.code || `HTTP ${response.status}`);
    error.body = body;
    error.status = response.status;
    throw error;
  }
  return body;
}

async function run(method, params = {}) {
  const generation = ++requestGeneration;
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  setBusy(true);
  setStatus("requesting");
  show("Requesting…");
  try {
    const body = await rpc(method, params, request);
    if (generation !== requestGeneration) return null;
    show(body);
    setStatus("connected");
    if (method === "tools/list") renderTools(body?.result?.tools);
    return body;
  } catch (error) {
    if (generation !== requestGeneration) return null;
    show(error.body || { error: { code: "MCP_REQUEST_FAILED", detail: error.message, status: error.status || null } });
    setStatus("refused", true);
    return null;
  } finally {
    if (generation === requestGeneration) {
      activeRequest = null;
      setBusy(false);
    }
  }
}

async function copy(button) {
  const source = document.getElementById(button.dataset.copy || "");
  if (!source) return;
  const value = source.textContent || "";
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(source);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand("copy");
    selection?.removeAllRanges();
  }
  const previous = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = previous; }, 1300);
}

function callSelected() {
  const name = select.value;
  if (!name) {
    show({ error: { code: "MCP_TOOL_REQUIRED", detail: "Select a canonical idol.* tool." } });
    setStatus("refused", true);
    return;
  }
  let args;
  try {
    args = JSON.parse(argumentsInput.value || "{}");
    if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error();
  } catch {
    show({ error: { code: "MCP_ARGUMENTS_INVALID", detail: "Arguments must be one JSON object." } });
    setStatus("refused", true);
    return;
  }
  run("tools/call", { name, arguments: args });
}

document.getElementById("mcp-discover").addEventListener("click", () => run("server/discover"));
document.getElementById("mcp-tools").addEventListener("click", () => run("tools/list"));
document.getElementById("mcp-call").addEventListener("click", callSelected);
document.getElementById("mcp-forget").addEventListener("click", () => {
  requestGeneration += 1;
  activeRequest?.abort();
  activeRequest = null;
  setBusy(false);
  token.value = "";
  argumentsInput.value = "{}";
  show("Token forgotten. No browser storage was used.");
  setStatus("idle");
  token.focus();
});
for (const button of document.querySelectorAll("[data-copy]")) button.addEventListener("click", () => copy(button));

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  if (key === "d") { event.preventDefault(); run("server/discover"); }
  if (key === "t") { event.preventDefault(); run("tools/list"); }
  if (key === "c") { event.preventDefault(); callSelected(); }
});

loadPublicTools();
