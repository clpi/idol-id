/* Session-gated entry for the protected browser IDE.
   The Platform app owns session admission by toggling #signed-in. This adapter
   exposes /ide only while that admitted session pane is visible. */
(function installPlatformIdeEntry(global) {
"use strict";

function install() {
  const signedIn = document.getElementById("signed-in");
  if (!signedIn || document.getElementById("platform-ide-entry")) return;

  const container = document.createElement("div");
  container.id = "platform-ide-entry";
  container.hidden = true;
  container.style.marginBottom = "18px";
  container.style.padding = "14px";
  container.style.border = "1px solid var(--rule-2)";
  container.style.borderRadius = "12px";
  container.style.background = "rgba(114,200,208,.035)";

  const title = document.createElement("strong");
  title.textContent = "Local-first browser IDE";
  title.style.display = "block";
  title.style.marginBottom = "7px";

  const note = document.createElement("p");
  note.textContent = "Source stays in this browser until you explicitly request remote-native analysis.";
  note.style.margin = "0 0 12px";
  note.style.color = "var(--ink-3)";
  note.style.lineHeight = "1.55";

  const link = document.createElement("a");
  link.className = "button primary";
  link.href = "/ide";
  link.textContent = "Open browser IDE";

  container.append(title, note, link);
  signedIn.prepend(container);

  const render = () => {
    container.hidden = signedIn.hidden;
  };
  new MutationObserver(render).observe(signedIn, { attributes: true, attributeFilter: ["hidden"] });
  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();

})(window);
