export const PUBLIC_EVIDENCE_SURFACES = Object.freeze([
  "api", "docs", "graph", "lib", "mcp", "r16", "r8a", "r8b", "site",
]);

const MACHINE_PREFIXES = ["/__idol/", "/runtime/", "/api/", "/v1/", "/shared/", "/content/"];
const MACHINE_PATHS = new Set(["/mcp", "/install", "/install.sh", "/install.ps1", "/config.js", "/health", "/info", "/origin-health", "/origin-info"]);
const ASSET_EXTENSION = /\.(?:css|js|mjs|json|md|txt|svg|png|jpe?g|gif|webp|ico|woff2?|wasm|map|sh|ps1)$/i;

export function isEvidenceNavigation(request, info, path) {
  if (!PUBLIC_EVIDENCE_SURFACES.includes(info?.surface)) return false;
  if (MACHINE_PATHS.has(path)) return false;
  if (MACHINE_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  if (ASSET_EXTENSION.test(path)) return false;
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return request.headers.get("sec-fetch-mode") === "navigate";
}
