/* Deterministic presentation of compiler-published graph records.
   Canonical edges are never reconstructed from names or application records. */
(function graphSurface(global) {
  "use strict";
  const SVG = "http://www.w3.org/2000/svg";
  const graphModel = import("/shared/graph-model.js");
  const shapes = Object.freeze({ application: "ring", relation: "diamond", value: "circle", descriptor: "lozenge", world: "halo", witness: "hex", projection: "square", derivation: "square", realization: "square" });

  function svg(name, attributes = {}) {
    const node = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }
  function label(node) { return String(node.name ?? node.label ?? node.kind ?? node.id); }
  function kind(node) { return String(node.kind ?? node.category ?? "not-published"); }
  function pathFor(shape, radius = 14) {
    if (shape === "diamond") return `M 0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`;
    if (shape === "lozenge") return `M ${-radius * 1.35} 0 Q ${-radius} ${-radius} 0 ${-radius} Q ${radius} ${-radius} ${radius * 1.35} 0 Q ${radius} ${radius} 0 ${radius} Q ${-radius} ${radius} ${-radius * 1.35} 0 Z`;
    if (shape === "hex") return `M ${-radius * .86} ${-radius} L ${radius * .86} ${-radius} L ${radius * 1.25} 0 L ${radius * .86} ${radius} L ${-radius * .86} ${radius} L ${-radius * 1.25} 0 Z`;
    return `M ${-radius} ${-radius} H ${radius} V ${radius} H ${-radius} Z`;
  }
  function curve(from, to) {
    const bend = Math.max(42, Math.abs(to.x - from.x) * .48);
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
  }

  class GraphView {
    constructor(mount, options = {}) {
      this.mount = typeof mount === "string" ? document.querySelector(mount) : mount;
      if (!this.mount) throw new Error("graph mount is required");
      this.options = options;
      this.raw = { nodes: [], edges: [], applications: [] };
      this.model = null;
      this.byId = new Map();
      this.edgeById = new Map();
      this.positions = new Map();
      this.nodeElements = new Map();
      this.edgeElements = new Map();
      this.selectedNode = null;
      this.selectedEdge = null;
      this.highlightNodes = new Set();
      this.highlightEdges = new Set();
      this.lens = "canonical";
      this.firstFit = true;
      this.scale = 1;
      this.translate = { x: 0, y: 0 };
      this.drag = null;

      this.root = document.createElement("div");
      this.root.className = "graph-view";
      this.root.dataset.lens = this.lens;
      this.svg = svg("svg", { class: "graph-svg", role: "application", "aria-label": "Compiler-published semantic graph", tabindex: "0" });
      const defs = svg("defs");
      const marker = svg("marker", { id: "graph-arrow-published", markerWidth: "8", markerHeight: "8", refX: "7", refY: "4", orient: "auto", markerUnits: "strokeWidth" });
      marker.appendChild(svg("path", { d: "M 0 0 L 8 4 L 0 8 Z", class: "graph-arrow" }));
      defs.appendChild(marker);
      this.viewport = svg("g", { class: "graph-viewport" });
      this.edgeLayer = svg("g", { class: "graph-edges" });
      this.nodeLayer = svg("g", { class: "graph-nodes" });
      this.viewport.append(this.edgeLayer, this.nodeLayer);
      this.svg.append(defs, this.viewport);
      this.empty = document.createElement("div");
      this.empty.className = "graph-empty";
      this.empty.textContent = "No compiler-published graph is available.";
      this.root.append(this.svg, this.empty);
      this.mount.replaceChildren(this.root);
      this.#bindViewport();
    }

    #bindViewport() {
      this.svg.addEventListener("wheel", (event) => {
        event.preventDefault();
        this.zoomBy(event.deltaY < 0 ? 1.12 : .89, { x: event.offsetX, y: event.offsetY });
      }, { passive: false });
      this.svg.addEventListener("pointerdown", (event) => {
        if (event.target.closest?.("[data-node-id],[data-edge-id]")) return;
        this.drag = { x: event.clientX, y: event.clientY, origin: { ...this.translate } };
        this.svg.setPointerCapture?.(event.pointerId);
      });
      this.svg.addEventListener("pointermove", (event) => {
        if (!this.drag) return;
        this.translate.x = this.drag.origin.x + event.clientX - this.drag.x;
        this.translate.y = this.drag.origin.y + event.clientY - this.drag.y;
        this.#transform();
      });
      const stop = () => { this.drag = null; };
      this.svg.addEventListener("pointerup", stop);
      this.svg.addEventListener("pointercancel", stop);
      this.svg.addEventListener("keydown", (event) => {
        if (event.key === "+" || event.key === "=") { event.preventDefault(); this.zoomBy(1.15); }
        else if (event.key === "-") { event.preventDefault(); this.zoomBy(.87); }
        else if (event.key === "0") { event.preventDefault(); this.fit(); }
      });
    }

    setGraph(graph) {
      this.raw = graph && Array.isArray(graph.nodes) ? graph : { nodes: [], edges: [], applications: [] };
      this.byId = new Map((this.raw.nodes || []).map((node) => [String(node.id), node]));
      this.empty.hidden = this.byId.size > 0;
      return graphModel.then(({ publishedGraphModel, deterministicLayout }) => {
        this.model = publishedGraphModel(this.raw);
        this.byId = this.model.nodeById;
        this.edgeById = this.model.edgeById;
        this.positions = deterministicLayout(this.model, {
          width: Math.max(720, this.mount.clientWidth || 960),
          height: Math.max(460, this.mount.clientHeight || 620),
        });
        this.#render();
        if (this.firstFit) this.fit();
        return this.model;
      }).catch((error) => {
        this.model = null;
        this.empty.hidden = false;
        this.empty.textContent = `Graph projection refused: ${error.message}`;
        this.edgeLayer.replaceChildren();
        this.nodeLayer.replaceChildren();
        throw error;
      });
    }

    #render() {
      this.nodeElements.clear();
      this.edgeElements.clear();
      this.edgeLayer.replaceChildren();
      this.nodeLayer.replaceChildren();
      if (!this.model) return;

      for (const edge of this.model.edges) {
        const from = this.positions.get(edge.from);
        const to = this.positions.get(edge.to);
        if (!from || !to) continue;
        const d = curve(from, to);
        const group = svg("g", { class: `graph-edge edge-${edge.presentation.status}`, "data-edge-id": edge.id, role: "button", tabindex: "0", "aria-label": `${edge.presentation.label}: ${edge.from} to ${edge.to}` });
        group.append(
          svg("path", { d, class: "graph-edge-line", "marker-end": "url(#graph-arrow-published)" }),
          svg("path", { d, class: "graph-edge-hit" }),
        );
        const exact = svg("text", { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 7, class: "graph-edge-label", "text-anchor": "middle" });
        exact.textContent = edge.presentation.label;
        group.appendChild(exact);
        group.addEventListener("click", (event) => { event.stopPropagation(); this.selectEdge(edge.id, true); });
        group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.selectEdge(edge.id, true); } });
        this.edgeElements.set(edge.id, group);
        this.edgeLayer.appendChild(group);
      }

      for (const node of this.model.nodes) {
        const point = this.positions.get(node.id);
        if (!point) continue;
        const category = kind(node);
        const shape = shapes[category] || "circle";
        const group = svg("g", { class: `graph-node kind-${category.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()} shape-${shape}`, transform: `translate(${point.x} ${point.y})`, "data-node-id": node.id, role: "button", tabindex: "0", "aria-label": `${label(node)}, ${category}, ${node.id}` });
        if (["circle", "ring", "halo"].includes(shape)) {
          if (shape === "halo") group.appendChild(svg("circle", { r: "24", class: "graph-node-halo" }));
          group.appendChild(svg("circle", { r: shape === "ring" ? "15" : "13", class: "graph-node-shape" }));
          if (shape === "ring") group.appendChild(svg("circle", { r: "7", class: "graph-node-inner" }));
        } else group.appendChild(svg("path", { d: pathFor(shape), class: "graph-node-shape" }));
        const face = svg("text", { x: "0", y: "31", class: "graph-node-label", "text-anchor": "middle" });
        face.textContent = label(node).slice(0, 34);
        const identity = svg("text", { x: "0", y: "43", class: "graph-node-id", "text-anchor": "middle" });
        identity.textContent = node.id.length > 38 ? `${node.id.slice(0, 35)}…` : node.id;
        group.append(face, identity);
        group.addEventListener("click", (event) => { event.stopPropagation(); this.selectNode(node.id, true); });
        group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.selectNode(node.id, true); } });
        this.nodeElements.set(node.id, group);
        this.nodeLayer.appendChild(group);
      }
      this.#paint();
    }

    select(id, reveal = false) { return this.selectNode(id, reveal); }
    selectNode(id, reveal = false, notify = true) {
      const node = this.byId.get(String(id));
      if (!node) return null;
      this.selectedNode = String(id);
      this.selectedEdge = null;
      this.#paint();
      if (reveal) this.#revealNode(this.selectedNode);
      const projected = { ...node, raw: node };
      if (notify) {
        this.options.onSelect?.(projected);
        this.options.onSelectNode?.(projected);
      }
      return projected;
    }
    selectEdge(id, reveal = false, notify = true) {
      const edge = this.edgeById.get(String(id));
      if (!edge) return null;
      this.selectedEdge = String(id);
      this.selectedNode = null;
      this.#paint();
      if (reveal) this.edgeElements.get(this.selectedEdge)?.focus?.();
      if (notify) this.options.onSelectEdge?.(edge);
      return edge;
    }
    setLens(lens = "canonical") { this.lens = String(lens); this.root.dataset.lens = this.lens; this.#paint(); }
    setHighlights(value = {}) {
      const nodes = Array.isArray(value) ? value : (value.nodes || []);
      const edges = Array.isArray(value) ? [] : (value.edges || []);
      this.highlightNodes = new Set(nodes.map(String));
      this.highlightEdges = new Set(edges.map(String));
      this.#paint();
    }
    #paint() {
      for (const [id, node] of this.nodeElements) {
        const selected = id === this.selectedNode;
        const related = this.highlightNodes.has(id);
        node.classList.toggle("selected", selected);
        node.classList.toggle("related", related);
        node.classList.toggle("dimmed", this.highlightNodes.size > 0 && !related && !selected);
        node.setAttribute("aria-pressed", String(selected));
      }
      for (const [id, edge] of this.edgeElements) {
        const selected = id === this.selectedEdge;
        const related = this.highlightEdges.has(id);
        edge.classList.toggle("selected", selected);
        edge.classList.toggle("related", related);
        edge.classList.toggle("dimmed", this.highlightEdges.size > 0 && !related && !selected);
        edge.setAttribute("aria-pressed", String(selected));
      }
    }
    #revealNode(id) {
      const point = this.positions.get(id);
      if (!point) return;
      const rect = this.svg.getBoundingClientRect();
      this.translate.x = rect.width / 2 - point.x * this.scale;
      this.translate.y = rect.height / 2 - point.y * this.scale;
      this.#transform();
      this.nodeElements.get(id)?.focus?.();
    }
    zoomBy(factor, center = null) {
      const next = Math.min(4, Math.max(.18, this.scale * factor));
      const rect = this.svg.getBoundingClientRect();
      const anchor = center || { x: rect.width / 2, y: rect.height / 2 };
      const graphX = (anchor.x - this.translate.x) / this.scale;
      const graphY = (anchor.y - this.translate.y) / this.scale;
      this.scale = next;
      this.translate.x = anchor.x - graphX * next;
      this.translate.y = anchor.y - graphY * next;
      this.#transform();
    }
    fit() {
      const rect = this.svg.getBoundingClientRect();
      if (!this.positions.size || !rect.width || !rect.height) return;
      const points = [...this.positions.values()];
      const minX = Math.min(...points.map((point) => point.x)) - 70;
      const maxX = Math.max(...points.map((point) => point.x)) + 70;
      const minY = Math.min(...points.map((point) => point.y)) - 70;
      const maxY = Math.max(...points.map((point) => point.y)) + 70;
      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      this.scale = Math.min(1.45, Math.max(.18, Math.min(rect.width / width, rect.height / height) * .9));
      this.translate.x = (rect.width - width * this.scale) / 2 - minX * this.scale;
      this.translate.y = (rect.height - height * this.scale) / 2 - minY * this.scale;
      this.firstFit = false;
      this.#transform();
    }
    fitIfFirst() { if (this.firstFit) this.fit(); }
    #transform() { this.viewport.setAttribute("transform", `translate(${this.translate.x} ${this.translate.y}) scale(${this.scale})`); }
    destroy() { this.mount.replaceChildren(); this.nodeElements.clear(); this.edgeElements.clear(); this.byId.clear(); this.edgeById.clear(); }
  }

  global.GraphView = GraphView;
})(window);
