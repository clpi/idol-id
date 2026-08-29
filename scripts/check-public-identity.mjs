import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(".");
const activeRoots = ["apps", "shared", "content/docs"];
const extensions = new Set([".html", ".js", ".mjs", ".css", ".md", ".json", ".txt"]);
const forbidden = /\b(?:idsem|duon|duo)\b/i;
const runtimeRewrite = /site-product-convergence\.js/;
const failures = [];

async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const candidate = join(path, entry.name);
    if (entry.isDirectory()) await walk(candidate);
    else if (entry.isFile() && extensions.has(extname(entry.name))) await inspect(candidate);
  }
}

async function inspect(path) {
  const source = await readFile(path, "utf8");
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (forbidden.test(lines[index])) failures.push(`${relative(root, path)}:${index + 1}: superseded project identity`);
    if (runtimeRewrite.test(lines[index])) failures.push(`${relative(root, path)}:${index + 1}: post-load product rewrite is forbidden`);
  }
}

for (const path of activeRoots) await walk(resolve(path));
await inspect(resolve("README.md"));

const appEntries = await readdir(resolve("apps"), { withFileTypes: true });
for (const entry of appEntries.filter((candidate) => candidate.isDirectory())) {
  const path = resolve("apps", entry.name, "index.html");
  const html = await readFile(path, "utf8");
  if (!html.includes('/shared/studio.css')) failures.push(`${relative(root, path)}: shared studio design system missing`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`public identity gate passed: ${activeRoots.join(", ")} + README · IDOL only · ${appEntries.filter((entry) => entry.isDirectory()).length} app shells converged`);
}
