/* Public Universe is a Lib lens. This presentation adapter runs before the
   Universe module and does not alter semantic records or mint identities. */
(function universeCanonical(global) {
  "use strict";

  const canonicalOrigin = "https://lib.idol.id";
  const publicPath = /^\/universe(?:\/|$)/;

  if (global.location.hostname === "lib.idol.id" && publicPath.test(global.location.pathname)) {
    const url = new URL(global.location.href);
    if (url.searchParams.get("mode") !== "public") {
      url.searchParams.set("mode", "public");
      global.history.replaceState(global.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function canonicalHref(value) {
    let url;
    try { url = new URL(value, global.location.href); } catch { return value; }
    if (url.hostname !== "worlds.idol.id") return value;
    return `${canonicalOrigin}${url.pathname}${url.search}${url.hash}`;
  }

  function reconcile(root = document) {
    root.querySelectorAll?.('a[href*="worlds.idol.id"]').forEach((anchor) => {
      const next = canonicalHref(anchor.href);
      if (next !== anchor.href) anchor.href = next;
      if (/worlds\.idol\.id/i.test(anchor.textContent || "")) {
        anchor.textContent = (anchor.textContent || "").replace(/worlds\.idol\.id/gi, "lib.idol.id");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => reconcile(), { once: true });
  } else {
    reconcile();
  }
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) reconcile(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})(window);
