(() => {
  "use strict";
  const scopes = Object.freeze([
    ["mcp:connect", "Connect hosted MCP clients"],
    ["live:read", "Read Live projects, graph, history, and frontier"],
    ["live:write", "Create Live projects and append project facts"],
    ["world:write", "Manage explicit world-facing records where supported"],
  ]);

  const grid = document.querySelector(".scope-grid");
  if (grid) {
    const existing = new Set([...grid.querySelectorAll('input[name="scope"]')].map((input) => input.value));
    for (const [scope, description] of scopes) {
      if (existing.has(scope)) continue;
      const label = document.createElement("label");
      label.className = "scope";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "scope";
      input.value = scope;
      const copy = document.createElement("span");
      const code = document.createElement("code");
      code.textContent = scope;
      const detail = document.createElement("small");
      detail.textContent = description;
      detail.style.display = "block";
      detail.style.marginTop = "4px";
      detail.style.color = "var(--ink-4)";
      copy.append(code, detail);
      label.append(input, copy);
      grid.appendChild(label);
    }
  }

  const actions = document.querySelector(".hero .actions");
  if (actions && !actions.querySelector('[href="https://live.idol.id/"]')) {
    for (const [href, label] of [["https://live.idol.id/", "Open Live"], ["https://mcp.idol.id/", "Hosted MCP"]]) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      actions.appendChild(link);
    }
  }

  const gridPrograms = document.querySelector(".program-grid");
  if (gridPrograms && !gridPrograms.querySelector('[data-program="live"]')) {
    const records = [
      {
        id: "live",
        mark: "Live",
        title: "Causal project control plane",
        copy: "Subject-owned projects, exact application facts, immutable attempts, causally closed frontier decisions, and Universe View bindings.",
        href: "https://live.idol.id/",
        facts: ["one history", "one frontier", "authority none"],
      },
      {
        id: "mcp",
        mark: "MCP",
        title: "Scoped hosted tools",
        copy: "Stateless Streamable HTTP transport over existing authority-bound services, authenticated by digest-only Platform API keys.",
        href: "https://mcp.idol.id/",
        facts: ["mcp:connect", "no session state", "transport only"],
      },
    ];
    for (const record of records) {
      const article = document.createElement("article");
      article.className = "program";
      article.dataset.program = record.id;
      const mark = document.createElement("div"); mark.className = "mark"; mark.textContent = record.mark;
      const status = document.createElement("span"); status.className = "status live"; status.textContent = "live";
      const title = document.createElement("h3");
      const link = document.createElement("a"); link.href = record.href; link.textContent = record.title; title.appendChild(link);
      const copy = document.createElement("p"); copy.textContent = record.copy;
      const facts = document.createElement("div"); facts.className = "facts";
      for (const value of record.facts) { const fact = document.createElement("span"); fact.className = "fact"; fact.textContent = value; facts.appendChild(fact); }
      article.append(mark, status, title, copy, facts);
      gridPrograms.appendChild(article);
    }
  }
})();
