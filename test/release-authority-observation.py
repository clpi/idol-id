#!/usr/bin/env python3
"""Offline process controls. These do not execute GitHub, native, or deployment."""
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
LANGUAGE = "a" * 40
NATIVE = "b" * 40
COMPACT = "c" * 40
CONSTITUTION = "d" * 40
TOKEN = "fixture-only-not-a-credential"
LOCAL = {
    "schema": "idol.web.authority.v2",
    "language": {"repository": "clpi/idol", "branch": "main", "commit": LANGUAGE,
                 "compact_law_blob": COMPACT, "constitution_blob": CONSTITUTION},
    "native": {"repository": "clpi/idol-native", "branch": "main", "commit": NATIVE},
}
REMOTE = {
    "schema": "idol.authority.projection.v2",
    "role": "native-realization-and-evidence-projection",
    "authority": {"repository": "clpi/idol", "branch": "main", "commit": LANGUAGE,
                  "compact_law": {"path": "docs/spec/law.md", "blob": COMPACT},
                  "long_form_law": {"path": "docs/spec/constitution.md", "blob": CONSTITUTION}},
    "rules": {"local_law_is_authority": False, "native_repo_may_mint_semantic_law": False},
}
FAKE = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
with open(os.environ["CALLS"], "a") as stream:
    stream.write(json.dumps({"name": name, "args": sys.argv[1:], "cwd": os.getcwd()}) + "\n")
if name == "node":
    assert sys.argv[1:] == ["scripts/check-upstream-authority.mjs"]
    assert os.environ.get("IDOL_AUTHORITY_READ_TOKEN") == "fixture-only-not-a-credential"
    sys.exit(int(os.environ.get("UPSTREAM_STATUS", "0")))
assert name == "curl"
status = int(os.environ.get("CURL_STATUS", "0"))
if status == 0:
    sys.stdout.write(pathlib.Path(os.environ["REMOTE"]).read_text())
sys.exit(status)
'''


def workflow_steps(job):
    """Observe this repository's exact step indentation, not arbitrary YAML.

    Exact step equality below rejects commented/conditional commands and shell
    success overrides without requiring an additional CI package installation.
    """
    steps = []
    for line in job.splitlines():
        if line.startswith("      - "):
            steps.append([line])
        elif steps:
            steps[-1].append(line)
    return ["\n".join(lines).rstrip() for lines in steps]


def authority_step(name):
    return "\n".join([
        "      - name: " + name,
        "        timeout-minutes: 2",
        "        env:",
        "          IDOL_AUTHORITY_READ_TOKEN: ${{ secrets.IDOL_AUTHORITY_READ_TOKEN }}",
        "        run: sh scripts/check-release-authority.sh",
    ])


class ReleaseAuthority(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="idol authority '")
        self.root = Path(self.temporary.name)
        for directory in ["scripts", "runtime", "bin", "elsewhere"]:
            (self.root / directory).mkdir()
        shutil.copyfile(ROOT / "scripts/check-release-authority.sh", self.root / "scripts/check-release-authority.sh")
        self.local = self.root / "runtime/authority.json"
        self.local.write_text(json.dumps(LOCAL))
        self.remote = self.root / "remote.json"
        self.remote.write_text(json.dumps(REMOTE))
        for name in ["node", "curl"]:
            path = self.root / "bin" / name
            path.write_text(FAKE)
            path.chmod(0o755)
        self.calls = self.root / "calls.jsonl"
        self.env = dict(os.environ, PATH=str(self.root / "bin") + os.pathsep + os.environ["PATH"],
                        CALLS=str(self.calls), REMOTE=str(self.remote),
                        IDOL_AUTHORITY_READ_TOKEN=TOKEN, UPSTREAM_STATUS="0", CURL_STATUS="0")

    def tearDown(self):
        self.temporary.cleanup()

    def run_gate(self, expected, readers, deployment=False):
        if self.calls.exists():
            self.calls.unlink()
        marker = self.root / "deployment-started"
        if marker.exists():
            marker.unlink()
        command = ["sh", str(self.root / "scripts/check-release-authority.sh")]
        if deployment:
            command = ["sh", "-ec", 'sh "$1"; : > "$2"', "control", command[1], str(marker)]
        result = subprocess.run(command, cwd=self.root / "elsewhere", env=self.env,
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        records = [json.loads(line) for line in self.calls.read_text().splitlines()] if self.calls.exists() else []
        self.assertEqual([entry["name"] for entry in records], readers)
        for entry in records:
            self.assertEqual(entry["cwd"], str(self.root))
            self.assertNotIn(TOKEN, json.dumps(entry))
        self.assertNotIn(TOKEN, result.stdout + result.stderr)
        if deployment:
            self.assertEqual(marker.exists(), expected == 0)
        return result, records

    def test_agreeing_subjects_pass_and_keep_native_pin(self):
        result, records = self.run_gate(0, ["node", "curl"], deployment=True)
        self.assertIn("runtime and performance remain unqualified", result.stdout)
        self.assertEqual(records[1]["args"], ["--disable", "--fail", "--silent", "--show-error",
                         "--proto", "=https", "--connect-timeout", "10", "--max-time", "30",
                         f"https://raw.githubusercontent.com/clpi/idol-native/{NATIVE}/docs/spec/AUTHORITY.json"])
        self.assertEqual(json.loads(self.local.read_text()), LOCAL)

    def test_missing_or_empty_credential_refuses_before_any_reader(self):
        for value in [None, ""]:
            with self.subTest(value=value):
                if value is None:
                    self.env.pop("IDOL_AUTHORITY_READ_TOKEN", None)
                else:
                    self.env["IDOL_AUTHORITY_READ_TOKEN"] = value
                self.run_gate(2, [], deployment=True)

    def test_upstream_refusal_is_preserved_and_stops_native_and_deploy(self):
        for status in [1, 3, 23]:
            with self.subTest(status=status):
                self.env["UPSTREAM_STATUS"] = str(status)
                self.run_gate(status, ["node"], deployment=True)

    def test_native_fetch_failure_stops_deploy(self):
        for status in [22, 28]:
            with self.subTest(status=status):
                self.env["CURL_STATUS"] = str(status)
                self.run_gate(status, ["node", "curl"], deployment=True)

    def test_invalid_local_coordinate_refuses_before_readers(self):
        for field, value in [("commit", "main"), ("commit", "../../other"), ("commit", None),
                             ("repository", "other/repo"), ("branch", "other")]:
            with self.subTest(field=field, value=value):
                document = copy.deepcopy(LOCAL)
                document["native"][field] = value
                self.local.write_text(json.dumps(document))
                self.run_gate(2, [])

    def test_invalid_local_language_and_law_refuse(self):
        for field in ["commit", "compact_law_blob", "constitution_blob", "repository", "branch"]:
            with self.subTest(field=field):
                document = copy.deepcopy(LOCAL)
                document["language"][field] = "invalid"
                self.local.write_text(json.dumps(document))
                self.run_gate(2, [])

    def test_invalid_local_json_refuses(self):
        for text in ["", "{}", "not JSON", json.dumps(LOCAL) + json.dumps(LOCAL)]:
            with self.subTest(text=text[:30]):
                self.local.write_text(text)
                self.run_gate(2, [])

    def test_missing_local_document_refuses(self):
        self.local.unlink()
        self.run_gate(2, [])

    def test_invalid_native_json_refuses(self):
        for text in ["", "{}", "not JSON", "null", "[]", json.dumps(REMOTE) + json.dumps(REMOTE)]:
            with self.subTest(text=text[:30]):
                self.remote.write_text(text)
                self.run_gate(3, ["node", "curl"], deployment=True)

    def test_native_language_subject_must_match(self):
        for field, value in [("commit", "e" * 40), ("repository", "other/repo"), ("branch", "other")]:
            with self.subTest(field=field):
                document = copy.deepcopy(REMOTE)
                document["authority"][field] = value
                self.remote.write_text(json.dumps(document))
                self.run_gate(3, ["node", "curl"], deployment=True)

    def test_native_law_blobs_and_paths_must_match(self):
        for law in ["compact_law", "long_form_law"]:
            for field, value in [("blob", "e" * 40), ("path", "other.md")]:
                with self.subTest(law=law, field=field):
                    document = copy.deepcopy(REMOTE)
                    document["authority"][law][field] = value
                    self.remote.write_text(json.dumps(document))
                    self.run_gate(3, ["node", "curl"])

    def test_native_may_not_claim_semantic_authority(self):
        for field in ["local_law_is_authority", "native_repo_may_mint_semantic_law"]:
            for value in [True, None, "false"]:
                with self.subTest(field=field, value=value):
                    document = copy.deepcopy(REMOTE)
                    document["rules"][field] = value
                    self.remote.write_text(json.dumps(document))
                    self.run_gate(3, ["node", "curl"])

    def test_native_schema_and_role_are_required(self):
        for field in ["schema", "role"]:
            document = copy.deepcopy(REMOTE)
            del document[field]
            self.remote.write_text(json.dumps(document))
            self.run_gate(3, ["node", "curl"])

    def test_workflow_places_private_gate_only_after_verify_before_cloudflare(self):
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        self.assertEqual(workflow.count("\n  deploy:\n"), 1)
        verify, deploy = workflow.split("\n  deploy:\n", 1)
        self.assertIn("      - name: Release authority observer controls\n"
                      "        run: python3 test/release-authority-observation.py", workflow_steps(verify))
        self.assertNotIn("secrets.IDOL_AUTHORITY_READ_TOKEN", verify)
        header = deploy.split("    steps:\n", 1)[0]
        self.assertEqual(header, "\n".join([
            "    if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
            "    needs: verify", "    runs-on: ubuntu-latest", "    environment: production", "",
        ]))
        steps = workflow_steps(deploy)
        expected = authority_step("Verify upstream and pinned native authority before production changes")
        self.assertEqual(steps.count(expected), 1)
        # Only trusted checkout and runtime setup may precede the private gate.
        self.assertEqual(steps[:steps.index(expected)], [
            "      - uses: actions/checkout@v6",
            "      - uses: actions/setup-node@v5\n        with:\n          node-version: 22",
        ])

    def test_reconciliation_checks_pair_before_any_bot_write(self):
        workflow = (ROOT / ".github/workflows/authority-sync.yml").read_text()
        steps = workflow_steps(workflow)
        expected = authority_step("Verify release authority before proposing reconciliation")
        self.assertEqual(steps.count(expected), 1)
        gate = steps.index(expected)
        self.assertEqual(steps[gate - 1], "      - name: Verify generated authority consumers\n"
                         "        run: npm run authority:check")
        self.assertTrue(steps[gate + 1].startswith("      - name: Open or update authority pull request\n"))
        self.assertNotIn("continue-on-error", workflow)


if __name__ == "__main__":
    unittest.main(verbosity=2)
