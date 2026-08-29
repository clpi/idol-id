import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["apps", "shared", "content/docs"];
const textExtensions = new Set([".html", ".js", ".mjs", ".css", ".md", ".json", ".txt"]);
const superseded = /\b(?:Idsem|IDSEM|Duo|DUO|Duon|DUON)\b/g;
const failures = [];

async function walk(root, path = root) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const next = join(path, entry.name);
    if (entry.isDirectory()) await walk(root, next);
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) {
      const source = await readFile(next, "utf8");
      for (const match of source.matchAll(superseded)) {
        const line = source.slice(0, match.index).split("\n").length;
        failures.push(`${relative(".", next)}:${line}: superseded public identity ${JSON.stringify(match[0])}`);
      }
    }
  }
}

for (const root of roots) await walk(root);
if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`public identity gate failed: ${failures.length} occurrence(s)`);
  process.exit(1);
}
console.log("public identity gate passed: Idol is the only active public identity");
