/* Canonicalize public world/Universe presentation links beneath Lib.
   This changes URLs only; it does not alter semantic records or authority. */
(function productCanonical(global) {
  "use strict";
  const canonicalOrigin = "https://lib.idol.id";
  function canonicalHref(value) {
    let url;
    try { url = new URL(value, global.location.href); } catch { return value; }
    if (url.hostname !== "worlds.idol.id") return value;
    return `${canonicalOrigin}${url.pathname}${url.search}${url.hash}`;
  }
  function reconcile(root = document) {
    root.querySelectorAll?.('a[href*="worlds.idol.id"]').forEach((anchor) => {
      anchor.href = canonicalHref(anchor.href);
      if (/worlds\.idol\.id/i.test(anchor.textContent || "")) {
        anchor.textContent = (anchor.textContent || "").replace(/worlds\.idol\.id/gi, "lib.idol.id");
      }
    });
  }
  if (global.location.hostname === "lib.idol.id" && /^\/universe(?:\/|$)/.test(global.location.pathname)) {
    const url = new URL(global.location.href);
    if (url.searchParams.get("mode") !== "public") {
      url.searchParams.set("mode", "public");
      global.history.replaceState(global.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => reconcile(), { once: true });
  else reconcile();
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) reconcile(node);
  }).observe(document.documentElement, { childList: true, subtree: true });
})(window);
