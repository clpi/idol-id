/* ============================================================================
   shell.js — common chrome for every idol.id face.
   Product navigation is a presentation projection only. Lib owns world views;
   Universe is a view over the one semantic universe, not a separate product.
   ========================================================================== */
(function (global) {
"use strict";

const APPS = Object.freeze([
  { id: "graph", label: "explorer", href: "https://graph.idol.id/", title: "Semantic Observatory" },
  { id: "ide", label: "ide", href: "https://platform.idol.id/ide", title: "Browser IDE" },
  { id: "lib", label: "lib", href: "https://lib.idol.id/", title: "Library worlds" },
  { id: "docs", label: "docs", href: "https://docs.idol.id/", title: "Docs" },
  { id: "api", label: "api", href: "https://api.idol.id/", title: "API" },
  { id: "repo", label: "repos", href: "https://platform.idol.id/repo", title: "Repository Observatory", repository: true },
  { id: "platform", label: "platform", href: "https://platform.idol.id/", title: "Platform" },
]);

const LIB_LENSES = Object.freeze([
  { label: "published worlds", href: "https://lib.idol.id/" },
  { label: "world atlas", href: "https://lib.idol.id/atlas" },
  { label: "universe views", href: "https://lib.idol.id/universe" },
  { label: "source homes", href: "https://lib.idol.id/?set=homes" },
]);

function ensureSurfaceStyles() {
  if (document.querySelector('link[href="/shared/surface.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/shared/surface.css";
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
  return Object.freeze({
    world: decodeWorldHash(`#${match[1]}`),
    lens: decodeWorldHash(`#${match[2] || ""}`),
  });
}

function worldFromPath(pathname = global.location.pathname) { return worldRoute(pathname).world; }
function worldLensFromPath(pathname = global.location.pathname) { return worldRoute(pathname).lens; }

function sanitiseHash() {
  const hash = global.location.hash;
  if (!hash || hash === "#" || decodeWorldHash(hash)) return;
  global.history.replaceState(null, "", global.location.pathname + global.location.search);
}

function isWorldLens(app) {
  return app === "worlds" || (global.location.hostname === "lib.idol.id" && /^\/(?:atlas|world)(?:\/|$)/.test(global.location.pathname));
}

function prepareWorldRoute(app) {
  if (!isWorldLens(app) || decodeWorldHash()) return;
  const requested = worldFromPath();
  if (!requested) return;
  global.history.replaceState(null, "", `${global.location.pathname}${global.location.search}#${encodeURIComponent(requested)}`);
}

function bindWorldHistory(app) {
  if (!isWorldLens(app) || global.__idolWorldHistoryBound) return;
  global.__idolWorldHistoryBound = true;
  global.addEventListener("popstate", () => global.location.reload());
}

function activeApp(candidate, app) {
  const path = global.location.pathname;
  const host = global.location.hostname;
  if (host === "platform.idol.id" && /^\/ide(?:\/|$)/.test(path)) return candidate.id === "ide";
  if (host === "platform.idol.id" && /^\/repo(?:\/|$)/.test(path)) return candidate.id === "repo";
  if (host === "lib.idol.id" || host === "worlds.idol.id" || app === "worlds" || app === "universe") return candidate.id === "lib";
  return candidate.id === app;
}

function navLink(app, current, className = "") {
  const repository = app.repository ? ' data-idol-repository=""' : "";
  const active = current ? " here" : "";
  const aria = current ? ' aria-current="page"' : "";
  return `<a href="${app.href}" class="${className}${active}" title="${app.title}"${repository}${aria}>${app.label}</a>`;
}

function installMobilePanel(bar, app) {
  let panel = document.getElementById("idol-nav-panel");
  if (panel) panel.remove();
  panel = document.createElement("aside");
  panel.id = "idol-nav-panel";
  panel.className = "nav-panel";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <div class="nav-panel-head"><span>idol surfaces</span><button class="nav-close" type="button" aria-label="Close navigation">×</button></div>
    <nav class="nav-panel-primary" aria-label="Idol product surfaces">${APPS.map((entry) => navLink(entry, activeApp(entry, app), "nav-panel-link")).join("")}</nav>
    <div class="nav-panel-group"><div class="nav-panel-label">lib lenses</div>${LIB_LENSES.map((entry) => `<a class="nav-panel-link secondary" href="${entry.href}">${entry.label}</a>`).join("")}</div>`;
  bar.insertAdjacentElement("afterend", panel);

  const toggle = bar.querySelector(".nav-toggle");
  const close = panel.querySelector(".nav-close");
  let returnFocus = null;
  const setOpen = (open) => {
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", String(!open));
    toggle.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("nav-open", open);
    if (open) {
      returnFocus = document.activeElement;
      (panel.querySelector("a.here") || panel.querySelector("a") || close).focus();
    } else if (returnFocus && typeof returnFocus.focus === "function") {
      returnFocus.focus();
    }
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  close.addEventListener("click", () => setOpen(false));
  panel.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
  global.addEventListener("keydown", (event) => { if (event.key === "Escape" && panel.classList.contains("open")) setOpen(false); });
  global.addEventListener("resize", () => { if (global.innerWidth >= 700 && panel.classList.contains("open")) setOpen(false); });
}

function boot(app, opts) {
  opts = opts || {};
  sanitiseHash();
  prepareWorldRoute(app);
  bindWorldHistory(app);
  ensureSurfaceStyles();
  document.title = (opts.title || app) + " — idol.id";

  const bar = document.querySelector(".topbar") || (() => {
    const node = document.createElement("div");
    node.className = "topbar";
    document.querySelector(".app").prepend(node);
    return node;
  })();

  bar.innerHTML = `
    <div class="brand"><span class="dot"></span><a href="https://idol.id/" style="border:0;color:inherit">IDOL</a></div>
    <div class="crumbs" id="crumbs"></div>
    <div class="spacer"></div>
    <nav class="nav nav-desktop" aria-label="Idol surfaces">${APPS.map((entry) => navLink(entry, activeApp(entry, app))).join("")}</nav>
    <button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="idol-nav-panel"><span>menu</span><span aria-hidden="true">≡</span></button>`;
  installMobilePanel(bar, app);

  const statusbar = document.querySelector(".statusbar");
  if (statusbar) {
    statusbar.innerHTML = "";
    if (opts.keys) {
      const keys = document.createElement("div");
      keys.className = "keys";
      keys.innerHTML = opts.keys.map(([combo, what]) => `<span><kbd>${combo}</kbd>${what}</span>`).join("");
      statusbar.appendChild(keys);
    }
    const spacer = document.createElement("span");
    spacer.className = "spacer";
    statusbar.appendChild(spacer);
    const live = document.createElement("span");
    live.className = "live";
    live.textContent = "●";
    statusbar.appendChild(live);
    const identity = document.createElement("span");
    identity.className = "identity";
    identity.textContent = (window.IDOL && (window.IDOL.instance || window.IDOL.surface)) || "";
    statusbar.appendChild(identity);
    const health = window.IDOL && window.IDOL.origin === false ? "/__idol/health" : "/health";
    fetch(health).then((response) => response.json()).then((value) => {
      live.textContent = value.status === "healthy" ? "● live" : "○";
      live.style.color = value.status === "healthy" ? "var(--signal)" : "var(--danger)";
    }).catch(() => {
      live.textContent = "○";
      live.style.color = "var(--danger)";
    });
  }

  global.IdolShell = {
    decodeWorldHash,
    worldFromPath,
    worldLensFromPath,
    crumbs(list) {
      const container = document.getElementById("crumbs");
      if (!container) return;
      container.innerHTML = "";
      (list || []).forEach((item, index) => {
        if (index) {
          const separator = document.createElement("span");
          separator.className = "sep";
          separator.textContent = "/";
          container.appendChild(separator);
        }
        const crumb = document.createElement("span");
        crumb.className = "crumb" + (index === list.length - 1 ? " here" : "");
        crumb.textContent = item.label;
        if (item.go) {
          crumb.style.cursor = "pointer";
          crumb.addEventListener("click", item.go);
        }
        container.appendChild(crumb);
      });
    },
  };
  return global.IdolShell;
}

global.Shell = { boot, apps: APPS, decodeWorldHash, worldFromPath, worldLensFromPath };
})(window);
