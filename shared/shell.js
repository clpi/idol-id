/* ============================================================================
   shell.js — common chrome for every idol.id face: topbar, nav, statusbar.
   ========================================================================== */
(function (global) {
"use strict";

const APPS = [
  { id: "graph",    label: "explorer", href: "https://graph.idol.id/",    title: "Explorer" },
  { id: "worlds",   label: "worlds",   href: "https://worlds.idol.id/",   title: "World Atlas" },
  { id: "lib",      label: "lib",      href: "https://lib.idol.id/",      title: "Registry" },
  { id: "docs",     label: "docs",     href: "https://docs.idol.id/",     title: "Docs" },
  { id: "api",      label: "api",      href: "https://api.idol.id/",      title: "API" },
  { id: "platform", label: "platform", href: "https://platform.idol.id/", title: "Platform" },
];

function ensureSurfaceStyles() {
  if (document.querySelector('link[href="/shared/surface.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/shared/surface.css";
  document.head.appendChild(link);
}

function boot(app, opts) {
  opts = opts || {};
  ensureSurfaceStyles();
  document.title = (opts.title || app) + " — idol.id";

  const bar = document.querySelector(".topbar") || (() => {
    const b = document.createElement("div"); b.className = "topbar";
    document.querySelector(".app").prepend(b); return b;
  })();

  bar.innerHTML = `
    <div class="brand"><span class="dot"></span><a href="https://idol.id/" style="border:0;color:inherit">IDOL</a></div>
    <div class="crumbs" id="crumbs"></div>
    <div class="spacer"></div>
    <nav class="nav" aria-label="Idol surfaces">
      ${APPS.map((a) => `<a href="${a.href}" class="${a.id === app ? "here" : ""}" title="${a.title}">${a.label}</a>`).join("")}
    </nav>`;

  const sb = document.querySelector(".statusbar");
  if (sb) {
    if (opts.keys) {
      const k = document.createElement("div");
      k.className = "keys";
      k.innerHTML = opts.keys.map(([combo, what]) =>
        `<span><kbd>${combo}</kbd>${what}</span>`).join("");
      sb.appendChild(k);
    }
    const sp = document.createElement("span");
    sp.className = "spacer"; sb.appendChild(sp);
    const live = document.createElement("span");
    live.className = "live"; live.textContent = "●";
    sb.appendChild(live);
    const inst = document.createElement("span");
    inst.className = "identity";
    inst.textContent = (window.IDOL && (window.IDOL.instance || window.IDOL.surface)) || "";
    sb.appendChild(inst);
    const health = window.IDOL && window.IDOL.origin === false ? "/__idol/health" : "/health";
    fetch(health).then((r) => r.json()).then((h) => {
      live.textContent = h.status === "healthy" ? "● live" : "○";
      live.style.color = h.status === "healthy" ? "var(--signal)" : "var(--danger)";
    }).catch(() => { live.textContent = "○"; live.style.color = "var(--danger)"; });
  }

  global.IdolShell = { crumbs(list) {
    const c = document.getElementById("crumbs");
    if (!c) return;
    c.innerHTML = "";
    (list || []).forEach((item, i) => {
      if (i) { const s = document.createElement("span"); s.className = "sep"; s.textContent = "/"; c.appendChild(s); }
      const cr = document.createElement("span");
      cr.className = "crumb" + (i === list.length - 1 ? " here" : "");
      cr.textContent = item.label;
      if (item.go) {
        cr.style.cursor = "pointer";
        cr.addEventListener("click", item.go);
      }
      c.appendChild(cr);
    });
  }};
  return global.IdolShell;
}

global.Shell = { boot, apps: APPS };

})(window);
