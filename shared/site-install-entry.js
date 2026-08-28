(function installEntry() {
"use strict";

async function copy(button) {
  const command = button.dataset.copyCommand || "";
  if (!command) return;
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(command);
    button.textContent = "copied";
    button.dataset.copyState = "copied";
  } catch {
    button.textContent = "select command";
    button.dataset.copyState = "unavailable";
    const code = button.closest(".install-command")?.querySelector("code");
    const selection = globalThis.getSelection?.();
    if (code && selection) {
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  setTimeout(() => {
    button.textContent = original;
    delete button.dataset.copyState;
  }, 1300);
}

function install() {
  for (const button of document.querySelectorAll("[data-copy-command]")) {
    button.addEventListener("click", () => copy(button));
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();
})();
