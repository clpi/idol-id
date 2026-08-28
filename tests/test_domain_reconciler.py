import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RECONCILER = ROOT / "ops" / "domain_reconciler.py"


def run_plan(snapshot):
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        source = td / "snapshot.json"
        output = td / "plan.json"
        source.write_text(json.dumps(snapshot))
        proc = subprocess.run(
            [sys.executable, str(RECONCILER), "plan", "--snapshot", str(source), "--output", str(output)],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )
        if proc.returncode != 0:
            raise AssertionError(f"planner failed: {proc.stdout}\n{proc.stderr}")
        return json.loads(output.read_text())


def base_snapshot():
    return {
        "schema": "idol.domain.snapshot.v1",
        "zone": "idol.id",
        "zone_id": "zone",
        "excluded": ["hermes.idol.id", "claw.idol.id"],
        "dns": [],
        "tunnels": [],
        "tunnel_ingress": [],
        "pages_domains": [],
        "worker_routes": [],
        "http": [],
    }


class DomainReconcilerTests(unittest.TestCase):
    def test_excluded_hosts_are_never_planned(self):
        s = base_snapshot()
        s["tunnels"] = [{"id": "t1", "name": "primary", "status": "healthy", "connection_count": 2}]
        s["tunnel_ingress"] = [
            {"tunnel_id": "t1", "tunnel_name": "primary", "hostname": "hermes.idol.id", "service": "http://localhost:8787"},
            {"tunnel_id": "t1", "tunnel_name": "primary", "hostname": "claw.idol.id", "service": "http://localhost:18789"},
        ]
        plan = run_plan(s)
        self.assertEqual(plan["actions"], [])
        self.assertEqual(plan["manual"], [])

    def test_missing_dns_is_created_for_one_healthy_exact_tunnel_ingress(self):
        s = base_snapshot()
        s["tunnels"] = [{"id": "t1", "name": "primary", "status": "healthy", "connection_count": 2}]
        s["tunnel_ingress"] = [
            {"tunnel_id": "t1", "tunnel_name": "primary", "hostname": "api.idol.id", "service": "http://localhost:8080"}
        ]
        plan = run_plan(s)
        self.assertEqual(len(plan["actions"]), 1)
        self.assertEqual(plan["actions"][0]["kind"], "create_dns")
        self.assertEqual(plan["actions"][0]["host"], "api.idol.id")
        self.assertEqual(plan["actions"][0]["content"], "t1.cfargotunnel.com")
        self.assertTrue(plan["actions"][0]["proxied"])

    def test_unhealthy_wrong_tunnel_dns_is_updated_to_unique_healthy_ingress(self):
        s = base_snapshot()
        s["dns"] = [{"id": "d1", "name": "docs.idol.id", "type": "CNAME", "content": "old.cfargotunnel.com", "proxied": True, "ttl": 1}]
        s["tunnels"] = [{"id": "new", "name": "docs", "status": "healthy", "connection_count": 1}]
        s["tunnel_ingress"] = [{"tunnel_id": "new", "tunnel_name": "docs", "hostname": "docs.idol.id", "service": "http://localhost:3000"}]
        s["http"] = [{"host": "docs.idol.id", "path": "/", "http": 502, "ssl_verify_result": 0}]
        plan = run_plan(s)
        self.assertEqual(len(plan["actions"]), 1)
        self.assertEqual(plan["actions"][0]["kind"], "update_dns")
        self.assertEqual(plan["actions"][0]["record_id"], "d1")
        self.assertEqual(plan["actions"][0]["content"], "new.cfargotunnel.com")

    def test_healthy_public_host_is_not_repointed_even_when_control_plane_differs(self):
        s = base_snapshot()
        s["dns"] = [{"id": "d1", "name": "docs.idol.id", "type": "CNAME", "content": "legacy.example.net", "proxied": True, "ttl": 1}]
        s["tunnels"] = [{"id": "new", "name": "docs", "status": "healthy", "connection_count": 1}]
        s["tunnel_ingress"] = [{"tunnel_id": "new", "tunnel_name": "docs", "hostname": "docs.idol.id", "service": "http://localhost:3000"}]
        s["http"] = [{"host": "docs.idol.id", "path": "/", "http": 200, "ssl_verify_result": 0}]
        plan = run_plan(s)
        self.assertEqual(plan["actions"], [])
        self.assertEqual(plan["manual"][0]["reason"], "healthy_public_surface_has_noncanonical_dns")

    def test_unproxied_cloudflare_tunnel_record_is_safely_proxied(self):
        s = base_snapshot()
        s["dns"] = [{"id": "d1", "name": "lib.idol.id", "type": "CNAME", "content": "t1.cfargotunnel.com", "proxied": False, "ttl": 1}]
        s["tunnels"] = [{"id": "t1", "name": "lib", "status": "healthy", "connection_count": 1}]
        s["tunnel_ingress"] = [{"tunnel_id": "t1", "tunnel_name": "lib", "hostname": "lib.idol.id", "service": "http://localhost:4000"}]
        plan = run_plan(s)
        self.assertEqual(len(plan["actions"]), 1)
        self.assertEqual(plan["actions"][0]["kind"], "update_dns")
        self.assertTrue(plan["actions"][0]["proxied"])

    def test_active_pages_domain_supplies_canonical_target_when_no_tunnel_owns_host(self):
        s = base_snapshot()
        s["pages_domains"] = [{"project": "idol-docs", "host": "docs.idol.id", "status": "active", "target": "idol-docs.pages.dev"}]
        plan = run_plan(s)
        self.assertEqual(len(plan["actions"]), 1)
        self.assertEqual(plan["actions"][0]["content"], "idol-docs.pages.dev")

    def test_ambiguous_multiple_owners_require_manual_resolution(self):
        s = base_snapshot()
        s["tunnels"] = [
            {"id": "t1", "name": "one", "status": "healthy", "connection_count": 1},
            {"id": "t2", "name": "two", "status": "healthy", "connection_count": 1},
        ]
        s["tunnel_ingress"] = [
            {"tunnel_id": "t1", "tunnel_name": "one", "hostname": "api.idol.id", "service": "http://localhost:8080"},
            {"tunnel_id": "t2", "tunnel_name": "two", "hostname": "api.idol.id", "service": "http://localhost:8081"},
        ]
        plan = run_plan(s)
        self.assertEqual(plan["actions"], [])
        self.assertEqual(plan["manual"][0]["reason"], "ambiguous_authority")

    def test_duplicate_dns_records_are_never_deleted_automatically(self):
        s = base_snapshot()
        s["dns"] = [
            {"id": "d1", "name": "api.idol.id", "type": "A", "content": "192.0.2.1", "proxied": True, "ttl": 1},
            {"id": "d2", "name": "api.idol.id", "type": "CNAME", "content": "old.example.net", "proxied": True, "ttl": 1},
        ]
        s["tunnels"] = [{"id": "t1", "name": "api", "status": "healthy", "connection_count": 1}]
        s["tunnel_ingress"] = [{"tunnel_id": "t1", "tunnel_name": "api", "hostname": "api.idol.id", "service": "http://localhost:8080"}]
        plan = run_plan(s)
        self.assertEqual(plan["actions"], [])
        self.assertEqual(plan["manual"][0]["reason"], "multiple_dns_records")

    def test_worker_only_host_is_not_given_a_guessed_dns_target(self):
        s = base_snapshot()
        s["worker_routes"] = [{"pattern": "play.idol.id/*", "script": "play"}]
        plan = run_plan(s)
        self.assertEqual(plan["actions"], [])
        self.assertEqual(plan["manual"][0]["reason"], "worker_route_has_no_authoritative_dns_origin")

    def test_unknown_owner_is_reported_without_mutation(self):
        s = base_snapshot()
        s["dns"] = [{"id": "d1", "name": "orphan.idol.id", "type": "CNAME", "content": "unknown.example", "proxied": True, "ttl": 1}]
        s["http"] = [{"host": "orphan.idol.id", "path": "/", "http": 530, "ssl_verify_result": 0}]
        plan = run_plan(s)
        self.assertEqual(plan["actions"], [])
        self.assertEqual(plan["manual"][0]["reason"], "no_authoritative_owner")


if __name__ == "__main__":
    unittest.main()
