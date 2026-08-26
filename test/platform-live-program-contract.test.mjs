import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.id = "";
    this.hidden = false;
    this.className = "";
    this.textContent = "";
    this.innerHTML = "";
    this.children = [];
    this.style = { cssText: "" };
    this.lookup = new Map();
    this.inputs = [];
    this.classList = {
      add: (...names) => {
        const current = new Set(this.className.split(/\s+/).filter(Boolean));
        for (const name of names) current.add(name);
        this.className = [...current].join(" ");
      },
      remove: (...names) => {
        const denied = new Set(names);
        this.className = this.className.split(/\s+/).filter((name) => name && !denied.has(name)).join(" ");
      },
      contains: (name) => this.className.split(/\s+/).includes(name),
    };
  }

  append(...nodes) {
    this.children.push(...nodes);
    for (const node of nodes) {
      if (node?.tagName === "INPUT") this.inputs.push(node);
      if (Array.isArray(node?.inputs)) this.inputs.push(...node.inputs);
    }
  }

  prepend(...nodes) {
    this.children.unshift(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.inputs = [];
    this.append(...nodes);
  }

  querySelector(selector) {
    return this.lookup.get(selector) || null;
  }

  querySelectorAll(selector) {
    if (selector === 'input[name="scopes"]') return this.inputs;
    return [];
  }
}

function program(letter, title, copy, facts) {
  const root = new FakeElement("article");
  const mark = new FakeElement("div");
  mark.textContent = `program ${letter}`;
  const status = new FakeElement("span");
  status.className = "status";
  status.textContent = "planned";
  const heading = new FakeElement("h3");
  heading.textContent = title;
  const paragraph = new FakeElement("p");
  paragraph.textContent = copy;
  const factList = new FakeElement("div");
  factList.className = "facts";
  for (const value of facts) {
    const fact = new FakeElement("span");
    fact.className = "fact";
    fact.textContent = value;
    factList.append(fact);
  }
  root.lookup.set(".mark", mark);
  root.lookup.set(".status", status);
  root.lookup.set("h3", heading);
  root.lookup.set("p", paragraph);
  root.lookup.set(".facts", factList);
  return { root, status, heading, paragraph, facts: factList };
}

function fixture() {
  const signedIn = new FakeElement("div");
  signedIn.id = "signed-in";
  signedIn.hidden = false;

  const scopeGrid = new FakeElement("div");
  for (const value of ["profile:read", "registry:read", "world:read", "analysis:read"]) {
    const input = new FakeElement("input");
    input.name = "scopes";
    input.value = value;
    scopeGrid.inputs.push(input);
  }

  const ide = program(
    "L",
    "Local-first browser IDE",
    "Edit local browser workspaces; request exact remote-native semantic facts explicitly.",
    ["local source", "exact tokens", "Access protected"],
  );
  const repository = program(
    "M",
    "Repository bridge",
    "Connect Git providers, discover project semantics, generate reviewable Idol adoption plans and PR output.",
    ["Git providers", "project inventory", "PR output"],
  );

  const elements = new Map([["signed-in", signedIn]]);
  const document = {
    readyState: "complete",
    getElementById(id) { return elements.get(id) || null; },
    createElement(tagName) { return new FakeElement(tagName); },
    querySelector(selector) {
      if (selector === "#token-form .scope-grid" || selector === ".scope-grid") return scopeGrid;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".program") return [ide.root, repository.root];
      return [];
    },
    addEventListener() {},
  };

  return { document, signedIn, scopeGrid, ide, repository };
}

async function execute(path, fixtureState) {
  const source = await readFile(path, "utf8");
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() {}
  }
  const context = {
    document: fixtureState.document,
    MutationObserver,
    console,
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: path });
}

test("Platform adapters publish Programs L and M as live and expose repository token scopes", async () => {
  const state = fixture();
  await execute("shared/platform-ide-entry.js", state);
  await execute("shared/platform-repository-entry.js", state);

  assert.equal(state.ide.status.textContent, "live");
  assert.equal(state.ide.status.classList.contains("live"), true);
  assert.equal(state.repository.status.textContent, "live");
  assert.equal(state.repository.status.classList.contains("live"), true);
  assert.doesNotMatch(state.repository.paragraph.textContent, /Connect Git providers|PR output/i);
  assert.match(state.repository.paragraph.textContent, /exact public .* revision/i);
  assert.match(state.repository.paragraph.textContent, /review-only/i);

  const scopes = state.scopeGrid.inputs.map((input) => input.value).sort();
  assert.deepEqual(
    scopes,
    [
      "analysis:read",
      "profile:read",
      "registry:read",
      "repository:observe",
      "repository:read",
      "repository:scaffold",
      "world:read",
    ],
  );
});
