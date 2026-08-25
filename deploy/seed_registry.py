#!/usr/bin/env python3
"""seed_registry.py — publish exemplar worlds through the real publish path.

Usage (from repo root, with R2_* env set and IDOL_BIN pointing at idol):
    python3 deploy/seed_registry.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402

SUMMARIES = {
    "std": "the standard world — base relations every other world assumes",
    "str": "text relations — slice, find, transform",
    "io": "input/output faces — print, read",
    "check": "proof checks — the testing law as a world",
    "bench": "measurement — FTCFTW observation harness",
    "fmt": "formatting — structure to text",
    "bytes": "byte sequences — binary provenance",
    "math": "numeric relations",
}

TAGS = {
    "std": ["core", "base"],
    "check": ["test", "law"],
    "bench": ["measure", "ftcftw"],
    "str": ["text"],
    "io": ["world", "effect"],
    "fmt": ["text"],
    "bytes": ["binary"],
    "math": ["numeric"],
}


def main():
    if not server.r2.ENABLED:
        print("R2 not configured — set R2_* env")
        return 1
    names = sys.argv[1:] or list(SUMMARIES)
    ok = 0
    for n in names:
        p = os.path.join(server.LIBS_DIR, n + ".id")
        if not os.path.isfile(p):
            print(f"skip {n}: no source")
            continue
        src = open(p, encoding="utf-8", errors="replace").read()
        m, err = server.publish(n, "0.1.0", src, SUMMARIES.get(n, ""),
                                {"publisher": "idol.id",
                                 "tags": TAGS.get(n, [])})
        if err:
            print(f"FAIL {n}: {err}")
        else:
            print(f"published {n} v{m['version']} mirror={m['mirror']} "
                  f"lines={m['stats']['lines']}")
            ok += 1
    print(f"{ok}/{len(names)} published")
    return 0 if ok == len(names) else 1


if __name__ == "__main__":
    sys.exit(main())
