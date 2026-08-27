import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authority = "f1dfa2c36e1f495f97bd9282b3f93e4cbc812d99";
const canonical = "https://github.com/clpi/idol.git";

test("Unix installer is user-local, authority-pinned, and honest about bootstrap status", async () => {
  const source = await readFile("content/install.sh", "utf8");
  assert.match(source, new RegExp(authority));
  assert.match(source, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /IDOL_REPOSITORY overrides are not admitted/);
  assert.match(source, /git -C .* rev-parse HEAD/);
  assert.match(source, /zig build -Doptimize=ReleaseFast/);
  assert.match(source, /bootstrap seed/);
  assert.match(source, /"repository": "clpi\/idol"/);
  assert.match(source, /"source": "\$CANONICAL_IDOL_REPOSITORY"/);
  assert.match(source, /self_hosted.*false/s);
  assert.doesNotMatch(source, /\bsudo\b/);
  assert.match(source, /\$HOME\}\/\.local|\$\{HOME\}\/\.local/);
});

test("PowerShell installer is user-local, authority-pinned, and verifies canonical provenance", async () => {
  const source = await readFile("content/install.ps1", "utf8");
  assert.match(source, new RegExp(authority));
  assert.match(source, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /IDOL_REPOSITORY overrides are not admitted/);
  assert.match(source, /rev-parse HEAD/);
  assert.match(source, /zig build -Doptimize=ReleaseFast/);
  assert.match(source, /bootstrap-seed/);
  assert.match(source, /repository = "clpi\/idol"/);
  assert.match(source, /source = \$canonicalRepository/);
  assert.match(source, /self_hosted = \$false/);
  assert.doesNotMatch(source, /Start-Process.*RunAs/i);
});
