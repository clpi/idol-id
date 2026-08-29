#!/usr/bin/env python3
from pathlib import Path
import base64
import zlib

root = Path(__file__).resolve().parents[1]
payload = "".join((root / f"scripts/.studio-payload-{index:02d}").read_text().strip() for index in range(9))
source = zlib.decompress(base64.b64decode(payload)).decode("utf8")
source = source.replace(
    "source, count = pattern.subn(replacement, source, count=1)",
    "source, count = pattern.subn(lambda _: replacement, source, count=1)",
)
exec(compile(source, "apply-unified-studio.py", "exec"))
