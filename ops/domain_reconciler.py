#!/usr/bin/env python3
"""Plan and apply conservative Cloudflare DNS repairs for Idol surfaces.

The reconciler deliberately does less than a conventional desired-state tool:

* Hermes and Claw are hard-excluded.
* It never invents an origin.
* It never changes tunnel ingress, Pages configuration, Workers routes, or
  deletes DNS records.
* It mutates DNS only when exactly one live, exact owner exists.
* A healthy public surface with noncanonical control-plane state is reported
  for review rather than repointed.

This makes it suitable as the first repair layer while origin/application
failures are handled by their owning deployment.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


SCHEMA = "idol.domain.reconciliation-plan.v1"
DEFAULT_EXCLUDED = frozenset({"hermes.idol.id", "claw.idol.id"})
ACTIVE_TUNNEL_STATES = frozenset({"healthy", "degraded", "active", "up"})
ACTIVE_PAGES_STATES = frozenset({"active", "verified", "ready"})
SUPPORTED_ACTIONS = frozenset({"create_dns", "update_dns"})


def normalize_host(value: Any) -> str:
    return str(value or "").strip().rstrip(".").lower()


def root_probe(snapshot: dict[str, Any], host: str) -> dict[str, Any] | None:
    candidates = [
        item
        for item in snapshot.get("http", [])
        if normalize_host(item.get("host")) == host and str(item.get("path") or "") == "/"
    ]
    return candidates[-1] if candidates else None


def public_healthy(probe: dict[str, Any] | None) -> bool:
    if not probe:
        return False
    try:
        code = int(probe.get("http") or 0)
        ssl_result = int(probe.get("ssl_verify_result") or 0)
    except (TypeError, ValueError):
        return False
    return 200 <= code < 400 and ssl_result == 0


def tunnel_is_live(item: dict[str, Any]) -> bool:
    status = str(item.get("status") or "").strip().lower()
    try:
        count = int(item.get("connection_count") or 0)
    except (TypeError, ValueError):
        count = 0
    return status in ACTIVE_TUNNEL_STATES and count > 0


def pages_is_live(item: dict[str, Any]) -> bool:
    return str(item.get("status") or "").strip().lower() in ACTIVE_PAGES_STATES


def route_host(pattern: Any) -> str:
    value = str(pattern or "").strip()
    if not value:
        return ""
    value = value.split("/", 1)[0]
    return normalize_host(value.lstrip("*."))


@dataclass(frozen=True)
class Owner:
    kind: str
    host: str
    target: str
    name: str
    evidence: dict[str, Any]

    def public(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "host": self.host,
            "target": self.target,
            "name": self.name,
            "evidence": self.evidence,
        }


def _owners(snapshot: dict[str, Any]) -> tuple[dict[str, list[Owner]], dict[str, list[dict[str, Any]]]]:
    live: dict[str, list[Owner]] = defaultdict(list)
    inactive: dict[str, list[dict[str, Any]]] = defaultdict(list)

    tunnels = {
        str(item.get("id") or ""): item
        for item in snapshot.get("tunnels", [])
        if item.get("id")
    }
    for ingress in snapshot.get("tunnel_ingress", []):
        host = normalize_host(ingress.get("hostname"))
        tunnel_id = str(ingress.get("tunnel_id") or "").strip()
        if not host or not tunnel_id:
            continue
        tunnel = tunnels.get(tunnel_id, {})
        evidence = {
            "tunnel_id": tunnel_id,
            "tunnel_name": ingress.get("tunnel_name") or tunnel.get("name"),
            "tunnel_status": tunnel.get("status"),
            "connection_count": tunnel.get("connection_count", 0),
            "service": ingress.get("service"),
        }
        if tunnel_is_live(tunnel):
            live[host].append(
                Owner(
                    kind="cloudflare_tunnel",
                    host=host,
                    target=f"{tunnel_id}.cfargotunnel.com",
                    name=str(ingress.get("tunnel_name") or tunnel.get("name") or tunnel_id),
                    evidence=evidence,
                )
            )
        else:
            inactive[host].append({"kind": "cloudflare_tunnel", **evidence})

    for domain in snapshot.get("pages_domains", []):
        host = normalize_host(domain.get("host") or domain.get("domain"))
        target = normalize_host(domain.get("target"))
        if not host or not target:
            continue
        evidence = {
            "project": domain.get("project"),
            "status": domain.get("status"),
            "target": target,
        }
        if pages_is_live(domain):
            live[host].append(
                Owner(
                    kind="cloudflare_pages",
                    host=host,
                    target=target,
                    name=str(domain.get("project") or target),
                    evidence=evidence,
                )
            )
        else:
            inactive[host].append({"kind": "cloudflare_pages", **evidence})

    return live, inactive


def _dedupe_owners(items: Iterable[Owner]) -> list[Owner]:
    by_identity: dict[tuple[str, str, str], Owner] = {}
    for item in items:
        by_identity[(item.kind, item.target, item.name)] = item
    return sorted(by_identity.values(), key=lambda x: (x.kind, x.target, x.name))


def _manual(host: str, reason: str, **extra: Any) -> dict[str, Any]:
    return {"host": host, "reason": reason, **extra}


def build_plan(snapshot: dict[str, Any]) -> dict[str, Any]:
    zone = normalize_host(snapshot.get("zone") or "idol.id")
    excluded = {normalize_host(x) for x in snapshot.get("excluded", []) if normalize_host(x)}
    excluded |= set(DEFAULT_EXCLUDED)

    dns_by_host: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in snapshot.get("dns", []):
        host = normalize_host(record.get("name"))
        if host:
            dns_by_host[host].append(record)

    owners, inactive_owners = _owners(snapshot)
    worker_hosts: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for route in snapshot.get("worker_routes", []):
        host = route_host(route.get("pattern"))
        if host:
            worker_hosts[host].append(route)

    hosts = {zone}
    hosts.update(dns_by_host)
    hosts.update(owners)
    hosts.update(inactive_owners)
    hosts.update(worker_hosts)
    hosts.update(
        normalize_host(item.get("host"))
        for item in snapshot.get("http", [])
        if normalize_host(item.get("host"))
    )

    actions: list[dict[str, Any]] = []
    manual: list[dict[str, Any]] = []
    observed: list[dict[str, Any]] = []

    for host in sorted(hosts):
        if not host or host in excluded:
            continue
        records = sorted(
            dns_by_host.get(host, []),
            key=lambda r: (str(r.get("type") or ""), str(r.get("content") or ""), str(r.get("id") or "")),
        )
        live_owners = _dedupe_owners(owners.get(host, []))
        inactive = inactive_owners.get(host, [])
        probe = root_probe(snapshot, host)
        healthy = public_healthy(probe)
        observed.append(
            {
                "host": host,
                "dns_count": len(records),
                "owners": [item.public() for item in live_owners],
                "inactive_owners": inactive,
                "worker_routes": worker_hosts.get(host, []),
                "root_probe": probe,
                "public_healthy": healthy,
            }
        )

        if len(records) > 1:
            manual.append(
                _manual(
                    host,
                    "multiple_dns_records",
                    records=[
                        {
                            "id": r.get("id"),
                            "type": r.get("type"),
                            "content": r.get("content"),
                            "proxied": r.get("proxied"),
                        }
                        for r in records
                    ],
                    owners=[item.public() for item in live_owners],
                )
            )
            continue

        if len(live_owners) > 1:
            manual.append(
                _manual(host, "ambiguous_authority", owners=[item.public() for item in live_owners])
            )
            continue

        if len(live_owners) == 1:
            owner = live_owners[0]
            authority = owner.public()
            if not records:
                actions.append(
                    {
                        "kind": "create_dns",
                        "host": host,
                        "type": "CNAME",
                        "content": owner.target,
                        "proxied": True,
                        "ttl": 1,
                        "reason": "unique_live_exact_owner_missing_dns",
                        "authority": authority,
                    }
                )
                continue

            record = records[0]
            current_type = str(record.get("type") or "").upper()
            current_content = normalize_host(record.get("content"))
            current_proxied = bool(record.get("proxied"))
            canonical = current_type == "CNAME" and current_content == owner.target

            if canonical and current_proxied:
                continue

            if canonical and not current_proxied:
                actions.append(
                    {
                        "kind": "update_dns",
                        "record_id": record.get("id"),
                        "host": host,
                        "type": "CNAME",
                        "content": owner.target,
                        "proxied": True,
                        "ttl": 1,
                        "reason": "cloudflare_owned_record_must_be_proxied",
                        "authority": authority,
                        "before": {
                            "type": current_type,
                            "content": record.get("content"),
                            "proxied": current_proxied,
                            "ttl": record.get("ttl"),
                        },
                    }
                )
                continue

            if healthy:
                manual.append(
                    _manual(
                        host,
                        "healthy_public_surface_has_noncanonical_dns",
                        record={
                            "id": record.get("id"),
                            "type": current_type,
                            "content": record.get("content"),
                            "proxied": current_proxied,
                        },
                        authority=authority,
                        root_probe=probe,
                    )
                )
                continue

            actions.append(
                {
                    "kind": "update_dns",
                    "record_id": record.get("id"),
                    "host": host,
                    "type": "CNAME",
                    "content": owner.target,
                    "proxied": True,
                    "ttl": 1,
                    "reason": "unhealthy_surface_has_unique_live_exact_owner",
                    "authority": authority,
                    "before": {
                        "type": current_type,
                        "content": record.get("content"),
                        "proxied": current_proxied,
                        "ttl": record.get("ttl"),
                    },
                }
            )
            continue

        if worker_hosts.get(host) and not records:
            manual.append(
                _manual(
                    host,
                    "worker_route_has_no_authoritative_dns_origin",
                    worker_routes=worker_hosts[host],
                )
            )
        elif inactive:
            manual.append(
                _manual(
                    host,
                    "only_inactive_authority_exists",
                    inactive_owners=inactive,
                    records=records,
                    root_probe=probe,
                )
            )
        elif records:
            manual.append(
                _manual(
                    host,
                    "no_authoritative_owner",
                    records=records,
                    root_probe=probe,
                )
            )
        elif probe:
            manual.append(_manual(host, "observed_host_has_no_dns_or_owner", root_probe=probe))

    plan = {
        "schema": SCHEMA,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "zone": zone,
        "zone_id": snapshot.get("zone_id"),
        "excluded": sorted(excluded),
        "actions": sorted(actions, key=lambda x: (x["host"], x["kind"])),
        "manual": sorted(manual, key=lambda x: (x["host"], x["reason"])),
        "observed": observed,
        "summary": {
            "host_count": len(observed),
            "automatic_action_count": len(actions),
            "manual_decision_count": len(manual),
        },
    }
    return plan


def _request_json(method: str, url: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, separators=(",", ":")).encode()
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "idol-domain-reconciler/1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:2000]
        raise RuntimeError(f"Cloudflare HTTP {exc.code}: {detail}") from exc
    if not result.get("success"):
        raise RuntimeError(f"Cloudflare rejected mutation: {json.dumps(result.get('errors', []))}")
    return result


def apply_plan(
    plan: dict[str, Any],
    *,
    account_token: str,
    api_base: str = "https://api.cloudflare.com/client/v4",
    dry_run: bool = False,
) -> dict[str, Any]:
    if plan.get("schema") != SCHEMA:
        raise ValueError(f"unsupported plan schema: {plan.get('schema')!r}")
    zone_id = str(plan.get("zone_id") or "").strip()
    if not zone_id:
        raise ValueError("plan has no zone_id")
    excluded = {normalize_host(x) for x in plan.get("excluded", [])} | set(DEFAULT_EXCLUDED)
    results: list[dict[str, Any]] = []

    for action in plan.get("actions", []):
        kind = action.get("kind")
        host = normalize_host(action.get("host"))
        if kind not in SUPPORTED_ACTIONS:
            raise ValueError(f"unsupported action kind: {kind!r}")
        if host in excluded:
            raise ValueError(f"refusing excluded host mutation: {host}")
        if str(action.get("type") or "").upper() != "CNAME":
            raise ValueError(f"refusing non-CNAME mutation for {host}")
        content = normalize_host(action.get("content"))
        if not content or not (
            content.endswith(".cfargotunnel.com") or content.endswith(".pages.dev")
        ):
            raise ValueError(f"refusing unrecognized authority target for {host}: {content}")

        payload = {
            "type": "CNAME",
            "name": host,
            "content": content,
            "proxied": True,
            "ttl": 1,
            "comment": f"Managed by Idol domain reconciler; {action.get('reason', 'exact authority')}",
        }
        if dry_run:
            results.append({"host": host, "kind": kind, "dry_run": True, "payload": payload})
            continue

        if kind == "create_dns":
            method = "POST"
            url = f"{api_base}/zones/{zone_id}/dns_records"
        else:
            record_id = str(action.get("record_id") or "").strip()
            if not record_id:
                raise ValueError(f"update action for {host} has no record_id")
            method = "PUT"
            url = f"{api_base}/zones/{zone_id}/dns_records/{record_id}"
        response = _request_json(method, url, account_token, payload)
        record = response.get("result") or {}
        results.append(
            {
                "host": host,
                "kind": kind,
                "dry_run": False,
                "record": {
                    "id": record.get("id"),
                    "type": record.get("type"),
                    "name": record.get("name"),
                    "content": record.get("content"),
                    "proxied": record.get("proxied"),
                },
            }
        )

    return {
        "schema": "idol.domain.reconciliation-application.v1",
        "applied_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dry_run": dry_run,
        "results": results,
    }


def _load(path: str | Path) -> dict[str, Any]:
    data = json.loads(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def _write(path: str | Path, data: dict[str, Any]) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    plan_parser = sub.add_parser("plan", help="derive a fenced DNS repair plan")
    plan_parser.add_argument("--snapshot", required=True)
    plan_parser.add_argument("--output", required=True)

    apply_parser = sub.add_parser("apply", help="apply a previously generated plan")
    apply_parser.add_argument("--plan", required=True)
    apply_parser.add_argument("--output", required=True)
    apply_parser.add_argument("--token-env", default="CLOUDFLARE_API_TOKEN")
    apply_parser.add_argument("--api-base", default="https://api.cloudflare.com/client/v4")
    apply_parser.add_argument("--dry-run", action="store_true")

    args = parser.parse_args(argv)
    if args.command == "plan":
        _write(args.output, build_plan(_load(args.snapshot)))
        return 0

    token = os.environ.get(args.token_env, "")
    if not token and not args.dry_run:
        parser.error(f"environment variable {args.token_env} is empty")
    report = apply_plan(
        _load(args.plan),
        account_token=token,
        api_base=args.api_base,
        dry_run=args.dry_run,
    )
    _write(args.output, report)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # concise CI-facing failure, no token material
        print(f"domain reconciler failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
