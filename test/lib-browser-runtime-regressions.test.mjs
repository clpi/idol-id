import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Lib never shadows the browser document with a registry response", async () => {
  const source = await read("apps/lib/index.html");
  assert.doesNotMatch(source, /const\s+document\s*=\s*set\s*===/);
  assert.match(source, /const\s+payload\s*=\s*set\s*===/);
  assert.match(source, /document\.getElementById\("strip"\)/);
});

test("Lib copies real deep links rather than inventing registry or home coordinate syntax", async () => {
  const source = await read("apps/lib/index.html");
  assert.doesNotMatch(source, /`home:\$\{name\}`/);
  assert.doesNotMatch(source, /\/world\/\$\{encodeURIComponent\(name\)\}@/);
  assert.match(source, /new URL\("https:\/\/lib\.idol\.id\/"\)/);
  assert.match(source, /url\.searchParams\.set\("set",\s*"homes"\)/);
  assert.match(source, /url\.hash\s*=\s*encodeURIComponent\(name\)/);
});
