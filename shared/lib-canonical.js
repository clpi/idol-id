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
    if (!lensbar) return;
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
  }

  function convergeAtlas() {
    const atlas = document.querySelector("main.atlas");
    if (!atlas) return;
    stylesheet("/shared/worlds-canonical.css");
    document.title = "Worlds — Idol";
    const eyebrow = document.querySelector(".atlas-head .eyebrow");
    const heading = document.querySelector(".atlas-head h1");
    const lede = document.querySelector(".atlas-head p");
    if (eyebrow) eyebrow.textContent = "@ · compiler-published projection";
    if (heading) heading.textContent = "Worlds";
    if (lede) lede.textContent = "Published world facts and provenance-qualified foreign candidates. This surface exposes explicit uncertainty, obligations, evidence, and refusal; it does not mint semantic identity, equivalence, or authority.";
    const actions = document.querySelector(".atlas-head-actions");
    if (actions && !actions.querySelector(".canonical-route")) {
      const route = document.createElement("div");
      route.className = "canonical-route";
      route.textContent = "canonical: lib.idol.id/atlas · worlds.idol.id remains a path-preserving compatibility alias";
      actions.insertAdjacentElement("afterend", route);
    }
    document.documentElement.dataset.idolProduct = "compiler-published-world-projection";
  }

  function apply() {
    convergeRegistry();
    convergeAtlas();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})(window);
