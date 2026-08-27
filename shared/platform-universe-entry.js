/* Session-gated entry for Program O Universe Views.
   Universe Views are operational projections over Idol's one semantic universe;
   this adapter does not create semantic authority or touch dispatcher state. */
(function installPlatformUniverseEntry(global) {
"use strict";

const UNIVERSE_SCOPES = Object.freeze(["universe:read", "universe:write"]);

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
  const card = programCard("O");
  if (!card) return;
  const status = card.querySelector(".status");
  if (status) {
    status.textContent = "live";
    status.classList.remove("planned");
    status.classList.add("live");
  }
  const title = card.querySelector("h3");
  if (title) title.textContent = "Universe Views";
  const copy = card.querySelector("p");
  if (copy) copy.textContent = "Save private or public operational views over exact world records in Idol's one semantic universe. Facts and refusals are inspectable; composition and authority remain unproven.";
  replaceFacts(card, ["exact world refs", "private/public views", "no hidden grant"]);
}

function ensureUniverseScopes() {
  const grid = document.querySelector("#token-form .scope-grid") || document.querySelector(".scope-grid");
  if (!grid) return;
  const existing = new Set([...grid.querySelectorAll('input[name="scope"]')].map((input) => String(input.value || "").trim()).filter(Boolean));
  for (const scope of UNIVERSE_SCOPES) {
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
  reconcileProgramCard();
  ensureUniverseScopes();
  const signed = document.getElementById("signed-in");
  if (!signed || document.getElementById("platform-universe-entry")) return;
  const card = document.createElement("div");
  card.id = "platform-universe-entry";
  card.hidden = true;
  card.style.cssText = "margin-bottom:18px;padding:14px;border:1px solid var(--rule-2);border-radius:12px;background:rgba(170,155,216,.035)";
  card.innerHTML = '<strong style="display:block;margin-bottom:7px">Universe Views</strong><p style="margin:0 0 12px;color:var(--ink-3);line-height:1.55">Build a saved operational view over exact world records in Idol\'s one semantic universe. It reports evidence and refusal; it does not prove composition or grant authority.</p><a class="button primary" href="/universe">Open Universe Views</a>';
  signed.prepend(card);
  const render = () => { card.hidden = signed.hidden; };
  new MutationObserver(render).observe(signed, { attributes: true, attributeFilter: ["hidden"] });
  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();

})(window);
