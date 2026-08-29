import { API_ENDPOINTS, resolveEndpointPath } from "/shared/api-endpoints.js";

const root = document.getElementById("api-endpoints");
const filters = document.getElementById("api-filters");
const token = document.getElementById("api-token");
const sourceStatus = document.getElementById("api-source-status");
const sourceManifest = sourceStatus?.dataset.sourceManifest || "";
const MAX_RENDER_BYTES = 160 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let authorityExample = "";
let selectedOwner = "all";

Shell.boot("api", { title: "API", keys: [["⌘K", "focus endpoint filter"], ["Esc", "close endpoint"]] });
IdolShell.crumbs([{ label: "api" }, { label: "transport console" }]);

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function prettyResponse(value, type) {
  if (type.includes("json")) {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch {}
  }
  return value;
}

function bounded(value) {
  const source = text(value);
  if (encoder.encode(source).byteLength <= MAX_RENDER_BYTES) return source;
  const buffer = new Uint8Array(MAX_RENDER_BYTES);
  const { written } = encoder.encodeInto(source, buffer);
  return `${decoder.decode(buffer.subarray(0, written))}\n\n[response display truncated by the browser console]`;
}

function field(label, value = "", options = {}) {
  const holder = document.createElement("label");
  holder.className = `api-field${options.full ? " full" : ""}`;
  const caption = document.createElement("span");
  caption.textContent = label;
  const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
  input.value = value;
  input.spellcheck = false;
  if (!options.multiline) input.type = "text";
  holder.append(caption, input);
  return { holder, input };
}

function ownerNote(record) {
  return record.owner === "edge"
    ? "Edge-owned projection. The Worker returns this bounded deployment or world-boundary record directly."
    : "Compiler-origin request. The edge forwards this request to the configured origin and does not reinterpret the response.";
}

function responseMeta(mount) {
  const names = ["status", "elapsed", "content-type", "cache-control"];
  const fields = Object.fromEntries(names.map((name) => {
    const node = document.createElement("span");
    node.dataset.meta = name;
    node.textContent = `${name}: —`;
    mount.appendChild(node);
    return [name, node];
  }));
  return fields;
}

function endpointView(record) {
  const details = document.createElement("details");
  details.className = "api-endpoint";
  details.dataset.owner = record.owner;
  details.dataset.group = record.group;

  const summary = document.createElement("summary");
  summary.className = "api-summary";
  const method = document.createElement("span");
  method.className = `api-method ${record.method.toLowerCase()}`;
  method.textContent = record.method;
  const summaryMain = document.createElement("span");
  summaryMain.className = "api-summary-main";
  const path = document.createElement("code");
  path.className = "api-path";
  path.textContent = record.path;
  const title = document.createElement("span");
  title.className = "api-title";
  title.textContent = record.title;
  summaryMain.append(path, title);
  const owner = document.createElement("span");
  owner.className = `api-owner ${record.owner}`;
  owner.textContent = record.owner;
  summary.append(method, summaryMain, owner);

  const panel = document.createElement("div");
  panel.className = "api-panel";
  const description = document.createElement("p");
  description.className = "api-description";
  description.textContent = record.description;
  const boundary = document.createElement("div");
  boundary.className = "api-boundary-note";
  boundary.textContent = ownerNote(record);
  panel.append(description, boundary);

  const form = document.createElement("div");
  form.className = "api-form";
  const pathInputs = {};
  for (const [name, value] of Object.entries(record.pathValues || {})) {
    const item = field(`path · ${name}`, value);
    pathInputs[name] = item.input;
    form.appendChild(item.holder);
  }
  const query = field("query string", record.query || "");
  form.appendChild(query.holder);
  let body = null;
  if (record.method !== "GET" && record.method !== "HEAD") {
    const initial = record.body ? structuredClone(record.body) : {};
    if (record.source && authorityExample && Object.hasOwn(initial, "source")) initial.source = authorityExample;
    body = field("JSON body", JSON.stringify(initial, null, 2), { multiline: true, full: true });
    form.appendChild(body.holder);
  }
  panel.appendChild(form);

  const actions = document.createElement("div");
  actions.className = "api-actions";
  const send = document.createElement("button");
  send.type = "button";
  send.className = "primary";
  send.textContent = "Send request";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy cURL";
  actions.append(send, copy);
  panel.appendChild(actions);

  const metaMount = document.createElement("div");
  metaMount.className = "api-meta";
  const meta = responseMeta(metaMount);
  const output = document.createElement("pre");
  output.className = "api-response";
  output.textContent = "No request yet.";
  panel.append(metaMount, output);

  function values() {
    return Object.fromEntries(Object.entries(pathInputs).map(([name, input]) => [name, input.value]));
  }

  function requestPath() {
    return resolveEndpointPath(record, values(), query.input.value);
  }

  function requestBody() {
    if (!body) return null;
    const value = JSON.parse(body.input.value || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON body must be one object.");
    return value;
  }

  async function sendRequest() {
    send.disabled = true;
    output.classList.remove("error");
    output.textContent = "Requesting…";
    const started = performance.now();
    try {
      const headers = new Headers({ accept: "application/json,text/plain,*/*" });
      let payload;
      if (body) {
        headers.set("content-type", "application/json");
        payload = JSON.stringify(requestBody());
      }
      if (record.auth === "bearer") {
        const bearer = token.value.trim();
        if (!bearer) throw new Error("This operation requires a bearer token in the memory-only token field.");
        headers.set("authorization", `Bearer ${bearer}`);
      }
      const response = await fetch(requestPath(), {
        method: record.method,
        headers,
        ...(payload === undefined ? {} : { body: payload }),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const elapsed = (performance.now() - started).toFixed(1);
      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
        meta.status.textContent = "status: redirect not followed";
        meta.elapsed.textContent = `elapsed: ${elapsed} ms`;
        meta["content-type"].textContent = "content-type: not exposed";
        meta["cache-control"].textContent = "cache-control: not exposed";
        output.textContent = "Manual redirect received. The browser console intentionally does not follow or reinterpret the redirect target.";
        output.classList.add("error");
        return;
      }
      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();
      meta.status.textContent = `status: ${response.status} ${response.statusText}`;
      meta.elapsed.textContent = `elapsed: ${elapsed} ms`;
      meta["content-type"].textContent = `content-type: ${contentType || "not published"}`;
      meta["cache-control"].textContent = `cache-control: ${response.headers.get("cache-control") || "not published"}`;
      output.textContent = bounded(prettyResponse(raw, contentType));
      output.classList.toggle("error", !response.ok);
    } catch (error) {
      const timedOut = error?.name === "TimeoutError";
      meta.status.textContent = timedOut ? "status: request timed out" : "status: client refusal";
      meta.elapsed.textContent = `elapsed: ${(performance.now() - started).toFixed(1)} ms`;
      meta["content-type"].textContent = "content-type: —";
      meta["cache-control"].textContent = "cache-control: —";
      output.textContent = timedOut ? `Request exceeded ${REQUEST_TIMEOUT_MS / 1000} seconds.` : error.message;
      output.classList.add("error");
    } finally {
      send.disabled = false;
    }
  }

  async function copyCurl() {
    let payload = null;
    try { payload = requestBody(); } catch (error) { output.textContent = error.message; output.classList.add("error"); return; }
    const lines = [`curl ${JSON.stringify(new URL(requestPath(), location.origin).href)}`, `  -X ${record.method}`, "  -H 'Accept: application/json,text/plain,*/*'"];
    if (record.auth === "bearer") lines.push('  -H "Authorization: Bearer $IDOL_TOKEN"');
    if (payload !== null) {
      lines.push("  -H 'Content-Type: application/json'");
      lines.push(`  --data ${JSON.stringify(JSON.stringify(payload))}`);
    }
    const command = lines.join(" \\\n");
    try { await navigator.clipboard.writeText(command); }
    catch { output.textContent = command; return; }
    const previous = copy.textContent;
    copy.textContent = "Copied";
    setTimeout(() => { copy.textContent = previous; }, 1300);
  }

  send.addEventListener("click", sendRequest);
  copy.addEventListener("click", copyCurl);
  details.append(summary, panel);
  return details;
}

function render() {
  root.replaceChildren();
  let group = "";
  let mount = null;
  for (const record of API_ENDPOINTS.filter((candidate) => selectedOwner === "all" || candidate.owner === selectedOwner)) {
    if (record.group !== group) {
      group = record.group;
      const section = document.createElement("section");
      section.className = "api-group";
      const heading = document.createElement("h3");
      heading.className = "api-group-title";
      heading.textContent = group;
      mount = document.createElement("div");
      section.append(heading, mount);
      root.appendChild(section);
    }
    mount.appendChild(endpointView(record));
  }
}

function renderFilters() {
  for (const [value, label] of [["all", "all endpoints"], ["edge", "edge owned"], ["compiler-origin", "compiler origin"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.classList.toggle("here", value === selectedOwner);
    button.addEventListener("click", () => {
      selectedOwner = value;
      for (const item of filters.querySelectorAll("button")) item.classList.toggle("here", item === button);
      render();
    });
    filters.appendChild(button);
  }
}

async function loadAuthorityExample() {
  try {
    if (!sourceManifest) throw new Error("authority source example coordinate missing");
    const response = await fetch(sourceManifest, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    const example = manifest.examples?.find((entry) => entry.status === "current-law") || manifest.examples?.[0];
    authorityExample = text(example?.source);
    sourceStatus.textContent = authorityExample ? `source defaults: ${example.id} · ${example.status}` : "source defaults unavailable";
  } catch {
    sourceStatus.textContent = "source defaults unavailable; requests remain editable";
  }
}

document.getElementById("api-forget-token").addEventListener("click", () => {
  token.value = "";
  token.focus();
});
document.getElementById("api-show-token").addEventListener("click", (event) => {
  const showing = token.type === "text";
  token.type = showing ? "password" : "text";
  event.currentTarget.textContent = showing ? "Show" : "Hide";
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelector(".api-endpoint[open]")?.removeAttribute("open");
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector(".api-filter button")?.focus();
  }
});

renderFilters();
await loadAuthorityExample();
render();
