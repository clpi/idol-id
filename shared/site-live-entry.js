(() => {
  "use strict";
  if (document.querySelector("[data-live-product-entry]")) return;
  const mount = document.querySelector("main .wrap, main, .wrap, body");
  if (!mount) return;
  const section = document.createElement("section");
  section.dataset.liveProductEntry = "true";
  section.setAttribute("aria-label", "Live and MCP product surfaces");
  section.style.cssText = "margin:clamp(48px,8vw,96px) auto 0;max-width:1180px;padding:0 clamp(15px,4vw,52px);display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px";
  for (const record of [
    {
      title: "Live",
      href: "https://live.idol.id/",
      copy: "One causal project history, one accepted frontier, exact application facts, and authority-free Universe View binding."
    },
    {
      title: "MCP",
      href: "https://mcp.idol.id/",
      copy: "Stateless Streamable HTTP tools authenticated by scoped, digest-only Platform API keys."
    }
  ]) {
    const article = document.createElement("article");
    article.style.cssText = "padding:20px;border:1px solid var(--rule-2);border-radius:15px;background:rgba(255,255,255,.018)";
    const heading = document.createElement("h2");
    const link = document.createElement("a");
    link.href = record.href;
    link.textContent = record.title;
    heading.appendChild(link);
    const copy = document.createElement("p");
    copy.textContent = record.copy;
    copy.style.cssText = "margin-top:10px;color:var(--ink-3);line-height:1.65";
    article.append(heading, copy);
    section.appendChild(article);
  }
  mount.appendChild(section);
})();
