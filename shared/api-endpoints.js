function endpoint(definition) {
  return Object.freeze({ auth: "none", pathValues: Object.freeze({}), query: "", body: null, ...definition, pathValues: Object.freeze({ ...(definition.pathValues || {}) }), body: definition.body ? Object.freeze({ ...definition.body }) : null });
}

export const API_ENDPOINTS = Object.freeze([
  endpoint({ group: "deployment", id: "version", method: "GET", path: "/__idol/version", owner: "edge", title: "Deployment identity", description: "Exact web commit, language authority, native authority, source-law edition, app, and surface." }),
  endpoint({ group: "deployment", id: "manifest", method: "GET", path: "/__idol/manifest", owner: "edge", title: "Deployment manifest", description: "One immutable multi-surface deployment projection." }),
  endpoint({ group: "deployment", id: "runtime", method: "GET", path: "/runtime/manifest.json", owner: "edge", title: "Runtime projection", description: "Bounded runtime capabilities and explicit unavailable boundaries." }),
  endpoint({ group: "deployment", id: "authority", method: "GET", path: "/runtime/authority.json", owner: "edge", title: "Authority document", description: "Pinned Idol, idol-native, and source-law identities packaged into this deployment." }),

  endpoint({ group: "compiler origin", id: "health", method: "GET", path: "/health", owner: "compiler-origin", title: "Compiler liveness", description: "Legacy compiler-origin health response reached through the API host." }),
  endpoint({ group: "compiler origin", id: "info", method: "GET", path: "/info", owner: "compiler-origin", title: "Compiler information", description: "Compiler-origin service and capability projection." }),
  endpoint({ group: "compiler origin", id: "origin-authority", method: "GET", path: "/api/authority", owner: "compiler-origin", title: "Compiler authority", description: "Authority projection returned by the configured compiler origin." }),
  endpoint({ group: "compiler origin", id: "analyze", method: "POST", path: "/api/analyze", owner: "compiler-origin", title: "Analyze source", description: "Request graph, explanation, and checking from the compiler origin. Lawful source does not imply support.", source: true, body: { source: "" } }),
  endpoint({ group: "compiler origin", id: "lower", method: "POST", path: "/api/lower", owner: "compiler-origin", title: "Lower source", description: "Request an origin-owned realization projection for one explicit target and output face.", source: true, body: { source: "", target: "aarch64-linux", emit: "asm", opt: "3" } }),
  endpoint({ group: "compiler origin", id: "run", method: "POST", path: "/api/run", owner: "compiler-origin", title: "Run source", description: "Request origin-owned native execution. The browser does not claim this capability exists before the response proves it.", source: true, body: { source: "" } }),
  endpoint({ group: "compiler origin", id: "format", method: "POST", path: "/api/fmt", owner: "compiler-origin", title: "Format source", description: "Request the configured origin formatter without creating browser grammar authority.", source: true, body: { source: "" } }),

  endpoint({ group: "published records", id: "homes", method: "GET", path: "/api/libs", owner: "compiler-origin", title: "Source homes", description: "Indexed source homes and reach provenance. A home is not a world." }),
  endpoint({ group: "published records", id: "worlds", method: "GET", path: "/api/worlds", owner: "compiler-origin", title: "Published worlds", description: "Compiler-origin published world records; package coordinates do not manufacture identity or authority." }),
  endpoint({ group: "published records", id: "world-detail", method: "GET", path: "/api/lib/:name/detail", owner: "compiler-origin", title: "Published record detail", description: "Source, graph, explanation, statistics, and provenance for one published record.", pathValues: { name: "json" } }),
  endpoint({ group: "published records", id: "world-source", method: "GET", path: "/api/lib/:name/source", owner: "compiler-origin", title: "Published source", description: "Exact source text for one published record.", pathValues: { name: "json" } }),
  endpoint({ group: "published records", id: "world-uses", method: "GET", path: "/api/lib/:name/uses", owner: "compiler-origin", title: "Outgoing references", description: "Resolved outgoing reference projection for one published record.", pathValues: { name: "check" } }),
  endpoint({ group: "published records", id: "world-dependents", method: "GET", path: "/api/lib/:name/dependents", owner: "compiler-origin", title: "Dependents", description: "Published records whose resolved references reach the selected record.", pathValues: { name: "str" } }),
  endpoint({ group: "published records", id: "world-versions", method: "GET", path: "/api/lib/:name/versions", owner: "compiler-origin", title: "Sealed versions", description: "Version snapshots for one published record.", pathValues: { name: "std" } }),
  endpoint({ group: "published records", id: "world-version", method: "GET", path: "/api/lib/:name/version/:version", owner: "compiler-origin", title: "Version source", description: "Exact source projection for one sealed version.", pathValues: { name: "std", version: "0.1.0" } }),
  endpoint({ group: "published records", id: "why", method: "GET", path: "/api/whys", owner: "compiler-origin", title: "Provenance facts", description: "Origin-owned provenance facts for one subject coordinate.", query: "subject=json" }),
  endpoint({ group: "published records", id: "publish", method: "POST", path: "/api/publish", owner: "compiler-origin", title: "Publish world", description: "Request publication through the configured origin. Requires an admitted write token and does not receive authority from this console.", auth: "bearer", source: true, body: { name: "example", version: "0.1.0", source: "", summary: "example" } }),

  endpoint({ group: "world boundary", id: "foreign-worlds", method: "GET", path: "/v1/world/foreign", owner: "edge", title: "Foreign candidates", description: "Provenance-qualified foreign candidates with explicit uncertainty and no fabricated semantic identity." }),
  endpoint({ group: "world boundary", id: "integration", method: "GET", path: "/v1/world/:slug/integration", owner: "edge", title: "Integration obligations", description: "One exact foreign candidate and its unfulfilled or evidenced integration obligations.", pathValues: { slug: "c17" } }),
  endpoint({ group: "world boundary", id: "import-plan", method: "POST", path: "/v1/world/import-plan", owner: "edge", title: "Plan foreign ingress", description: "Create one deterministic, plan-only record. No fetch, execution, transform, publication, equivalence, or authority grant occurs.", body: { kind: "repository", locator: "https://example.invalid/project", version: "exact-revision" } }),
]);

export const API_ENDPOINT_INDEX = Object.freeze(Object.fromEntries(API_ENDPOINTS.map((record) => [record.id, record])));

export function resolveEndpointPath(record, values = record.pathValues, query = record.query) {
  let path = record.path;
  for (const [name, value] of Object.entries(values || {})) path = path.replace(`:${name}`, encodeURIComponent(String(value)));
  const suffix = String(query || "").replace(/^\?/, "").trim();
  return suffix ? `${path}?${suffix}` : path;
}
