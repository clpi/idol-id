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

# Keep Live as a contextual tool, not a seventh primary product. Some earlier
# payload revisions still contained it in SURFACES; converge them here.
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
shell.write_text(current)

# The replacement contract counts primary surface records, not every textual
# label token. Retire the earlier RED-only assertion and obsolete root rewrite
# contract that the unified Studio test supersedes.
studio_test = root / "test/idol-current-surface.test.mjs"
if studio_test.exists():
    current = studio_test.read_text().replace(
        '(primary.match(/label:/g) || []).length',
        '(primary.match(/id:/g) || []).length',
    )
    studio_test.write_text(current)

for path in (root / "test").glob("*.test.mjs"):
    current = path.read_text(errors="replace")
    if "homepage opens as a working Idol semantic instrument" in current:
        path.unlink()
