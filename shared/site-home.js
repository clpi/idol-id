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

  async function loadAuthorityExample() {
    const frame = document.querySelector("[data-source-manifest][data-source-example]");
    if (!frame) return;
    const source = document.getElementById("authority-example-source");
    const title = document.getElementById("authority-example-title");
    const status = document.getElementById("authority-example-status");
    const note = document.getElementById("authority-example-note");
    try {
      const response = await fetch(frame.dataset.sourceManifest, { headers: { accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`source example request failed: ${response.status}`);
      const manifest = await response.json();
      const example = Array.isArray(manifest.examples)
        ? manifest.examples.find((candidate) => candidate?.id === frame.dataset.sourceExample)
        : null;
      if (!example || typeof example.source !== "string" || typeof example.title !== "string" || typeof example.status !== "string") {
        throw new Error("authority example is missing or malformed");
      }
      if (source) source.textContent = example.source;
      if (title) title.textContent = `source law · ${example.title}`;
      if (status) status.textContent = example.status;
      if (note) note.textContent = String(manifest.rule || "This source is a law projection and does not claim implementation support.");
    } catch {
      if (note) note.textContent = "Authority example manifest unavailable. Showing the embedded exact fallback; no implementation support is claimed.";
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
    loadAuthorityExample();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
