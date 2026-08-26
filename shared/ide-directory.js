/* Local directory import adapter.
   It never uploads files. The existing IDE file-import handler remains the one
   workspace mutation path; this adapter supplies relative paths to it. */
(function installIdolDirectoryImport() {
"use strict";

function install() {
  const ordinary = document.getElementById("import-files");
  const directory = document.getElementById("directory-input");
  const fileInput = document.getElementById("file-input");
  if (!ordinary || !directory || !fileInput || document.getElementById("import-directory")) return;

  ordinary.textContent = "files";
  const button = document.createElement("button");
  button.id = "import-directory";
  button.type = "button";
  button.textContent = "directory";
  ordinary.after(button);
  button.addEventListener("click", () => directory.click());

  directory.addEventListener("change", async (event) => {
    const handler = fileInput.onchange;
    if (typeof handler !== "function") {
      globalThis.Idol?.toast?.("Directory import is not ready", true);
      return;
    }
    const files = [...(event.target.files || [])].map((file) => Object.freeze({
      name: String(file.webkitRelativePath || file.name),
      text: () => file.text(),
    }));
    try {
      await handler({ target: { files, value: "" } });
    } finally {
      event.target.value = "";
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();

})();
