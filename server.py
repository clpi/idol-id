#!/usr/bin/env python3
"""idol.id platform server — one codeface, four faces.

Graph Explorer · World Registry · Docs · API console.

Pure stdlib. No secrets are read, sourced, or executed by this server.
Write/admin operations require bearer tokens supplied out-of-band via
IDOL_WRITE_TOKEN / IDOL_ADMIN_TOKEN environment variables.

Usage:
    python3 server.py --app graph --port 8080
    python3 server.py --app lib   --port 8082
    python3 server.py --app docs  --port 8084
    python3 server.py --app api   --port 8081
    python3 server.py --app site  --port 8090
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
IDOL_BIN = os.environ.get("IDOL_BIN", os.path.expanduser("~/idol"))
LIBS_DIR = os.environ.get("IDOL_LIBS_DIR", os.path.expanduser("~/lib"))
REGISTRY_DIR = os.environ.get("IDOL_REGISTRY_DIR", os.path.join(ROOT, "registry"))
MAX_SOURCE = 512 * 1024
RUN_TIMEOUT = 15
COMPILE_TIMEOUT = 30

WRITE_TOKEN = os.environ.get("IDOL_WRITE_TOKEN", "")
ADMIN_TOKEN = os.environ.get("IDOL_ADMIN_TOKEN", "")

_rate = {}
_rate_lock = threading.Lock()
RATE_WINDOW = 60
RATE_MAX = 240


def rate_ok(ip):
    now = time.time()
    with _rate_lock:
        hits = [t for t in _rate.get(ip, []) if now - t < RATE_WINDOW]
        if len(hits) >= RATE_MAX:
            return False
        hits.append(now)
        _rate[ip] = hits
        return True


def role_of(auth_header):
    """Return 'admin' | 'write' | 'read' | None."""
    if not auth_header.startswith("Bearer "):
        return None
    tok = auth_header[7:].strip()
    if ADMIN_TOKEN and secrets_eq(tok, ADMIN_TOKEN):
        return "admin"
    if WRITE_TOKEN and secrets_eq(tok, WRITE_TOKEN):
        return "write"
    return None


def secrets_eq(a, b):
    if len(a) != len(b):
        return False
    r = 0
    for x, y in zip(a, b):
        r |= ord(x) ^ ord(y)
    return r == 0


def idol(args, stdin=None, timeout=COMPILE_TIMEOUT):
    """Run the compiler. Returns (rc, stdout, stderr)."""
    try:
        p = subprocess.run([IDOL_BIN] + args, capture_output=True, text=True,
                           timeout=timeout, input=stdin)
        return p.returncode, p.stdout, p.stderr
    except FileNotFoundError:
        return 127, "", f"idol binary not found at {IDOL_BIN}"
    except subprocess.TimeoutExpired:
        return 124, "", "compiler timeout"


def with_tmp_source(source, fn):
    n = uuid.uuid4().hex[:12]
    fd, path = tempfile.mkstemp(suffix=f"_{n}.id", prefix="idolweb_")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(source)
        return fn(path)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def jdump(obj):
    return json.dumps(obj, default=str).encode()


# ----------------------------------------------------------------- registry

REG_LOCK = threading.Lock()


def safe_name(name):
    return bool(re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", name or ""))


def registry_manifest(name):
    p = os.path.join(REGISTRY_DIR, name, "manifest.json")
    if os.path.isfile(p):
        try:
            with open(p) as f:
                return json.load(f)
        except Exception:
            return None
    return None


def scan_registry():
    out = []
    if not os.path.isdir(REGISTRY_DIR):
        return out
    for name in sorted(os.listdir(REGISTRY_DIR)):
        m = registry_manifest(name)
        if not m:
            continue
        out.append({
            "name": name,
            "version": m.get("version"),
            "summary": m.get("summary", ""),
            "world": m.get("world"),
            "published_at": m.get("published_at"),
            "publisher": m.get("publisher"),
            "provenance": m.get("provenance", {}),
            "stats": m.get("stats", {}),
            "graph_id": m.get("graph_id"),
            "tags": m.get("tags", []),
        })
    return out


def scan_libs():
    """Index layout-projected homes (.id files) under LIBS_DIR."""
    libs = []
    if not os.path.isdir(LIBS_DIR):
        return libs
    for fn in sorted(os.listdir(LIBS_DIR)):
        if not fn.endswith(".id"):
            continue
        path = os.path.join(LIBS_DIR, fn)
        try:
            src = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        head = src[:400]
        summary = ""
        m = re.search(r"^--\s*(.+)$", head, re.M)
        if m:
            summary = m.group(1).strip()
        names = re.findall(r"^(?:\w+\s*[:.])?\s*(\w+)\s*=\s*(?:\(|function)", src, re.M)
        libs.append({
            "name": fn[:-3],
            "file": fn,
            "summary": summary,
            "bytes": len(src.encode()),
            "lines": src.count("\n") + 1,
            "relations": sorted(set(names))[:40],
        })
    return libs


def lib_path(name):
    if not safe_name(name):
        return None
    p = os.path.join(LIBS_DIR, name + ".id")
    if not os.path.isfile(p):
        return None
    return p


def compute_lib_detail(path):
    src = open(path, encoding="utf-8", errors="replace").read()
    detail = {"source": src, "graph": None, "explain": None, "sim": None,
              "check": None}
    rc, out, err = idol(["graph", path])
    if rc == 0:
        try:
            detail["graph"] = json.loads(out)
        except Exception:
            pass
    rc, out, err = idol(["explain", path])
    if rc == 0:
        try:
            detail["explain"] = json.loads(out)
        except Exception:
            pass
    rc, out, err = idol(["check", path])
    detail["check"] = {"ok": rc == 0, "output": (out + err).strip()[-4000:]}
    names = re.findall(r"^(?:\w+\s*[:.])*\s*(\w+)\s*=", src, re.M)
    detail["stats"] = {
        "lines": src.count("\n") + 1,
        "bytes": len(src.encode()),
        "relations": len(set(names)),
        "source_hash": hashlib.sha256(src.encode()).hexdigest()[:16],
    }
    return detail


def dependents_of(subject):
    """Scan libs + registry for sources referencing subject."""
    hits = []
    for lib in scan_libs() + [{"name": w["name"], "file": None} for w in scan_registry()]:
        name = lib["name"]
        p = lib_path(name) or os.path.join(REGISTRY_DIR, name, "source.id")
        if not p or not os.path.isfile(p):
            continue
        try:
            src = open(p, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        if re.search(r"\b" + re.escape(subject) + r"\b", src):
            hits.append(name)
    return hits


def publish(name, version, source, summary, meta):
    if not safe_name(name):
        return None, "invalid name"
    if not version or not re.fullmatch(r"[0-9A-Za-z.+-]{1,32}", version):
        return None, "invalid version"
    with REG_LOCK:
        d = os.path.join(REGISTRY_DIR, name)
        os.makedirs(os.path.join(d, "versions"), exist_ok=True)
        with open(os.path.join(d, "versions", version + ".id"), "w") as f:
            f.write(source)
        with open(os.path.join(d, "source.id"), "w") as f:
            f.write(source)
        g = None
        def grab(path):
            rc, out, _ = idol(["graph", path])
            if rc == 0:
                try:
                    return json.loads(out)
                except Exception:
                    return None
            return None
        g = with_tmp_source(source, grab)
        stats = {
            "lines": source.count("\n") + 1,
            "bytes": len(source.encode()),
            "source_hash": hashlib.sha256(source.encode()).hexdigest()[:16],
        }
        manifest = {
            "name": name,
            "version": version,
            "summary": summary or "",
            "publisher": meta.get("publisher", ""),
            "published_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "provenance": meta.get("provenance", {}),
            "stats": stats,
            "graph_id": (g or {}).get("source_hash"),
            "tags": meta.get("tags", []),
            "versions": versions_of(name),
        }
        with open(os.path.join(d, "manifest.json"), "w") as f:
            json.dump(manifest, f, indent=1)
        return manifest, None


def versions_of(name):
    vd = os.path.join(REGISTRY_DIR, name, "versions")
    if not os.path.isdir(vd):
        return []
    return sorted(v[:-3] for v in os.listdir(vd) if v.endswith(".id"))


# ----------------------------------------------------------------- analysis

def analyze(source):
    """One pass: graph + explain + check. Graph powers the token explorer."""
    out = {"graph": None, "explain": None, "check": None, "authority": None}

    def work(path):
        rc, o, e = idol(["graph", path])
        if rc == 0:
            try:
                out["graph"] = json.loads(o)
            except Exception:
                out["check"] = {"ok": False, "output": o[-2000:]}
        else:
            out["check"] = {"ok": False, "output": (o + e)[-4000:]}
        rc, o, e = idol(["explain", path])
        if rc == 0:
            try:
                out["explain"] = json.loads(o)
            except Exception:
                pass
        if out["check"] is None:
            rc, o, e = idol(["check", path])
            out["check"] = {"ok": rc == 0, "output": (o + e)[-2000:]}
        return out
    return with_tmp_source(source, work)


def lower_text(source, target, emit, opt):
    """Emit to a temp dir and read the artifact back."""
    def work(path):
        outdir = tempfile.mkdtemp(prefix="idolweb_emit_")
        stem = os.path.basename(path)[:-3]
        args = ["compile", path, "--target", target, "--emit", emit,
                "-o", os.path.join(outdir, stem), "-O" + opt]
        if emit == "c":
            args += ["--backend=c"]
        elif emit == "wasm":
            args += ["--backend=wasm"]
        rc, o, e = idol(args)
        text = ""
        if rc == 0:
            for cand in (stem + ".s", stem + ".c", stem + ".wasm", stem + ".wat",
                         stem + ".o", stem):
                p = os.path.join(outdir, cand)
                if os.path.isfile(p):
                    data = open(p, "rb").read()
                    if cand.endswith(".wasm") or cand.endswith(".o"):
                        text = f"({len(data)} bytes binary; {cand})"
                    else:
                        text = data.decode("utf-8", "replace")[:100000]
                    break
        for f in os.listdir(outdir):
            try:
                os.unlink(os.path.join(outdir, f))
            except OSError:
                pass
        try:
            os.rmdir(outdir)
        except OSError:
            pass
        return {"rc": rc, "ok": rc == 0, "text": text,
                "stderr": e[-4000:], "stdout": o[-2000:]}
    return with_tmp_source(source, work)


def run_source(source, args):
    def work(path):
        rc, o, e = idol(["run", path] + args, timeout=RUN_TIMEOUT)
        return {"rc": rc, "stdout": o[-30000:], "stderr": e[-6000:]}
    return with_tmp_source(source, work)


def fmt_source(source):
    def work(path):
        rc, o, e = idol(["fmt", path])
        if rc == 0 and os.path.isfile(path):
            try:
                return {"ok": True, "source": open(path).read()}
            except OSError:
                pass
        return {"ok": False, "output": (o + e)[-2000:]}
    return with_tmp_source(source, work)


# ----------------------------------------------------------------- provenance

def whys(subject):
    """Best-effort provenance: graph facts mentioning the subject."""
    facts = []
    for lib in scan_libs():
        p = lib_path(lib["name"])
        if not p:
            continue
        rc, o, _ = idol(["graph", p])
        if rc != 0:
            continue
        try:
            g = json.loads(o)
        except Exception:
            continue
        for n in g.get("nodes", []):
            if n.get("name") == subject:
                facts.append({
                    "label": "graph identity",
                    "cause": f"{lib['name']}.id declares `{subject}` "
                             f"as {n.get('kind')} (node {n.get('id')})",
                    "detail": f"line {n.get('line')}, col {n.get('col')}",
                })
    if not facts:
        for w in scan_registry():
            m = registry_manifest(w["name"]) or {}
            if w["name"] == subject or m.get("world") == subject:
                facts.append({
                    "label": "registry identity",
                    "cause": f"`{w['name']}` is a published world "
                             f"(v{w.get('version')})",
                    "detail": w.get("summary", ""),
                })
    return {"subject": subject, "facts": facts}


# ----------------------------------------------------------------- handler

MIME = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "idol-id/1.0"
    protocol_version = "HTTP/1.1"
    app = "graph"
    instance = os.environ.get("IDOL_INSTANCE", "")

    def log_message(self, fmt, *a):
        pass

    # -- plumbing

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "https://" + self.headers.get("Host", "idol.id"))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def reply(self, code, body, ctype="application/json", cache=None):
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if cache:
            self.send_header("Cache-Control", cache)
        self.cors()
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def jok(self, obj):
        self.reply(200, jdump(obj))

    def jerr(self, code, msg):
        self.reply(code, jdump({"error": msg}))

    def body_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_SOURCE * 4:
            return None
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw.decode() or "{}")
        except Exception:
            return None

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    # -- static

    def serve_static(self, path):
        if path == "/":
            path = "/apps/%s/index.html" % self.app
        rel = path.lstrip("/")
        if rel.startswith("apps/") and not rel.startswith("apps/shared"):
            pass
        fp = os.path.realpath(os.path.join(ROOT, rel))
        if not fp.startswith(os.path.realpath(ROOT)) or not os.path.isfile(fp):
            return False
        ext = os.path.splitext(fp)[1]
        self.reply(200, open(fp, "rb").read(), MIME.get(ext, "application/octet-stream"),
                   cache="public, max-age=60")
        return True

    # -- GET

    def do_GET(self):
        if not rate_ok(self.client_address[0]):
            return self.jerr(429, "rate limited")
        u = urlparse(self.path)
        p = unquote(u.path)
        q = parse_qs(u.query)

        if p.startswith("/api/"):
            return self.api(p, q, None)

        if p == "/health":
            return self.jok({"status": "healthy", "app": self.app,
                             "instance": self.instance,
                             "idol": IDOL_BIN,
                             "idol_ok": os.access(IDOL_BIN, os.X_OK)})
        if p == "/info":
            rc, out, _ = idol(["authority"])
            return self.jok({
                "service": "idol.id platform", "version": "1.0.0",
                "app": self.app, "instance": self.instance,
                "authority": out.strip()[:500],
            })
        if p == "/config.js":
            body = ("window.IDOL = {app: %s, instance: %s, api: ''};"
                    % (json.dumps(self.app), json.dumps(self.instance)))
            return self.reply(200, body, MIME[".js"])

        if self.serve_static(p):
            return
        # pretty route for app faces
        for face in ("graph", "lib", "docs", "api", "site"):
            if p == "/" + face or p == "/" + face + "/":
                if self.serve_static("/apps/%s/index.html" % face):
                    return
                return self.jerr(404, "not found")
        return self.jerr(404, "not found")

    # -- POST

    def do_POST(self):
        if not rate_ok(self.client_address[0]):
            return self.jerr(429, "rate limited")
        u = urlparse(self.path)
        p = unquote(u.path)
        body = self.body_json()
        if body is None:
            return self.jerr(400, "invalid JSON body")
        return self.api(p, parse_qs(u.query), body)

    # -- API dispatch

    def api(self, p, q, body):
        if p == "/api/analyze" and body is not None:
            src = body.get("source", "")
            if not src or len(src) > MAX_SOURCE:
                return self.jerr(400, "source missing or too large")
            return self.jok(analyze(src))

        if p == "/api/fmt" and body is not None:
            src = body.get("source", "")
            if not src or len(src) > MAX_SOURCE:
                return self.jerr(400, "source missing or too large")
            return self.jok(fmt_source(src))

        if p == "/api/lower" and body is not None:
            src = body.get("source", "")
            target = body.get("target", "native")
            emit = body.get("emit", "asm")
            opt = str(body.get("opt", "3"))
            if emit not in ("asm", "c", "wasm") or target not in (
                    "native", "wasm32-wasi", "aarch64-macos", "aarch64-linux"):
                return self.jerr(400, "unsupported target/emit")
            if not src or len(src) > MAX_SOURCE:
                return self.jerr(400, "source missing or too large")
            return self.jok(lower_text(src, target, emit, opt))

        if p == "/api/run" and body is not None:
            src = body.get("source", "")
            if not src or len(src) > MAX_SOURCE:
                return self.jerr(400, "source missing or too large")
            args = body.get("args", [])
            if not isinstance(args, list) or len(args) > 16:
                return self.jerr(400, "bad args")
            args = [str(a)[:256] for a in args]
            return self.jok(run_source(src, args))

        # ---- registry (read)
        if p == "/api/libs":
            return self.jok({"libs": scan_libs()})
        if p == "/api/worlds":
            return self.jok({"worlds": scan_registry()})
        if p == "/api/lib" or p.startswith("/api/lib/"):
            parts = p.split("/")[3:]
            name = parts[0] if parts else ""
            sub = parts[1] if len(parts) > 1 else ""
            if not name:
                return self.jerr(400, "name required")
            reg = registry_manifest(name)
            if reg is not None:
                if not sub:
                    return self.jok(reg)
                if sub == "source":
                    fp = os.path.join(REGISTRY_DIR, name, "source.id")
                    if os.path.isfile(fp):
                        return self.reply(200, open(fp).read(), "text/plain; charset=utf-8")
                if sub == "versions":
                    return self.jok({"versions": versions_of(name)})
                if sub == "version":
                    v = parts[2] if len(parts) > 2 else ""
                    fp = os.path.join(REGISTRY_DIR, name, "versions", v + ".id")
                    if safe_name(v) and os.path.isfile(fp):
                        return self.reply(200, open(fp).read(), "text/plain; charset=utf-8")
                if sub == "dependents":
                    return self.jok({"dependents": dependents_of(name)})
                if sub == "detail":
                    fp = os.path.join(REGISTRY_DIR, name, "source.id")
                    if os.path.isfile(fp):
                        return self.jok(compute_lib_detail(fp))
                return self.jerr(404, "not found")
            lp = lib_path(name)
            if not lp:
                return self.jerr(404, "unknown library")
            if not sub or sub == "detail":
                return self.jok(compute_lib_detail(lp))
            if sub == "source":
                return self.reply(200, open(lp).read(), "text/plain; charset=utf-8")
            if sub == "dependents":
                return self.jok({"dependents": dependents_of(name)})
            return self.jerr(404, "not found")

        # ---- provenance
        if p == "/api/whys":
            subj = (q.get("subject") or [body.get("subject", "") if body else ""])[0]
            if not subj or len(subj) > 128:
                return self.jerr(400, "subject required")
            return self.jok(whys(subj.strip()))
        if p == "/api/authority":
            rc, out, err = idol(["authority"])
            try:
                return self.jok(json.loads(out))
            except Exception:
                return self.jok({"raw": (out + err)[:1000]})

        # ---- registry (write)
        if p == "/api/publish" and body is not None:
            role = role_of(self.headers.get("Authorization", ""))
            if role not in ("write", "admin"):
                return self.reply(401, jdump({"error": "write token required"}))
            m, err = publish(
                body.get("name", ""), body.get("version", "0.1.0"),
                body.get("source", ""), body.get("summary", ""),
                body.get("meta", {}))
            if err:
                return self.jerr(400, err)
            return self.jok(m)

        return self.jerr(404, "unknown endpoint " + p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", default="graph",
                    choices=["graph", "lib", "docs", "api", "site"])
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--host", default="0.0.0.0")
    a = ap.parse_args()
    Handler.app = a.app
    os.makedirs(REGISTRY_DIR, exist_ok=True)
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    srv.daemon_threads = True
    name = {"graph": "Graph Explorer", "lib": "World Registry",
            "docs": "Docs", "api": "API", "site": "Site"}[a.app]
    print(f"idol.id {name} — http://{a.host}:{a.port}  (idol={IDOL_BIN})")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
