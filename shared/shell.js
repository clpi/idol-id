/* idol.id shared shell
   One product, one navigation and command model, many projections.
   The shell presents graph-owned facts; it never creates semantic identity. */
(function (global) {
"use strict";

const SURFACES = Object.freeze([
  { id: "site", label: "studio", href: "https://idol.id/", title: "Semantic studio", detail: "source · graph · realization" },
  { id: "graph", label: "graph", href: "https://graph.idol.id/", title: "Semantic Observatory", detail: "exact compiler projection" },
  { id: "worlds", label: "worlds", href: "https://lib.idol.id/atlas", title: "World Atlas", detail: "world and foreign projections" },
  { id: "lib", label: "registry", href: "https://lib.idol.id/", title: "Registry", detail: "published records and artifacts" },
  { id: "docs", label: "docs", href: "https://docs.idol.id/", title: "Law and documentation", detail: "current authority projection" },
  { id: "platform", label: "platform", href: "https://platform.idol.id/", title: "Platform", detail: "authenticated management" },]);

const CONTEXTUAL = Object.freeze([
  { id: "ide", label: "ide", href: "https://platform.idol.id/ide", title: "Browser IDE", detail: "local workspace · explicit analysis" },
  { id: "live", label: "live", href: "https://live.idol.id/", title: "Live", detail: "causal project control" },
  { id: "repository", label: "repository", href: "https://platform.idol.id/repo", title: "Repository Observatory", detail: "bounded repository evidence" },
  { id: "homes", label: "homes", href: "https://lib.idol.id/?set=homes", title: "Source homes", detail: "reach and provenance" },
  { id: "universe", label: "universe", href: "https://lib.idol.id/universe", title: "Public universe views", detail: "published operational projections" },
  { id: "universemanage", label: "manage universe", href: "https://platform.idol.id/universe", title: "Manage universe views", detail: "authenticated projection CRUD" },
  { id: "api", label: "api", href: "https://api.idol.id/", title: "Semantic API", detail: "bounded transport" },
  { id: "mcp", label: "mcp", href: "https://mcp.idol.id/", title: "Hosted MCP", detail: "scoped semantic transport" },
]);

let registeredCommands = [];
let commandState = null;

function ensureStudioStyles() {
  if (document.querySelector('link[href="/shared/studio.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/shared/studio.css";
  document.head.appendChild(link);
}

function decodeWorldHash(hash = global.location.hash) {
  const source = String(hash || "").replace(/^#/, "");
  if (!source) return "";
  try { return decodeURIComponent(source); } catch { return ""; }
}

function worldRoute(pathname = global.location.pathname) {
  const match = /^\/world\/([^/]+)(?:\/([^/]+))?\/?$/.exec(String(pathname || ""));
  if (!match) return Object.freeze({ world: "", lens: "" });
  return Object.freeze({ world: decodeWorldHash(`#${match[1]}`), lens: decodeWorldHash(`#${match[2] || ""}`) });
}
function worldFromPath(pathname = global.location.pathname) { return worldRoute(pathname).world; }
function worldLensFromPath(pathname = global.location.pathname) { return worldRoute(pathname).lens; }

function currentSurface(app) {
  const host = global.location.hostname.toLowerCase();
  const path = global.location.pathname;
  if (host === "idol.id" || host === "www.idol.id") return "site";
  if (["graph.idol.id", "r8a.idol.id", "r8b.idol.id", "r16.idol.id"].includes(host)) return "graph";
  if (host === "docs.idol.id") return "docs";
  if (host === "api.idol.id") return "api";
  if (host === "live.idol.id") return "live";
  if (host === "mcp.idol.id") return "mcp";
  if (host === "lib.idol.id" || host === "worlds.idol.id") {
    if (/^\/(?:atlas|world)(?:\/|$)/.test(path) || app === "worlds") return "worlds";
    if (/^\/universe(?:\/|$)/.test(path)) return "universe";
    return "lib";
  }
  if (host === "platform.idol.id") {
    if (/^\/ide(?:\/|$)/.test(path) || app === "ide") return "ide";
    if (/^\/repo(?:\/|$)/.test(path) || app === "repository") return "repository";
    if (/^\/universe(?:\/|$)/.test(path) || app === "universe") return "universe";
    return "platform";
  }
  return app || global.IDOL?.surface || "site";
}

function mainSurface(active) {
  if (["ide", "repository", "universe"].includes(active)) return "platform";
  if (active === "api" || active === "mcp" || active === "live") return active;
  return active;
}

function surfaceLabel(active) {
  return [...SURFACES, ...CONTEXTUAL].find((item) => item.id === active)?.label || active || "projection";
}

function link(item, here) {
  const node = document.createElement("a");
  node.href = item.href;
  node.textContent = item.label;
  node.title = item.title;
  if (here) {
    node.className = "here";
    node.setAttribute("aria-current", "page");
  }
  return node;
}

function createDrawer(active, toggle) {
  document.getElementById("idol-drawer")?.remove();
  const drawer = document.createElement("aside");
  drawer.id = "idol-drawer";
  drawer.className = "idol-drawer";
  drawer.hidden = true;
  drawer.setAttribute("aria-label", "Idol navigation");

  function section(label, items) {
    const root = document.createElement("section");
    root.className = "idol-drawer-section";
    const title = document.createElement("div");
    title.className = "idol-drawer-label";
    title.textContent = label;
    root.appendChild(title);
    for (const item of items) {
      const anchor = link(item, item.id === active || (item.id === "platform" && ["ide", "repository", "universe"].includes(active)));
      const detail = document.createElement("small");
      detail.textContent = item.detail;
      anchor.appendChild(detail);
      root.appendChild(anchor);
    }
    return root;
  }

  drawer.append(section("primary projections", SURFACES), section("tools and operations", CONTEXTUAL));
  document.body.appendChild(drawer);

  let priorFocus = null;
  function focusables() { return [...drawer.querySelectorAll("a[href],button:not([disabled])")]; }
  function setOpen(open, restore = true) {
    const changed = drawer.classList.contains("open") !== open;
    drawer.classList.toggle("open", open);
    drawer.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "close" : "menu";
    document.documentElement.classList.toggle("idol-nav-open", open);
    if (!changed) return;
    if (open) {
      priorFocus = document.activeElement;
      requestAnimationFrame(() => (drawer.querySelector("a.here") || focusables()[0])?.focus({ preventScroll: true }));
    } else if (restore) {
      (priorFocus instanceof HTMLElement ? priorFocus : toggle).focus({ preventScroll: true });
    }
  }

  toggle.addEventListener("click", () => setOpen(!drawer.classList.contains("open")));
  drawer.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false, false); });
  document.addEventListener("pointerdown", (event) => {
    if (!drawer.classList.contains("open") || drawer.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (!drawer.classList.contains("open")) return;
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    if (event.key !== "Tab") return;
    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  global.addEventListener("resize", () => { if (global.matchMedia("(min-width: 901px)").matches) setOpen(false, false); });
  return Object.freeze({ close: () => setOpen(false), open: () => setOpen(true) });
}

function defaultCommands() {
  return [...SURFACES, ...CONTEXTUAL].map((item) => ({
    id: `go:${item.id}`,
    label: item.title,
    detail: item.href.replace(/^https?:\/\//, ""),
    keywords: `${item.label} ${item.title} ${item.detail}`,
    run() { global.location.assign(item.href); },
  }));
}

function createCommandPalette(trigger) {
  document.getElementById("idol-command-backdrop")?.remove();
  const backdrop = document.createElement("div");
  backdrop.id = "idol-command-backdrop";
  backdrop.className = "idol-command-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="idol-command-panel" role="dialog" aria-modal="true" aria-label="Idol command palette">
      <input class="idol-command-input" type="search" autocomplete="off" spellcheck="false" placeholder="open a projection or run a local command…" aria-label="Find a command">
      <div class="idol-command-results" role="listbox"></div>
    </section>`;
  document.body.appendChild(backdrop);
  const input = backdrop.querySelector("input");
  const results = backdrop.querySelector(".idol-command-results");
  let visible = [];
  let selected = 0;
  let priorFocus = null;

  function commands() { return [...registeredCommands, ...defaultCommands()]; }
  function render() {
    const query = input.value.trim().toLowerCase();
    visible = commands().filter((command) => !query || `${command.label} ${command.detail || ""} ${command.keywords || ""}`.toLowerCase().includes(query));
    selected = Math.min(selected, Math.max(0, visible.length - 1));
    results.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "idol-command-empty";
      empty.textContent = "No matching projection or command.";
      results.appendChild(empty);
      return;
    }
    visible.forEach((command, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `idol-command-result${index === selected ? " selected" : ""}`;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === selected));
      const label = document.createElement("span");
      label.textContent = command.label;
      const detail = document.createElement("small");
      detail.textContent = command.detail || "local";
      button.append(label, detail);
      button.addEventListener("pointerenter", () => { selected = index; render(); });
      button.addEventListener("click", () => execute(index));
      results.appendChild(button);
    });
  }

  function execute(index = selected) {
    const command = visible[index];
    if (!command) return;
    close(false);
    Promise.resolve(command.run?.()).catch((error) => console.error("Idol command failed", error));
  }
  function open() {
    priorFocus = document.activeElement;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add("open");
      document.documentElement.classList.add("idol-command-open");
      input.value = "";
      selected = 0;
      render();
      input.focus({ preventScroll: true });
    });
  }
  function close(restore = true) {
    backdrop.classList.remove("open");
    document.documentElement.classList.remove("idol-command-open");
    backdrop.hidden = true;
    if (restore) (priorFocus instanceof HTMLElement ? priorFocus : trigger).focus({ preventScroll: true });
  }

  trigger.addEventListener("click", open);
  input.addEventListener("input", () => { selected = 0; render(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); selected = Math.min(selected + 1, visible.length - 1); render(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); selected = Math.max(0, selected - 1); render(); }
    else if (event.key === "Enter") { event.preventDefault(); execute(); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
  });
  backdrop.addEventListener("pointerdown", (event) => { if (event.target === backdrop) close(); });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      backdrop.classList.contains("open") ? close() : open();
    } else if (event.key === "Escape" && backdrop.classList.contains("open")) {
      event.preventDefault();
      close();
    }
  });
  return Object.freeze({ open, close, refresh: render });
}

function setCrumbs(list) {
  const root = document.getElementById("idol-context");
  if (!root) return;
  root.replaceChildren();
  (list || []).forEach((item, index) => {
    if (index) {
      const separator = document.createElement("span");
      separator.className = "sep";
      separator.textContent = "/";
      root.appendChild(separator);
    }
    if (typeof item.go === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label;
      button.addEventListener("click", item.go);
      root.appendChild(button);
    } else {
      const span = document.createElement("span");
      span.className = index === list.length - 1 ? "here" : "";
      span.textContent = item.label;
      root.appendChild(span);
    }
  });
}

function renderStatus(statusbar, opts) {
  if (!statusbar) return;
  statusbar.replaceChildren();
  if (opts.keys?.length) {
    const keys = document.createElement("div");
    keys.className = "keys";
    for (const [combo, meaning] of opts.keys) {
      const item = document.createElement("span");
      const key = document.createElement("kbd");
      key.textContent = combo;
      item.append(key, document.createTextNode(meaning));
      keys.appendChild(item);
    }
    statusbar.appendChild(keys);
  }
  const spacer = document.createElement("span");
  spacer.className = "spacer";
  const live = document.createElement("span");
  live.className = "live";
  live.textContent = "checking";
  const identity = document.createElement("span");
  identity.className = "identity";
  identity.textContent = global.IDOL?.authority ? `law ${String(global.IDOL.authority).slice(0, 9)}` : global.IDOL?.surface || "projection";
  statusbar.append(spacer, live, identity);
  const health = global.IDOL?.origin === false ? "/__idol/health" : "/health";
  fetch(health, { cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
    .then((value) => {
      live.textContent = value.status === "healthy" ? "● live" : "○ unavailable";
      live.style.color = value.status === "healthy" ? "var(--idol-ok)" : "var(--idol-danger)";
    })
    .catch(() => { live.textContent = "○ unavailable"; live.style.color = "var(--idol-danger)"; });
}

function boot(app, opts = {}) {
  ensureStudioStyles();
  const active = currentSurface(app);
  document.documentElement.dataset.idolSurface = active;
  document.body.dataset.idolSurface = active;
  document.title = `${opts.title || surfaceLabel(active)} — idol.id`;

  const bar = document.querySelector(".topbar") || (() => {
    const node = document.createElement("header");
    node.className = "topbar";
    (document.querySelector(".app") || document.body).prepend(node);
    return node;
  })();
  bar.replaceChildren();

  const brand = document.createElement("a");
  brand.className = "idol-brand";
  brand.href = "https://idol.id/";
  brand.setAttribute("aria-label", "Idol studio home");
  const mark = document.createElement("span");
  mark.className = "idol-mark";
  mark.setAttribute("aria-hidden", "true");
  const word = document.createElement("span");
  word.textContent = "IDOL";
  brand.append(mark, word);

  const context = document.createElement("div");
  context.className = "idol-context";
  context.id = "idol-context";
  context.textContent = surfaceLabel(active);
  const spacer = document.createElement("div");
  spacer.className = "idol-spacer";
  const nav = document.createElement("nav");
  nav.className = "idol-nav";
  nav.setAttribute("aria-label", "Idol projections");
  const activeMain = mainSurface(active);
  for (const item of SURFACES) nav.appendChild(link(item, item.id === activeMain));

  const command = document.createElement("button");
  command.className = "idol-command";
  command.type = "button";
  command.setAttribute("aria-label", "Open command palette");
  command.title = "Command palette (⌘K)";
  command.textContent = "⌘K";
  const menu = document.createElement("button");
  menu.className = "idol-menu";
  menu.type = "button";
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-controls", "idol-drawer");
  menu.setAttribute("aria-label", "Open Idol navigation");
  menu.textContent = "menu";
  bar.append(brand, context, spacer, nav, command, menu);

  const drawer = createDrawer(active, menu);
  commandState = createCommandPalette(command);
  renderStatus(document.querySelector(".statusbar"), opts);
  registeredCommands = [];
  setCrumbs([{ label: surfaceLabel(active) }]);

  const api = {
    active,
    decodeWorldHash,
    worldFromPath,
    worldLensFromPath,
    closeNavigation: drawer.close,
    openNavigation: drawer.open,
    openCommands: commandState.open,
    crumbs: setCrumbs,
    commands(items) {
      registeredCommands = Array.isArray(items) ? items.filter((item) => item && typeof item.label === "string" && typeof item.run === "function") : [];
      commandState?.refresh();
    },
    pivot(identity, lens = "identity") {
      if (!identity) return;
      const url = new URL("https://graph.idol.id/");
      url.searchParams.set("identity", String(identity));
      url.searchParams.set("lens", String(lens));
      global.location.assign(url);
    },
  };
  global.IdolShell = api;
  return api;
}

global.Shell = Object.freeze({ boot, apps: SURFACES, contextual: CONTEXTUAL, decodeWorldHash, worldFromPath, worldLensFromPath });
})(window);
