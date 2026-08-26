/* Session-gated entry for the protected Repository Observatory.
   This adapter also owns the public Program M presentation and repository
   token-scope controls so the classic Platform shell cannot drift from the
   deployed transport contract. */
(function installPlatformRepositoryEntry(global) {
"use strict";

const REPOSITORY_SCOPES = Object.freeze([
  "repository:read",
  "repository:observe",
  "repository:scaffold",
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

function reconcileProgramCard() {
  const card = programCard("M");
  if (!card) return;
  const status = card.querySelector(".status");
  if (status) {
    status.textContent = "live";
    status.classList.remove("planned");
    status.classList.add("live");
  }
  const title = card.querySelector("h3");
  if (title) title.textContent = "Repository Observatory";
  const copy = card.querySelector("p");
  if (copy) {
    copy.textContent = "Observe one exact public GitHub, GitLab, or Bitbucket revision and generate review-only Idol scaffold patches. No provider credential, source checkout, or repository write.";
  }
  replaceFacts(card, ["public metadata", "exact revisions", "review-only patch"]);
}

function ensureRepositoryScopes() {
  const grid = document.querySelector("#token-form .scope-grid") || document.querySelector(".scope-grid");
  if (!grid) return;
  const existing = new Set(
    [...grid.querySelectorAll('input[name="scopes"]')]
      .map((input) => String(input.value || "").trim())
      .filter(Boolean),
  );
  for (const scope of REPOSITORY_SCOPES) {
    if (existing.has(scope)) continue;
    const label = document.createElement("label");
    label.className = "scope";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "scopes";
    input.value = scope;
    const code = document.createElement("code");
    code.textContent = scope;
    label.append(input, code);
    grid.append(label);
    existing.add(scope);
  }
}

function install() {
  reconcileProgramCard();
  ensureRepositoryScopes();

  const signed = document.getElementById("signed-in");
  if (!signed || document.getElementById("platform-repository-entry")) return;
  const card = document.createElement("div");
  card.id = "platform-repository-entry";
  card.hidden = true;
  card.style.cssText = "margin-bottom:18px;padding:14px;border:1px solid var(--rule-2);border-radius:12px;background:rgba(114,200,208,.035)";
  card.innerHTML = '<strong style="display:block;margin-bottom:7px">Repository Observatory</strong><p style="margin:0 0 12px;color:var(--ink-3);line-height:1.55">Resolve an exact public GitHub, GitLab, or Bitbucket revision and preview a review-only Idol scaffold. No provider credential, source checkout, or repository write.</p><a class="button primary" href="/repo">Open repository workbench</a>';
  signed.prepend(card);
  const render = () => { card.hidden = signed.hidden; };
  new MutationObserver(render).observe(signed, { attributes: true, attributeFilter: ["hidden"] });
  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();

})(window);
