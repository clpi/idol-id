import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const canonical = "https://github.com/clpi/idol.git";
const authorityEndpoint = "https://idol.id/runtime/authority.json";

test("Unix installer is user-local, authority-projected, and honest about bootstrap status", async () => {
  const source = await readFile("content/install.sh", "utf8");
  assert.match(source, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, new RegExp(authorityEndpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /IDOL_REPOSITORY overrides are not admitted/);
  assert.match(source, /git -C .* rev-parse HEAD/);
  assert.match(source, /zig build -Doptimize=ReleaseFast/);
  assert.match(source, /bootstrap seed/);
  assert.match(source, /"repository": "clpi\/idol"/);
  assert.match(source, /"source": "\$CANONICAL_IDOL_REPOSITORY"/);
  assert.match(source, /self_hosted.*false/s);
  assert.doesNotMatch(source, /\bsudo\b/);
  assert.match(source, /\$HOME\}\/\.local|\$\{HOME\}\/\.local/);
  assert.doesNotMatch(source, /IDOL_AUTHORITY="\$\{IDOL_AUTHORITY:-[0-9a-f]{40}\}"/);
});

test("PowerShell installer is user-local, authority-projected, and verifies canonical provenance", async () => {
  const source = await readFile("content/install.ps1", "utf8");
  assert.match(source, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, new RegExp(authorityEndpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /Invoke-RestMethod/);
  assert.match(source, /IDOL_REPOSITORY overrides are not admitted/);
  assert.match(source, /rev-parse HEAD/);
  assert.match(source, /zig build -Doptimize=ReleaseFast/);
  assert.match(source, /bootstrap-seed/);
  assert.match(source, /repository = "clpi\/idol"/);
  assert.match(source, /source = \$canonicalRepository/);
  assert.match(source, /self_hosted = \$false/);
  assert.doesNotMatch(source, /Start-Process.*RunAs/i);
  assert.doesNotMatch(source, /else \{ "[0-9a-f]{40}" \}/);
});
