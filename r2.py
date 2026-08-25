#!/usr/bin/env python3
"""r2.py — Cloudflare R2 object store for the idol.id registry.

Pure stdlib (urllib + hmac). AWS SigV4 against the R2 S3 endpoint.
Enabled only when R2_* env vars are present; otherwise the registry
stays local-disk.

Env:
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT (default https://<acct>.r2.cloudflarestorage.com),
  R2_BUCKET   (default idol-registry)
"""
import datetime
import hashlib
import hmac
import json
import os
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

REGION = "auto"
SERVICE = "s3"


def _cfg():
    acct = os.environ.get("R2_ACCOUNT_ID", "")
    key = os.environ.get("R2_ACCESS_KEY_ID", "")
    sec = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    if not (acct and key and sec):
        return None
    return {
        "acct": acct,
        "key": key,
        "sec": sec,
        "endpoint": os.environ.get(
            "R2_ENDPOINT", f"https://{acct}.r2.cloudflarestorage.com"),
        "bucket": os.environ.get("R2_BUCKET", "idol-registry"),
    }


CFG = _cfg()
ENABLED = CFG is not None


def _uri_encode(s, encode_slash=True):
    out = []
    for b in s.encode("utf-8"):
        c = chr(b)
        keep = (c.isalnum() and c.isascii()) or c in "-_.~"
        if c == "/" and not encode_slash:
            keep = True
        out.append(c if keep else "%%%02X" % b)
    return "".join(out)


def _sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def _request(method, path, body=b"", ctype="application/octet-stream", q=None):
    """path: object key without leading slash. q: dict of query params."""
    if not CFG:
        raise RuntimeError("R2 not configured")
    host = CFG["endpoint"].split("://", 1)[1]
    # canonical request
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    datestamp = amz_date[:8]
    canon_qs = ""
    if q:
        canon_qs = "&".join(f"{_uri_encode(k)}={_uri_encode(v)}"
                            for k, v in sorted(q.items()))
    payload_hash = hashlib.sha256(body).hexdigest()
    # unsigned-payload would avoid hashing twice; payload is small — hash it
    canonical = "\n".join([
        method,
        f"/{CFG['bucket']}/{_uri_encode(path, encode_slash=False)}",
        canon_qs,
        f"host:{host}\nx-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n",
        "host;x-amz-content-sha256;x-amz-date",
        payload_hash,
    ])
    scope = f"{datestamp}/{REGION}/{SERVICE}/aws4_request"
    sts = "\n".join([
        "AWS4-HMAC-SHA256",
        amz_date,
        scope,
        hashlib.sha256(canonical.encode()).hexdigest(),
    ])
    k = _sign(_sign(_sign(_sign(
        ("AWS4" + CFG["sec"]).encode(), datestamp), REGION), SERVICE),
        "aws4_request")
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    auth = (f"AWS4-HMAC-SHA256 Credential={CFG['key']}/{scope}, "
            f"SignedHeaders=host;x-amz-content-sha256;x-amz-date, "
            f"Signature={sig}")
    url = f"{CFG['endpoint']}/{CFG['bucket']}/{_uri_encode(path)}"
    if canon_qs:
        url += "?" + canon_qs
    req = urllib.request.Request(url, data=body if method in ("PUT", "POST") else None,
                                 method=method)
    req.add_header("Authorization", auth)
    req.add_header("x-amz-date", amz_date)
    req.add_header("x-amz-content-sha256", payload_hash)
    req.add_header("Host", host)
    if body:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def ensure_bucket():
    """Create the registry bucket if missing (idempotent)."""
    if not CFG:
        return False, "r2 disabled"
    host = CFG["endpoint"].split("://", 1)[1]
    # bucket-level PUT to endpoint (not bucket host)
    amz_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    datestamp = amz_date[:8]
    payload_hash = hashlib.sha256(b"").hexdigest()
    canonical = "\n".join([
        "PUT", f"/{CFG['bucket']}", "",
        f"host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n",
        "host;x-amz-content-sha256;x-amz-date", payload_hash,
    ])
    scope = f"{datestamp}/{REGION}/{SERVICE}/aws4_request"
    sts = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope,
                     hashlib.sha256(canonical.encode()).hexdigest()])
    k = _sign(_sign(_sign(_sign(
        ("AWS4" + CFG["sec"]).encode(), datestamp), REGION), SERVICE),
        "aws4_request")
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    auth = (f"AWS4-HMAC-SHA256 Credential={CFG['key']}/{scope}, "
            f"SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature={sig}")
    req = urllib.request.Request(f"{CFG['endpoint']}/{CFG['bucket']}",
                                 data=b"", method="PUT")
    req.add_header("Authorization", auth)
    req.add_header("x-amz-date", amz_date)
    req.add_header("x-amz-content-sha256", payload_hash)
    req.add_header("Host", host)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status in (200, 201, 409), f"bucket ok ({r.status})"
    except urllib.error.HTTPError as e:
        # 409 bucket already owned by you — fine
        return e.code == 409, f"bucket http {e.code}: {e.read()[:200]}"


def put(key, data, ctype="application/octet-stream"):
    if isinstance(data, str):
        data = data.encode()
    st, body = _request("PUT", key, data, ctype)
    return st == 200, body[:200]


def get(key):
    st, body = _request("GET", key)
    if st != 200:
        return None, f"http {st}"
    return body, None


def delete(key):
    st, body = _request("DELETE", key)
    return st in (200, 204), body[:200]


def list_prefix(prefix=""):
    """List objects under prefix. Returns {key: {size, etag}}."""
    st, body = _request("GET", "", q={"list-type": "2", "prefix": prefix,
                                      "max-keys": "1000"})
    if st != 200:
        return None, f"http {st}: {body[:200]}"
    out = {}
    root = ET.fromstring(body)
    ns = "{http://s3.amazonaws.com/doc/2006-03-01/}"
    for c in root.findall(f"{ns}Contents"):
        k = c.findtext(f"{ns}Key")
        sz = int(c.findtext(f"{ns}Size") or 0)
        et = (c.findtext(f"{ns}ETag") or "").strip('"')
        out[k] = {"size": sz, "etag": et}
    return out, None


def manifest_key(name):
    return f"worlds/{name}/manifest.json"


def source_key(name, version):
    return f"worlds/{name}/versions/{version}.id"


def put_manifest(name, manifest):
    return put(manifest_key(name), json.dumps(manifest, indent=1),
               "application/json")


def get_manifest(name):
    b, err = get(manifest_key(name))
    if b is None:
        return None, err
    try:
        return json.loads(b), None
    except Exception as e:
        return None, str(e)


def list_manifests():
    """All published world manifests from R2."""
    objs, err = list_prefix("worlds/")
    if objs is None:
        return None, err
    out = {}
    for k in objs:
        if not k.endswith("/manifest.json"):
            continue
        name = k.split("/")[1]
        m, _ = get_manifest(name)
        if m:
            out[name] = m
    return out, None


def put_version(name, version, source):
    return put(source_key(name, version), source, "text/plain; charset=utf-8")


def get_version(name, version):
    b, err = get(source_key(name, version))
    if b is None:
        return None, err
    return b.decode("utf-8", "replace"), None
