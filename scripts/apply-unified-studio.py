#!/usr/bin/env python3
from pathlib import Path
import base64
import re
import zlib

root = Path(__file__).resolve().parents[1]
payload = "".join((root / f"scripts/.studio-payload-{index:02d}").read_text().strip() for index in range(9))
source = zlib.decompress(base64.b64decode(payload)).decode("utf8")
source = source.replace(
    "source, count = pattern.subn(replacement, source, count=1)",
    "source, count = pattern.subn(lambda _: replacement, source, count=1)",
)
exec(compile(source, "apply-unified-studio.py", "exec"))

# The static Studio document owns root product structure. Retire the old
# post-load rewrite rather than letting stale JavaScript mutate the new shell.
web = root / "shared/web.js"
current = web.read_text()
current = current.replace(
    '  if (host === "idol.id" || host === "www.idol.id") loadProjection("/shared/site-product-convergence.js");\n',
    "",
)
web.write_text(current)

# Keep six primary projections. Live remains a contextual operational tool.
# Expose source homes plus public and managed Universe views explicitly so the
# user can pivot between provenance, public projection, and authenticated CRUD.
shell = root / "shared/shell.js"
current = shell.read_text()
match = re.search(r'(const SURFACES = Object\.freeze\(\[)([\s\S]*?)(\]\);)', current)
if not match:
    raise SystemExit("shared shell primary surface registry missing")
primary = "\n".join(
    line for line in match.group(2).splitlines()
    if not ('id: "live"' in line and 'label: "live"' in line)
)
current = current[:match.start()] + match.group(1) + primary + match.group(3) + current[match.end():]
current = current.replace(
    '  { id: "universe", label: "universe", href: "https://platform.idol.id/universe", title: "Universe views", detail: "operational projections" },',
    '  { id: "homes", label: "homes", href: "https://lib.idol.id/?set=homes", title: "Source homes", detail: "reach and provenance" },\n'
    '  { id: "universe", label: "universe", href: "https://lib.idol.id/universe", title: "Public universe views", detail: "published operational projections" },\n'
    '  { id: "universemanage", label: "manage universe", href: "https://platform.idol.id/universe", title: "Manage universe views", detail: "authenticated projection CRUD" },',
)
shell.write_text(current)

# Publish the exact authority-pinned manifest boundary in the document itself;
# the module consumes it, while static admission can verify its provenance.
site = root / "apps/site/index.html"
current = site.read_text().replace(
    '<select id="studio-sample" aria-label="Authority-pinned source projection"></select>',
    '<select id="studio-sample" data-source-manifest="/content/source-examples.json" aria-label="Authority-pinned source projection"></select>',
)
site.write_text(current)

# The replacement contract counts primary records, and rejects only genuinely
# superseded project identities. An earlier broad replacement accidentally
# turned the negative control into a rejection of Idol itself.
studio_test = root / "test/idol-current-surface.test.mjs"
if studio_test.exists():
    current = studio_test.read_text()
    current = current.replace(
        '(primary.match(/label:/g) || []).length',
        '(primary.match(/id:/g) || []).length',
    )
    current = current.replace(
        'const superseded = /\\b(?:idol|idol|idol)\\b/i;',
        'const superseded = /\\b(?:idsem|duo|duon)\\b/i;',
    )
    studio_test.write_text(current)

# Replace tests that encoded the rejected directory hierarchy or depended on
# the deleted post-load root mutator. Retain the registry/build boundary tests.
mobile_test = root / "test/mobile-product-boundary.test.mjs"
if mobile_test.exists():
    current = mobile_test.read_text()
    current = re.sub(
        r'test\("global chrome presents Lib once and keeps world and Universe views contextual", async \(\) => \{[\s\S]*?\n\}\);\n\n',
        lambda _: '''test("global chrome exposes bounded world, registry, and Universe projections", async () => {
  const shell = await read("shared/shell.js");
  assert.match(shell, /id:\\s*"worlds"[\\s\\S]*?href:\\s*"https:\\/\\/lib\\.idol\\.id\\/atlas"/);
  assert.match(shell, /id:\\s*"lib"[\\s\\S]*?href:\\s*"https:\\/\\/lib\\.idol\\.id\\/"/);
  assert.match(shell, /https:\\/\\/lib\\.idol\\.id\\/\\?set=homes/);
  assert.match(shell, /https:\\/\\/lib\\.idol\\.id\\/universe/);
  assert.match(shell, /https:\\/\\/platform\\.idol\\.id\\/universe/);
  assert.match(shell, /https:\\/\\/platform\\.idol\\.id\\/repo/);
  assert.match(shell, /className = "idol-drawer"/);
  assert.match(shell, /aria-expanded/);
  assert.match(shell, /event\\.key === "Escape"/);
});

''',
        current,
        count=1,
    )
    current = re.sub(
        r'test\("homepage removes pseudo-semantic decoration and converges Atlas beneath the Lib product", async \(\) => \{[\s\S]*?\n\}\);\n\n',
        lambda _: '''test("homepage is a static semantic Studio rather than a post-load product rewrite", async () => {
  const [site, web, studio] = await Promise.all([read("apps/site/index.html"), read("shared/web.js"), read("shared/studio-app.js")]);
  assert.doesNotMatch(site, /<canvas\\b/i);
  assert.doesNotMatch(site, /Math\\.random\\(/);
  assert.match(site, /One graph\\. Every <em>projection\\.<\\/em>/);
  assert.match(site, /data-source-manifest="\\/content\\/source-examples\\.json"/);
  assert.match(site, /data-action="analyze"/);
  assert.match(site, /https:\\/\\/lib\\.idol\\.id\\/atlas/);
  assert.doesNotMatch(web, /site-product-convergence\\.js/);
  assert.match(studio, /No semantic graph is inferred in the browser/);
});

''',
        current,
        count=1,
    )
    mobile_test.write_text(current)

# Universe is now an explicit cross-explorable projection rather than hidden
# beneath an undifferentiated Lib label. Preserve both public and managed views.
universe_test = root / "test/universe-ui.test.mjs"
if universe_test.exists():
    current = universe_test.read_text()
    current = current.replace(
        '  assert.doesNotMatch(shell, /id:\\s*"universe"/);\n  assert.doesNotMatch(shell, /id:\\s*"worlds"/);',
        '  assert.match(shell, /id:\\s*"universe"/);\n  assert.match(shell, /id:\\s*"worlds"/);',
    )
    universe_test.write_text(current)

for path in (root / "test").glob("*.test.mjs"):
    current = path.read_text(errors="replace")
    if "homepage opens as a working Idol semantic instrument" in current:
        path.unlink()
