/* Session-gated entry for the protected Repository Observatory.
   This adapter owns the public Program M/Program N presentation and repository
   token-scope controls so the Platform shell cannot drift from deployed
   transport or authority boundaries. */
(function installPlatformRepositoryEntry(global) {
"use strict";

const REPOSITORY_SCOPES = Object.freeze([
  "repository:read",
  "repository:observe",
  "repository:scaffold",
  "repository:transform",
]);

function programCard(letter) {
  const wanted = `program ${letter}`.toLowerCase();
  return [...document.querySelectorAll(".program")].find((card) => {
    const mark = card.querySelector(".mark");
    return String(mark?.textContent || "").trim().toLowerCase() === wanted;
  }) || null;
}

function replaceFacts(card, values) {
  const facts = card?.querySelector(".facts");
  if (!facts) return;
  facts.replaceChildren(...values.map((value) => {
    const fact = document.createElement("span");
    fact.className = "fact";
    fact.textContent = value;
    return fact;
  }));
}

function setProgram(card, { statusText, titleText, copyText, facts }) {
  if (!card) return;
  const status = card.querySelector(".status");
  if (status) {
    status.textContent = statusText;
    status.classList.remove("planned");
    status.classList.add("live");
  }
  const title = card.querySelector("h3");
  if (title) title.textContent = titleText;
  const copy = card.querySelector("p");
  if (copy) copy.textContent = copyText;
  replaceFacts(card, facts);
}

function reconcileProgramCards() {
  setProgram(programCard("M"), {
    statusText: "live",
    titleText: "Repository Observatory",
    copyText: "Observe one exact public GitHub, GitLab, or Bitbucket revision and generate review-only Idol scaffold patches. No provider credential, source checkout, or repository write.",
    facts: ["public metadata", "exact revisions", "review-only patch"],
  });
  setProgram(programCard("N"), {
    statusText: "preview live",
    titleText: "Derived-world transformation previews",
    copyText: "Project one exact scaffold delta into an isolated derived-world preview with digest, grants, and unresolved evidence. Nothing executes, mutates a repository, or publishes a world.",
    facts: ["exact delta", "derived isolation", "unexecuted evidence"],
  });
}

function ensureRepositoryScopes() {
  const grid = document.querySelector("#token-form .scope-grid") || document.querySelector(".scope-grid");
  if (!grid) return;
  const existing = new Set(
    [...grid.querySelectorAll('input[name="scope"]')]
      .map((input) => String(input.value || "").trim())
      .filter(Boolean),
  );
  for (const scope of REPOSITORY_SCOPES) {
    if (existing.has(scope)) continue;
    const label = document.createElement("label");
    label.className = "scope";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "scope";
    input.value = scope;
    const code = document.createElement("code");
    code.textContent = scope;
    label.append(input, code);
    grid.append(label);
    existing.add(scope);
  }
}

function install() {
  reconcileProgramCards();
  ensureRepositoryScopes();

  const signed = document.getElementById("signed-in");
  if (!signed || document.getElementById("platform-repository-entry")) return;
  const card = document.createElement("div");
  card.id = "platform-repository-entry";
  card.hidden = true;
  card.style.cssText = "margin-bottom:18px;padding:14px;border:1px solid var(--rule-2);border-radius:12px;background:rgba(114,200,208,.035)";
  card.innerHTML = '<strong style="display:block;margin-bottom:7px">Repository Observatory</strong><p style="margin:0 0 12px;color:var(--ink-3);line-height:1.55">Resolve an exact public revision, preview an Idol scaffold, and project a non-executing derived-world transformation. No provider credential, source checkout, repository write, or world publication.</p><a class="button primary" href="/repo">Open repository workbench</a>';
  signed.prepend(card);
  const render = () => { card.hidden = signed.hidden; };
  new MutationObserver(render).observe(signed, { attributes: true, attributeFilter: ["hidden"] });
  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();

})(window);
