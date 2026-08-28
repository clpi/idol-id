/* Homepage product convergence: Lib is the product; Atlas is one Lib lens. */
(function siteProductConvergence() {
  "use strict";
  function apply() {
    const registry = document.querySelector('a.cell-a[href="https://lib.idol.id/"]');
    const atlas = document.querySelector('a.cell-a[href="https://worlds.idol.id/"]');
    if (!registry) return;

    const card = document.createElement("section");
    card.className = `${registry.className} library-product`;
    const primary = document.createElement("a");
    primary.className = "product-primary";
    primary.href = "https://lib.idol.id/";
    while (registry.firstChild) primary.appendChild(registry.firstChild);
    const name = primary.querySelector(".n");
    const address = primary.querySelector(".u");
    const description = primary.querySelector(".d");
    if (name) name.textContent = "Library worlds";
    if (address) address.textContent = "LIB.IDOL.ID";
    if (description) description.textContent = "The public registry of admitted world projections, exact source, graph facts, versions, artifacts, provenance, and evidence. Package coordinates remain provenance; homes remain reach and provenance.";

    const lenses = document.createElement("nav");
    lenses.className = "product-lenses";
    lenses.setAttribute("aria-label", "Library-world projections");
    for (const [label, href] of [["worlds", "https://lib.idol.id/"], ["atlas", "https://lib.idol.id/atlas"], ["homes", "https://lib.idol.id/?set=homes"], ["universe", "https://lib.idol.id/universe"]]) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      lenses.appendChild(link);
    }
    card.append(primary, lenses);
    registry.replaceWith(card);
    atlas?.remove();

    if (!document.getElementById("idol-product-convergence-style")) {
      const style = document.createElement("style");
      style.id = "idol-product-convergence-style";
      style.textContent = `.library-product{display:flex;flex-direction:column}.product-primary{display:block;min-height:0;flex:1;border:0;color:inherit}.product-lenses{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px;position:relative;z-index:2}.product-lenses a{min-height:34px;display:inline-flex;align-items:center;padding:0 9px;border:1px solid var(--rule-2);border-radius:999px;color:var(--ink-4);font:10px/1 var(--mono)}.product-lenses a:hover{color:var(--ink);border-color:var(--rule-3)}@media(max-width:699px){.product-lenses a{min-height:44px}}`;
      document.head.appendChild(style);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})();
