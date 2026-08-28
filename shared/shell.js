/* ============================================================================
   shell.js — shared product chrome for every idol.id projection.
   ========================================================================== */
(function (global) {
"use strict";

const APPS = Object.freeze([
  { id: "graph", label: "explorer", href: "https://graph.idol.id/", title: "Semantic Observatory" },
  { id: "ide", label: "ide", href: "https://platform.idol.id/ide", title: "Browser IDE" },
  { id: "worlds", label: "worlds", href: "https://worlds.idol.id/", title: "World Atlas" },
  { id: "lib", label: "lib", href: "https://lib.idol.id/", title: "Registry" },
  { id: "docs", label: "docs", href: "https://docs.idol.id/", title: "Law and documentation" },
  { id: "api", label: "api", href: "https://api.idol.id/", title: "Semantic API" },
  { id: "platform", label: "platform", href: "https://platform.idol.id/", title: "Platform" },
]);

const CONTEXTUAL = Object.freeze([
  { label: "public universe views", href: "https://worlds.idol.id/universe", title: "Public operational projections" },
  { label: "manage universe views", href: "https://platform.idol.id/universe", title: "Authenticated Universe management" },
  { label: "repository observatory", href: "https://platform.idol.id/repo", title: "Authenticated Repository Observatory" },
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

function worldFromPath(pathname = global.location.pathname) {
  return worldRoute(pathname).world;
}

function worldLensFromPath(pathname = global.location.pathname) {
  return worldRoute(pathname).lens;
}

function sanitiseHash() {
  const hash = global.location.hash;
  if (!hash || hash === "#" || decodeWorldHash(hash)) return;
  global.history.replaceState(null, "", global.location.pathname + global.location.search);
}

function prepareWorldRoute(app) {
  if (app !== "worlds" || decodeWorldHash()) return;
  const requested = worldFromPath();
  if (!requested) return;
  global.history.replaceState(null, "", `${global.location.pathname}${global.location.search}#${encodeURIComponent(requested)}`);
}

function bindWorldHistory(app) {
  if (app !== "worlds" || global.__idolWorldHistoryBound) return;
  global.__idolWorldHistoryBound = true;
  global.addEventListener("popstate", () => global.location.reload());
}

function activeApp(candidate, app) {
  const path = global.location.pathname;
  const host = global.location.hostname;
  if (host === "platform.idol.id" && /^\/ide(?:\/|$)/.test(path)) return candidate.id === "ide";
  if (host === "worlds.idol.id" && /^\/universe(?:\/|$)/.test(path)) return candidate.id === "worlds";
  if (host === "platform.idol.id" && /^\/universe(?:\/|$)/.test(path)) return candidate.id === "platform";
  return candidate.id === app;
}

function linkMarkup(item, here = false) {
  return `<a href="${item.href}" class="${here ? "here" : ""}" title="${item.title}">${item.label}</a>`;
}

function createMobilePanel(app, toggle) {
  const panel = document.createElement("div");
  panel.className = "nav-panel";
  panel.id = "idol-nav-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Idsem navigation");
  panel.innerHTML = `
    <nav class="nav-panel-primary" aria-label="Idsem products">
      ${APPS.map((item) => linkMarkup(item, activeApp(item, app))).join("")}
    </nav>
    <div class="nav-panel-context" aria-label="Contextual projections">
      <div class="nav-panel-label">contextual projections</div>
      ${CONTEXTUAL.map((item) => linkMarkup(item)).join("")}
    </div>`;
  document.body.appendChild(panel);

  let priorFocus = null;
  const focusable = () => [...panel.querySelectorAll("a[href],button:not([disabled])")];

  function setOpen(open, restoreFocus = true) {
    const changed = panel.classList.contains("open") !== open;
    panel.classList.toggle("open", open);
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close Idsem navigation" : "Open Idsem navigation");
    document.documentElement.classList.toggle("nav-open", open);
    if (!changed) return;
    if (open) {
      priorFocus = document.activeElement;
      focusable()[0]?.focus({ preventScroll: true });
    } else if (restoreFocus) {
      const target = priorFocus instanceof HTMLElement ? priorFocus : toggle;
      target.focus({ preventScroll: true });
    }
  }

  toggle.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false, false);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!panel.classList.contains("open")) return;
    if (panel.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (!panel.classList.contains("open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const targets = focusable();
    if (!targets.length) return;
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  global.addEventListener("resize", () => {
    if (global.matchMedia("(min-width: 901px)").matches) setOpen(false, false);
  });

  return { panel, close: () => setOpen(false) };
}

function boot(app, opts) {
  opts = opts || {};
  sanitiseHash();
  prepareWorldRoute(app);
  bindWorldHistory(app);
  ensureSurfaceStyles();
  document.title = `${opts.title || app} — idol.id`;

  const bar = document.querySelector(".topbar") || (() => {
    const element = document.createElement("div");
    element.className = "topbar";
    document.querySelector(".app")?.prepend(element);
    return element;
  })();

  bar.innerHTML = `
    <div class="brand"><span class="dot"></span><a href="https://idol.id/" style="border:0;color:inherit">IDSEM</a></div>
    <div class="crumbs" id="crumbs"></div>
    <div class="spacer"></div>
    <nav class="nav nav-desktop" aria-label="Idsem products">
      ${APPS.map((item) => linkMarkup(item, activeApp(item, app))).join("")}
    </nav>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="idol-nav-panel" aria-label="Open Idsem navigation"><span aria-hidden="true">menu</span></button>`;

  const toggle = bar.querySelector(".nav-toggle");
  const navigation = createMobilePanel(app, toggle);

  const statusbar = document.querySelector(".statusbar");
  if (statusbar) {
    statusbar.replaceChildren();
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
    identity.textContent = (global.IDOL && (global.IDOL.instance || global.IDOL.surface)) || "";
    statusbar.appendChild(identity);
    const health = global.IDOL && global.IDOL.origin === false ? "/__idol/health" : "/health";
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
    closeNavigation: navigation.close,
    crumbs(list) {
      const crumbs = document.getElementById("crumbs");
      if (!crumbs) return;
      crumbs.replaceChildren();
      (list || []).forEach((item, index) => {
        if (index) {
          const separator = document.createElement("span");
          separator.className = "sep";
          separator.textContent = "/";
          crumbs.appendChild(separator);
        }
        const crumb = document.createElement("span");
        crumb.className = `crumb${index === list.length - 1 ? " here" : ""}`;
        crumb.textContent = item.label;
        if (item.go) {
          crumb.style.cursor = "pointer";
          crumb.addEventListener("click", item.go);
        }
        crumbs.appendChild(crumb);
      });
    },
  };
  return global.IdolShell;
}

global.Shell = { boot, apps: APPS, contextual: CONTEXTUAL, decodeWorldHash, worldFromPath, worldLensFromPath };
})(window);