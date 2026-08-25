/* ============================================================================
   graph.js — semantic graph renderer for sim-v0 exports (v6 … v14)
   Vanilla SVG. Verlet force layout, pan/zoom, relation filter, selection.
   ========================================================================== */
(function (global) {
"use strict";

const KIND_R = {
  module: 13, func: 8, param: 4.5, local: 5.5, value: 3.5, call: 6.5,
  world: 10, table: 8, enum: 8, pack: 7,
};

const REL_STYLE = {
  binding:    { cls: "gedge rel-binding",    dash: "" },
  projection: { cls: "gedge rel-projection", dash: "" },
  member:     { cls: "gedge rel-member",     dash: "3 3" },
  operand:    { cls: "gedge rel-operand",    dash: "1 4" },
  subject:    { cls: "gedge rel-subject",    dash: "" },
};

class GraphView {
  constructor(mount, opts) {
    opts = opts || {};
    this.mount = typeof mount === "string" ? document.querySelector(mount) : mount;
    this.mount.classList.add("graphview");
    this.opts = opts;
    this.nodes = [];
    this.edges = [];
    this.off = { rel: new Set() };
    this.sel = null;
    this.scale = 1;
    this.tx = 0; this.ty = 0;

    const NS = "http://www.w3.org/2000/svg";
    this.svg = document.createElementNS(NS, "svg");
    this.gRoot = document.createElementNS(NS, "g");
    this.gEdges = document.createElementNS(NS, "g");
    this.gNodes = document.createElementNS(NS, "g");
    this.gRoot.appendChild(this.gEdges);
    this.gRoot.appendChild(this.gNodes);
    this.svg.appendChild(this.gRoot);
    this.mount.appendChild(this.svg);

    // HUD
    const hud = document.createElement("div");
    hud.className = "gv-hud";
    hud.innerHTML =
      `<button data-z="in" title="zoom in">+</button>` +
      `<button data-z="out" title="zoom out">−</button>` +
      `<button data-z="fit" title="fit">fit</button>` +
      `<button data-z="relayout" title="relayout">↻</button>`;
    hud.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const z = b.dataset.z;
      if (z === "in") this.zoomBy(1.3);
      else if (z === "out") this.zoomBy(1 / 1.3);
      else if (z === "fit") this.fit();
      else if (z === "relayout") { this.seed(); this.run(360); }
    });
    this.mount.appendChild(hud);

    this.legend = document.createElement("div");
    this.legend.className = "gv-legend";
    this.mount.appendChild(this.legend);

    this._pointer();
    this._wheel();
    this.resizeObserver = new ResizeObserver(() => this.fitIfFirst());
    this.resizeObserver.observe(this.mount);
    this._fitted = false;
  }

  /* ---------------------------------------------------------- data load */

  setGraph(g) {
    this.graph = g || { nodes: [], edges: [] };
    const nodes = (this.graph.nodes || []).map((n) => ({
      id: n.id, kind: n.kind, name: n.name || n.kind || ("#" + n.id),
      line: n.line, col: n.col, raw: n,
    }));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (this.graph.edges || [])
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => ({ ...e, rel: e.relation || "member" }));
    // applications become subject→relation edges when not already present
    for (const a of this.graph.applications || []) {
      if (ids.has(a.application) && a.relation !== undefined && ids.has(a.relation)) {
        edges.push({ from: a.application, to: a.relation, rel: "binding", synthetic: true });
      }
    }
    this.nodes = nodes;
    this.edges = edges;
    this.byId = new Map(nodes.map((n) => [n.id, n]));
    this._fitted = false;
    this.seed();
    this.buildDom();
    this.buildLegend();
    this.run(500);
    this.fitIfFirst();
  }

  seed() {
    // ring by scope cluster: nodes without scope on outer ring, scoped in arcs
    const R = Math.max(140, 18 * Math.sqrt(this.nodes.length + 1));
    const groups = new Map();
    for (const n of this.nodes) {
      const k = n.raw.scope !== undefined ? n.raw.scope : "__";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(n);
    }
    const gk = [...groups.keys()];
    gk.forEach((k, gi) => {
      const g = groups.get(k);
      const ga = (gi / Math.max(1, gk.length)) * Math.PI * 2;
      const gr = k === "__" ? 0 : R;
      g.forEach((n, i) => {
        const a = ga + (i / Math.max(1, g.length)) * Math.PI * 0.6;
        n.x = this.mount.clientWidth / 2 + gr * Math.cos(a) + (Math.random() - 0.5) * 30;
        n.y = this.mount.clientHeight / 2 + gr * Math.sin(a) + (Math.random() - 0.5) * 30;
        n.vx = 0; n.vy = 0;
      });
    });
  }

  buildDom() {
    const NS = "http://www.w3.org/2000/svg";
    this.gEdges.innerHTML = "";
    this.gNodes.innerHTML = "";
    this.eEls = new Map();
    this.nEls = new Map();

    for (const e of this.edges) {
      const p = document.createElementNS(NS, "path");
      const st = REL_STYLE[e.rel] || REL_STYLE.member;
      p.setAttribute("class", st.cls);
      if (st.dash) p.setAttribute("stroke-dasharray", st.dash);
      this.gEdges.appendChild(p);
      this.eEls.set(e, p);
    }
    for (const n of this.nodes) {
      const gEl = document.createElementNS(NS, "g");
      gEl.setAttribute("class", "gnode");
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", (KIND_R[n.kind] || 5));
      const t = document.createElementNS(NS, "text");
      t.textContent = n.name.length > 18 ? n.name.slice(0, 17) + "…" : n.name;
      const isModule = n.kind === "module";
      if (isModule) t.setAttribute("y", 4);
      else t.setAttribute("x", (KIND_R[n.kind] || 5) + 5), t.setAttribute("y", 3);
      gEl.appendChild(c); gEl.appendChild(t);
      gEl.addEventListener("click", (ev) => { ev.stopPropagation(); this.select(n.id, true); });
      gEl.addEventListener("dblclick", () => this.opts.onOpen && this.opts.onOpen(n));
      this.gNodes.appendChild(gEl);
      this.nEls.set(n.id, gEl);
    }
  }

  buildLegend() {
    const rels = [...new Set(this.edges.map((e) => e.rel))];
    this.legend.innerHTML = "";
    for (const r of rels) {
      const st = REL_STYLE[r] || REL_STYLE.member;
      const li = document.createElement("div");
      li.className = "li" + (this.off.rel.has(r) ? " off" : "");
      li.innerHTML = `<span class="swatch" style="border-color:${r === "subject" ? "var(--signal)" : "currentColor"};border-top-style:${st.dash ? "dashed" : "solid"}"></span>${r}`;
      li.addEventListener("click", () => {
        if (this.off.rel.has(r)) this.off.rel.delete(r); else this.off.rel.add(r);
        li.classList.toggle("off");
      });
      this.legend.appendChild(li);
    }
  }

  /* ------------------------------------------------------------- layout */

  run(steps) {
    if (this._raf) cancelAnimationFrame(this._raf);
    let n = 0;
    const tick = () => {
      for (let s = 0; s < 2; s++) this.step();
      this.draw();
      if (++n < steps) this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  step() {
    const N = this.nodes;
    // springs
    for (const e of this.edges) {
      const a = this.byId.get(e.from), b = this.byId.get(e.to);
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const rest = 70;
      const f = (d - rest) * 0.012;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    // repulsion (O(n²) fine for ≤ ~600 nodes)
    for (let i = 0; i < N.length; i++) {
      for (let j = i + 1; j < N.length; j++) {
        const a = N[i], b = N[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const d = Math.sqrt(d2);
        const f = 2600 / d2;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }
    // integrate
    for (const nd of N) {
      nd.vx *= 0.82; nd.vy *= 0.82;
      nd.x += Math.max(-14, Math.min(14, nd.vx));
      nd.y += Math.max(-14, Math.min(14, nd.vy));
    }
  }

  draw() {
    for (const [e, p] of this.eEls) {
      const a = this.byId.get(e.from), b = this.byId.get(e.to);
      if (this.off.rel.has(e.rel)) { p.setAttribute("d", ""); continue; }
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.08;
      const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.08;
      p.setAttribute("d", `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`);
      p.style.display = this.sel && (this.sel === e.from || this.sel === e.to)
        ? "" : (this.sel ? "" : "");
    }
    for (const [id, gEl] of this.nEls) {
      const nd = this.byId.get(id);
      gEl.setAttribute("transform", `translate(${nd.x},${nd.y})`);
    }
    this.gRoot.setAttribute("transform",
      `translate(${this.tx},${this.ty}) scale(${this.scale})`);
  }

  /* ----------------------------------------------------------- viewport */

  zoomBy(f, cx, cy) {
    const r = this.mount.getBoundingClientRect();
    cx = cx === undefined ? r.width / 2 : cx;
    cy = cy === undefined ? r.height / 2 : cy;
    const ns = Math.max(0.15, Math.min(4, this.scale * f));
    this.tx = cx - ((cx - this.tx) / this.scale) * ns;
    this.ty = cy - ((cy - this.ty) / this.scale) * ns;
    this.scale = ns;
    this.draw();
  }

  fit() {
    if (!this.nodes.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n of this.nodes) {
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y);
    }
    const r = this.mount.getBoundingClientRect();
    const pad = 46;
    const s = Math.min((r.width - pad * 2) / (x1 - x0 + 1), (r.height - pad * 2) / (y1 - y0 + 1), 1.6);
    this.scale = Math.max(0.15, s);
    this.tx = r.width / 2 - ((x0 + x1) / 2) * this.scale;
    this.ty = r.height / 2 - ((y0 + y1) / 2) * this.scale;
    this.draw();
    this._fitted = true;
  }

  fitIfFirst() {
    if (!this._fitted && this.nodes.length) this.fit();
  }

  _wheel() {
    this.mount.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = this.mount.getBoundingClientRect();
      this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
  }

  _pointer() {
    let drag = null;
    this.svg.addEventListener("mousedown", (e) => {
      drag = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty, moved: false };
      this.svg.classList.add("panning");
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      this.tx = drag.tx + dx; this.ty = drag.ty + dy;
      this.draw();
    });
    window.addEventListener("mouseup", () => { drag = null; this.svg.classList.remove("panning"); });
    this.svg.addEventListener("click", (e) => {
      if (e.target === this.svg && this.sel) this.select(null);
    });
  }

  /* ---------------------------------------------------------- selection */

  select(id, andCenter) {
    this.sel = id;
    for (const [nid, gEl] of this.nEls) {
      gEl.classList.toggle("sel", nid === id);
      gEl.classList.toggle("dim", id !== null && nid !== id &&
        !this._adjacent(nid, id));
    }
    for (const [e, p] of this.eEls) {
      p.classList.toggle("hl", id !== null && (e.from === id || e.to === id));
    }
    if (id !== null && andCenter) {
      const nd = this.byId.get(id);
      const r = this.mount.getBoundingClientRect();
      this.tx = r.width / 2 - nd.x * this.scale;
      this.ty = r.height / 2 - nd.y * this.scale;
      this.draw();
    }
    this.opts.onSelect && this.opts.onSelect(id === null ? null : this.byId.get(id));
  }

  _adjacent(a, b) {
    for (const e of this.edges) {
      if ((e.from === a && e.to === b) || (e.from === b && e.to === a)) return true;
    }
    return false;
  }
}

global.GraphView = GraphView;

})(window);
