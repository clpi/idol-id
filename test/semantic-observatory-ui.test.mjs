import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Semantic Observatory uses the exact semantic bundle and synchronized source, graph, and rail surfaces", async () => {
  const [html, source, graph, index, css] = await Promise.all([
    read("apps/graph/index.html"),
    read("shared/semantic-source.js"),
    read("shared/graph.js"),
    read("shared/semantic-index.js"),
    read("shared/observatory.css"),
  ]);

  assert.match(html, /type="module"/);
  assert.match(html, /semantic-bundle\.js/);
  assert.match(html, /semantic-source\.js/);
  assert.match(html, /semantic-index\.js/);
  assert.match(html, /graph\.js/);
  assert.match(html, /class="observatory/);
  assert.match(html, /id="semantic-rail"/);
  assert.match(html, /data-lens="identity"/);
  assert.match(html, /data-lens="edges"/);
  assert.match(html, /data-lens="occurrences"/);
  assert.match(html, /data-lens="worlds"/);
  assert.match(html, /data-lens="projection"/);
  assert.match(html, /data-lens="witness"/);
  assert.match(html, /data-lens="realization"/);
  assert.match(html, /semantic identity not published/i);
  assert.match(html, /definition not published/i);
  assert.match(html, /world witness not published/i);
  assert.match(html, /selection history/i);
  assert.match(html, /compare selection/i);

  assert.match(source, /class SemanticSourceView/);
  assert.match(source, /role="button"/);
  assert.match(source, /keydown/);
  assert.match(graph, /class GraphView/);
  assert.match(graph, /selectEdge/);
  assert.match(graph, /setLens/);
  assert.match(graph, /setHighlights/);
  assert.doesNotMatch(graph, /Math\.random/);
  assert.doesNotMatch(graph, /repulsion|O\(n²\)|synthetic:\s*true/);
  assert.match(index, /definitions/);
  assert.match(index, /references/);
  assert.match(index, /worlds/);
  assert.match(index, /projections/);
  assert.match(index, /derivations/);
  assert.match(index, /realizations/);

  assert.match(css, /font-family:\s*var\(--sans\)/);
  assert.match(css, /font-family:\s*var\(--mono\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:\s*44px/);
});

test("Observatory never presents same spelling, paths, or names as definitions or semantic references", async () => {
  const [html, index, source] = await Promise.all([
    read("apps/graph/index.html"),
    read("shared/semantic-index.js"),
    read("shared/semantic-source.js"),
  ]);
  assert.match(html, /same spelling[^<]*lexical/i);
  assert.match(html, /published occurrences/i);
  assert.doesNotMatch(index, /findByName|nearest|fuzzy.*identity|sameSpelling.*reference/i);
  assert.doesNotMatch(source, /keyword(?:s|Table)|contextualKeyword|descriptorTable/i);
});

test("canonical graph rendering never fabricates application edges", async () => {
  const graph = await read("shared/graph.js");
  assert.doesNotMatch(graph, /applications become/);
  assert.doesNotMatch(graph, /edges\.push\([^\n]*synthetic/);
  assert.match(graph, /publishedGraphModel/);
  assert.match(graph, /application_records/);
});

test("mobile Observatory exposes full-width source, graph, and facts modes without horizontal document overflow", async () => {
  const [html, css] = await Promise.all([
    read("apps/graph/index.html"),
    read("shared/observatory.css"),
  ]);
  assert.match(html, /data-mobile-mode="source"/);
  assert.match(html, /data-mobile-mode="graph"/);
  assert.match(html, /data-mobile-mode="facts"/);
  assert.match(html, /class="observatory-mobile-nav"/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /\.observatory\[data-mobile-mode="source"\]/);
  assert.match(css, /\.observatory\[data-mobile-mode="graph"\]/);
  assert.match(css, /\.observatory\[data-mobile-mode="facts"\]/);
});
