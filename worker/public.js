const EVIDENCE_SURFACES = Object.freeze(new Set([
  "api", "docs", "graph", "lib", "mcp", "r16", "r8a", "r8b", "site",
]));

const MACHINE_PREFIXES = ["/__idol/", "/runtime/", "/api/", "/v1/", "/shared/"];
const MACHINE_PATHS = new Set(["/mcp", "/install", "/install.ps1"]);

export const PUBLIC_EVIDENCE_SURFACES = EVIDENCE_SURFACES;

export function isEvidenceNavigation(request, info, path) {
  if (!EVIDENCE_SURFACES.has(info?.surface)) return false;
  if (MACHINE_PATHS.has(path)) return false;
  if (MACHINE_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return request.headers.get("sec-fetch-mode") === "navigate";
}
