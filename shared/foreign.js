const IMPORT_KINDS = Object.freeze({
  repository: Object.freeze({
    stages: Object.freeze([
      "ingest provenance",
      "detect languages, build systems, and targets",
      "extract declarations and boundary facts",
      "publish candidate facts with uncertainty",
      "identify missing laws and opaque behavior",
      "plan granted probes and tests",
      "request human confirmation",
      "prepare private candidate world",
    ]),
    required_grants: Object.freeze([
      "repository metadata read",
      "source read when approved",
      "network read only when approved",
    ]),
    missing_facts: Object.freeze([
      "stable semantic identities",
      "behavior correspondence",
      "capability/world witness",
      "build/test evidence",
    ]),
    refusals: Object.freeze([
      "no source fetch without grant",
      "no execution without runner/world grant",
      "no public publication without review",
    ]),
  }),
  schema: Object.freeze({
    stages: Object.freeze([
      "ingest provenance",
      "identify schema language and version",
      "extract declarations and constraints",
      "publish candidate boundary facts with uncertainty",
      "identify unsupported constraints",
      "plan round-trip and compatibility evidence",
      "prepare private candidate world",
    ]),
    required_grants: Object.freeze(["schema read", "referenced schema read when approved"]),
    missing_facts: Object.freeze(["runtime behavior", "ownership", "effects", "implementation correspondence"]),
    refusals: Object.freeze([
      "no equivalence from shape alone",
      "no network dereference without grant",
      "no generated artifact without target witness",
    ]),
  }),
  api: Object.freeze({
    stages: Object.freeze([
      "ingest provenance",
      "pin API description and version",
      "extract operations, schemas, and authentication requirements",
      "publish candidate boundary facts with uncertainty",
      "identify effects, rate limits, and failure behavior",
      "plan granted probes and contract tests",
      "prepare private candidate world",
    ]),
    required_grants: Object.freeze([
      "description read",
      "network probe only when approved",
      "secret reference only when approved",
    ]),
    missing_facts: Object.freeze([
      "server implementation",
      "runtime behavior",
      "availability",
      "side effects",
      "authorization policy",
    ]),
    refusals: Object.freeze([
      "no live request without network grant",
      "no secret material in plan output",
      "no equivalence from documentation alone",
    ]),
  }),
  binary: Object.freeze({
    stages: Object.freeze([
      "ingest provenance",
      "identify format, architecture, and target",
      "extract symbols, sections, imports, exports, and metadata",
      "publish candidate boundary facts with uncertainty",
      "identify opaque behavior and missing source law",
      "plan sandboxed probes when granted",
      "prepare private candidate world",
    ]),
    required_grants: Object.freeze(["artifact read", "sandboxed execution only when approved"]),
    missing_facts: Object.freeze(["source semantics", "ownership", "failure law", "effects", "behavior correspondence"]),
    refusals: Object.freeze([
      "no semantic identity from symbols or hashes",
      "no execution without sandbox/world grant",
      "no equivalence from binary shape",
    ]),
  }),
});

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function strings(value) {
  return Array.isArray(value) ? value.map(text).map((item) => item.trim()).filter(Boolean) : [];
}

function records(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function obligations(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.freeze({
    abi: Object.freeze(strings(source.abi)),
    ownership: Object.freeze(strings(source.ownership)),
    failure: Object.freeze(strings(source.failure)),
    threading: Object.freeze(strings(source.threading)),
    effect: Object.freeze(strings(source.effect)),
    world: Object.freeze(strings(source.world)),
  });
}

function evidence(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.freeze({
    status: text(source.status || "missing"),
    required: Object.freeze(strings(source.required)),
    references: Object.freeze(strings(source.references)),
  });
}

function refusal(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.freeze({
    code: text(source.code || "INTEGRATION_NOT_ADMITTED"),
    detail: text(source.detail || "no witnessed integration projection is published"),
  });
}

function uncertainty(value) {
  return Object.freeze(records(value).map((item) => Object.freeze({
    fact: text(item.fact),
    status: text(item.status || "unresolved"),
    detail: text(item.detail),
  })));
}

export function normaliseIntegration(record, world = {}) {
  const source = record && typeof record === "object" ? record : {};
  const artifact = source.artifact && typeof source.artifact === "object"
    ? Object.freeze({
        file: text(source.artifact.file),
        sha256: text(source.artifact.sha256),
        bytes: Number(source.artifact.bytes || 0),
        version: text(source.artifact.version),
      })
    : null;
  const proof = evidence(source.evidence);
  const status = text(source.status || "not-admitted");
  const available = status === "available" && Boolean(artifact?.sha256) && proof.status === "verified";
  const projection = {
    id: text(source.id),
    world: text(world.slug || world.name),
    target: text(source.target),
    status,
    available,
    artifact,
    obligations: obligations(source.obligations),
    evidence: proof,
    refusal: refusal(source.refusal),
  };
  if (available && text(source.copy_command)) projection.copy_command = text(source.copy_command);
  return Object.freeze(projection);
}

export function normaliseForeignWorld(record) {
  const source = record && typeof record === "object" ? record : {};
  const provenance = source.provenance && typeof source.provenance === "object" ? source.provenance : {};
  const origin = provenance.origin && typeof provenance.origin === "object" ? provenance.origin : {};
  const world = {
    ...source,
    slug: text(source.slug),
    name: text(source.name),
    version: text(source.version || "unversioned"),
    summary: text(source.summary),
    semantic_id: source.semantic_id === null || source.semantic_id === undefined ? null : text(source.semantic_id),
    identity_status: text(source.identity_status || "not-published"),
    category: "foreign",
    provenance: Object.freeze({
      ...provenance,
      origin: Object.freeze({
        ...origin,
        family: text(origin.family),
        ecosystem: text(origin.ecosystem),
        standard: text(origin.standard),
      }),
    }),
    origin: text(origin.family),
    uncertainty: uncertainty(source.uncertainty),
    requirements: Object.freeze(strings(source.requirements)),
  };
  world.projections = Object.freeze(records(source.projections).map((item) => normaliseIntegration(item, world)));
  return Object.freeze(world);
}

function searchText(world) {
  const projection = world.projections.flatMap((item) => [
    item.id,
    item.target,
    item.status,
    item.refusal.code,
    item.refusal.detail,
    ...Object.values(item.obligations).flat(),
    ...item.evidence.required,
  ]);
  return [
    world.slug,
    world.name,
    world.version,
    world.summary,
    world.origin,
    world.identity_status,
    ...world.requirements,
    ...world.uncertainty.flatMap((item) => [item.fact, item.status, item.detail]),
    ...projection,
  ].join(" ").toLowerCase();
}

export function filterForeignWorlds(worlds, query = "", target = "all") {
  const needle = text(query).trim().toLowerCase();
  const selected = text(target || "all").trim().toLowerCase();
  return records(worlds)
    .map(normaliseForeignWorld)
    .filter((world) => selected === "all" || world.projections.some((item) => item.target.toLowerCase() === selected))
    .filter((world) => !needle || searchText(world).includes(needle))
    .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));
}

export function integrationFor(world, target) {
  const normal = normaliseForeignWorld(world);
  const needle = text(target).toLowerCase();
  return normal.projections.find((item) => item.target.toLowerCase() === needle || item.id.toLowerCase() === needle) || null;
}

export function parseImportRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("import request must be an object");
  const kind = text(input.kind).trim().toLowerCase();
  if (!Object.hasOwn(IMPORT_KINDS, kind)) throw new RangeError(`unsupported import kind: ${kind || "empty"}`);
  const locator = text(input.locator).trim();
  if (!locator) throw new TypeError("locator required");
  if (locator.length > 2048) throw new RangeError("locator too long");
  const version = text(input.version).trim();
  if (version.length > 256) throw new RangeError("version too long");
  return Object.freeze({ kind, locator, version });
}

function importKinds(source) {
  const rows = Array.isArray(source) ? source : Array.isArray(source?.import_kinds) ? source.import_kinds : [];
  if (!rows.length) return IMPORT_KINDS;
  const out = {};
  for (const row of rows) {
    const kind = text(row?.kind).trim().toLowerCase();
    if (!Object.hasOwn(IMPORT_KINDS, kind)) continue;
    out[kind] = {
      stages: strings(row.stages),
      required_grants: strings(row.required_grants),
      missing_facts: strings(row.missing_facts),
      refusals: strings(row.refusals),
    };
  }
  return Object.freeze(out);
}

export function planForeignImport(request, source) {
  const parsed = parseImportRequest(request);
  const templates = importKinds(source);
  const template = templates[parsed.kind] || IMPORT_KINDS[parsed.kind];
  return Object.freeze({
    schema: "idol.web.import.plan.v1",
    status: "plan-only",
    executed: false,
    semantic_id: null,
    identity_status: "not-published",
    kind: parsed.kind,
    locator: parsed.locator,
    version: parsed.version,
    stages: Object.freeze(strings(template.stages)),
    required_grants: Object.freeze(strings(template.required_grants)),
    missing_facts: Object.freeze(strings(template.missing_facts)),
    refusals: Object.freeze(strings(template.refusals)),
    authority_boundary: "No source was fetched, executed, transformed, or published. This document is an import plan, not a world or equivalence witness.",
  });
}

export const foreignImportKinds = Object.freeze(Object.keys(IMPORT_KINDS));
