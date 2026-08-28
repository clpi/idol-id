(function siteEnhancement() {
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

function bindEditorMode() {
  const shell = document.querySelector(".demo-shell");
  const button = document.querySelector('[data-demo-action="edit"]');
  const input = document.querySelector("#demo-editor .editor-input");
  if (!shell || !button || !input) return;

  function setMode(mode, focus = false) {
    const editing = mode === "edit";
    shell.dataset.editorMode = editing ? "edit" : "inspect";
    input.style.pointerEvents = editing ? "auto" : "none";
    input.tabIndex = editing ? 0 : -1;
    button.textContent = editing ? "inspect" : "edit";
    button.setAttribute("aria-pressed", String(editing));
    button.setAttribute("aria-label", editing ? "Inspect exact highlighted tokens" : "Edit Idol source");
    if (editing && focus) input.focus({ preventScroll: true });
  }

  button.addEventListener("click", () => setMode(shell.dataset.editorMode === "edit" ? "inspect" : "edit", true));
  setMode("inspect");
}

function install() {
  for (const button of document.querySelectorAll("[data-copy-command]")) {
    button.addEventListener("click", () => copy(button));
  }
  bindEditorMode();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();
})();
