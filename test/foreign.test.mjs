import test from "node:test";
import assert from "node:assert/strict";
import {
  filterForeignWorlds,
  integrationFor,
  normaliseForeignWorld,
  normaliseIntegration,
  parseImportRequest,
  planForeignImport,
} from "../shared/foreign.js";

const candidate = {
  slug: "c17",
  name: "C17",
  version: "ISO/IEC 9899:2018",
  summary: "C language and ABI provenance candidate",
  semantic_id: null,
  identity_status: "not-published",
  provenance: { origin: { family: "c", standard: "ISO/IEC 9899:2018" } },
  uncertainty: [{ fact: "implementation-defined behavior", status: "unresolved" }],
  projections: [{
    id: "c17-cabi",
    target: "c-abi",
    status: "not-admitted",
    artifact: null,
    obligations: { abi: ["calling convention"], ownership: ["aliasing"] },
    evidence: { status: "missing", required: ["round-trip test"] },
    refusal: { code: "ARTIFACT_NOT_ADMITTED", detail: "no signed artifact" },
  }],
};

test("foreign candidates never fabricate semantic identity", () => {
  const world = normaliseForeignWorld(candidate);
  assert.equal(world.semantic_id, null);
  assert.equal(world.identity_status, "not-published");
  assert.equal(world.category, "foreign");
  assert.equal(world.uncertainty[0].status, "unresolved");
});

test("integration records expose obligations and exact refusal", () => {
  const projection = normaliseIntegration(candidate.projections[0], candidate);
  assert.equal(projection.available, false);
  assert.equal(projection.refusal.code, "ARTIFACT_NOT_ADMITTED");
  assert.deepEqual(projection.obligations.abi, ["calling convention"]);
  assert.equal("copy_command" in projection, false);
});

test("integration lookup and search remain provenance based", () => {
  assert.equal(integrationFor(candidate, "c-abi").target, "c-abi");
  assert.deepEqual(filterForeignWorlds([candidate], "aliasing").map((x) => x.slug), ["c17"]);
});

test("import planning is deterministic and performs no import", () => {
  const request = parseImportRequest({ kind: "repository", locator: "https://example.invalid/repo", version: "abc123" });
  const first = planForeignImport(request);
  const second = planForeignImport(request);
  assert.deepEqual(first, second);
  assert.equal(first.status, "plan-only");
  assert.equal(first.semantic_id, null);
  assert.equal(first.executed, false);
  assert.ok(first.stages.includes("ingest provenance"));
  assert.ok(first.missing_facts.length > 0);
});

test("all approved import kinds preserve an explicit authority boundary", () => {
  for (const kind of ["repository", "schema", "api", "binary"]) {
    const plan = planForeignImport(parseImportRequest({ kind, locator: `urn:test:${kind}` }));
    assert.equal(plan.kind, kind);
    assert.match(plan.authority_boundary, /No source was fetched, executed, transformed, or published/);
    assert.equal(plan.executed, false);
  }
});

test("unsupported import kinds fail exactly", () => {
  assert.throws(() => parseImportRequest({ kind: "magic", locator: "x" }), /unsupported import kind/);
});

test("import request bounds are enforced", () => {
  assert.throws(() => parseImportRequest({ kind: "repository", locator: "" }), /locator required/);
  assert.throws(() => parseImportRequest({ kind: "repository", locator: "x".repeat(2049) }), /locator too long/);
  assert.throws(() => parseImportRequest({ kind: "repository", locator: "x", version: "v".repeat(257) }), /version too long/);
});
