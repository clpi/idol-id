/* Presentation-only convergence for Lib. Semantic/world identity remains compiler-owned. */
(function libCanonical(global) {
  "use strict";
  function apply() {
    const atlas = document.querySelector('.lensbar a[href*="worlds.idol.id/"]:not([href*="/universe"])');
    const universe = document.querySelector('.lensbar a[href*="worlds.idol.id/universe"]');
    if (atlas) atlas.href = "/atlas";
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})(window);
