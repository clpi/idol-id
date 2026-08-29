(() => {
  "use strict";

  const short = (value, size = 12) => {
    const text = String(value || "");
    return text ? text.slice(0, size) : "unavailable";
  };

  async function loadIdentity() {
    const targets = {
      commit: document.getElementById("deployment-commit"),
      authority: document.getElementById("language-authority"),
      sourceLaw: document.getElementById("source-law"),
    };
    try {
      const response = await fetch("/__idol/version", { headers: { accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`identity request failed: ${response.status}`);
      const value = await response.json();
      if (targets.commit) {
        targets.commit.textContent = short(value.commit);
        targets.commit.title = String(value.commit || "");
      }
      if (targets.authority) {
        targets.authority.textContent = short(value.authority);
        targets.authority.title = String(value.authority || "");
      }
      if (targets.sourceLaw) {
        targets.sourceLaw.textContent = short(value.source_law);
        targets.sourceLaw.title = String(value.source_law || "");
      }
    } catch {
      for (const target of Object.values(targets)) {
        if (target) target.textContent = "unavailable";
      }
    }
  }

  async function copyText(button) {
    const source = document.getElementById(button.dataset.copy || "");
    if (!source) return;
    const value = source.textContent || "";
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(source);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("copy");
      selection?.removeAllRanges();
    }
    const previous = button.textContent;
    button.textContent = "Copied";
    button.classList.add("copied");
    window.setTimeout(() => {
      button.textContent = previous;
      button.classList.remove("copied");
    }, 1400);
  }

  function boot() {
    document.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", () => copyText(button));
    });
    loadIdentity();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
