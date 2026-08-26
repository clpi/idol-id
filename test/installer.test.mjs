import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authority = "f33bb3773484e7d954a2975211e683dfa89edab5";

test("Unix installer is user-local, authority-pinned, and honest about bootstrap status", async () => {
  const source = await readFile("content/install.sh", "utf8");
  assert.match(source, new RegExp(authority));
  assert.match(source, /git -C .* rev-parse HEAD/);
  assert.match(source, /zig build -Doptimize=ReleaseFast/);
  assert.match(source, /bootstrap seed/);
  assert.match(source, /self_hosted.*false/s);
  assert.doesNotMatch(source, /\bsudo\b/);
  assert.match(source, /\$HOME\}\/\.local|\$\{HOME\}\/\.local/);
});

test("PowerShell installer is user-local, authority-pinned, and verifies the checkout", async () => {
  const source = await readFile("content/install.ps1", "utf8");
  assert.match(source, new RegExp(authority));
  assert.match(source, /rev-parse HEAD/);
  assert.match(source, /zig build -Doptimize=ReleaseFast/);
  assert.match(source, /bootstrap-seed/);
  assert.match(source, /self_hosted = \$false/);
  assert.doesNotMatch(source, /Start-Process.*RunAs/i);
});
