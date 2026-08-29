/* Presentation-only convergence for canonical Lib and world projections. */
(function libCanonical(global) {
  "use strict";

  function stylesheet(path) {
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => new URL(link.href, location.href).pathname === path)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = path;
    document.head.appendChild(link);
  }

  function convergeRegistry() {
    const lensbar = document.querySelector(".lensbar");
    if (!lensbar) return false;
    const links = [...lensbar.querySelectorAll("a")];
    const published = links.find((link) => link.textContent.trim().toLowerCase() === "published");
    const atlas = links.find((link) => link.textContent.trim().toLowerCase() === "atlas");
    const homes = links.find((link) => link.textContent.trim().toLowerCase() === "homes");
    const universe = links.find((link) => link.textContent.trim().toLowerCase() === "universe");
    if (published) published.href = "/";
    if (atlas) atlas.href = "/atlas";
    if (homes) homes.href = "/?set=homes";
    if (universe) universe.href = "/universe";

    const boundary = document.querySelector(".boundary-note");
    if (boundary) {
      boundary.replaceChildren();
      const strong = document.createElement("strong");
      strong.textContent = "Lib publishes admitted world projections and their package provenance.";
      boundary.append(strong, document.createTextNode(" A package coordinate is provenance, not semantic identity or authority. A home is reach and provenance, not a world."));
    }
    document.documentElement.dataset.idolProduct = "admitted-world-registry-projection";
    return true;
  }

  function convergeAtlas() {
    if (!document.querySelector(".atlas")) return false;
    // Worlds title/H1/boundary/canonical route are static in apps/worlds/index.html;
    // this projection preserves only its distinct idempotent product identity.
    document.documentElement.dataset.idolProduct = "compiler-published-world-projection";
    return true;
  }

  function apply() {
    if (!convergeRegistry()) convergeAtlas();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})(window);