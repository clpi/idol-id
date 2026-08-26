export const TEXT = new TextEncoder();
export const MAX_FILES = 5000;
const MAX_PATH_BYTES = 1024;
const MAX_REF = 160;
export const ALLOWED_CAPABILITIES = Object.freeze(["authority", "build", "test", "bench", "ci", "graph"]);

export const REPOSITORY_AUTHORITY_BOUNDARY =
  "repository provenance and transport observations only; no semantic identity, world grant, equivalence, or repository write";

export class RepositoryError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.status = status;
  }
}

export function text(value) {
  return String(value ?? "").trim();
}

export function exact(value, label, maximum = 240) {
  const result = text(value);
  if (!result || result.length > maximum) {
    throw new RepositoryError("INVALID_REPOSITORY_INPUT", `${label} must contain 1 to ${maximum} characters`, 422);
  }
  return result;
}

function cleanSegment(value, label) {
  const result = exact(value, label, 160);
  if (!/^[A-Za-z0-9_.-]+$/.test(result) || result === "." || result === "..") {
    throw new RepositoryError("INVALID_REPOSITORY_COORDINATE", `${label} contains unsupported characters`, 422);
  }
  return result.replace(/\.git$/i, "");
}

function cleanNamespace(value, label) {
  const parts = exact(value, label, 320).split("/").filter(Boolean).map((part) => cleanSegment(part, label));
  if (!parts.length) throw new RepositoryError("INVALID_REPOSITORY_COORDINATE", `${label} is empty`, 422);
  return parts.join("/");
}

function cleanRef(value) {
  const result = text(value || "HEAD");
  if (!result || result.length > MAX_REF || /[\u0000-\u001f\u007f\s~^:?*\[\\]/.test(result) || result.includes("..") || result.startsWith("/") || result.endsWith("/")) {
    throw new RepositoryError("INVALID_REPOSITORY_REF", "repository ref is invalid", 422);
  }
  return result;
}

function cleanPath(value) {
  const path = String(value ?? "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || TEXT.encode(path).byteLength > MAX_PATH_BYTES || path.startsWith("/") || path.includes("\u0000")) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.join("/");
}

function sourceUrl(provider, namespace, repository) {
  if (provider === "github") return `https://github.com/${namespace}/${repository}`;
  if (provider === "gitlab") return `https://gitlab.com/${namespace}/${repository}`;
  return `https://bitbucket.org/${namespace}/${repository}`;
}

export function parseRepositoryLocator(input) {
  const source = typeof input === "string" ? { url: input } : input;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new RepositoryError("INVALID_REPOSITORY_INPUT", "repository request must be an object or URL", 400);
  }
  const requestedRef = cleanRef(source.ref || "HEAD");
  if (source.provider) {
    const provider = text(source.provider).toLowerCase();
    if (!new Set(["github", "gitlab", "bitbucket"]).has(provider)) {
      throw new RepositoryError("REPOSITORY_PROVIDER_UNSUPPORTED", `unsupported repository provider: ${provider}`, 422);
    }
    const namespace = cleanNamespace(source.namespace || source.owner || source.workspace, "repository namespace");
    const repository = cleanSegment(source.repository || source.repo, "repository name");
    return Object.freeze({
      provider,
      namespace,
      repository,
      requested_ref: requestedRef,
      coordinate: `${provider}:${namespace}/${repository}`,
      source_url: sourceUrl(provider, namespace, repository),
    });
  }

  let url;
  try {
    url = new URL(exact(source.url, "repository URL", 2048));
  } catch {
    throw new RepositoryError("INVALID_REPOSITORY_URL", "repository URL is invalid", 422);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) {
    throw new RepositoryError("INVALID_REPOSITORY_URL", "repository URL must be a credential-free HTTPS repository URL", 422);
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  let provider;
  let namespaceParts;
  let repositoryPart;
  if (host === "github.com") {
    provider = "github";
    if (parts.length !== 2) throw new RepositoryError("INVALID_REPOSITORY_URL", "GitHub URL must identify owner/repository", 422);
    namespaceParts = parts.slice(0, 1);
    repositoryPart = parts[1];
  } else if (host === "gitlab.com") {
    provider = "gitlab";
    if (parts.length < 2) throw new RepositoryError("INVALID_REPOSITORY_URL", "GitLab URL must identify namespace/repository", 422);
    namespaceParts = parts.slice(0, -1);
    repositoryPart = parts.at(-1);
  } else if (host === "bitbucket.org") {
    provider = "bitbucket";
    if (parts.length !== 2) throw new RepositoryError("INVALID_REPOSITORY_URL", "Bitbucket URL must identify workspace/repository", 422);
    namespaceParts = parts.slice(0, 1);
    repositoryPart = parts[1];
  } else {
    throw new RepositoryError("REPOSITORY_PROVIDER_UNSUPPORTED", `repository host is not admitted: ${host}`, 422);
  }
  const namespace = cleanNamespace(namespaceParts.join("/"), "repository namespace");
  const repository = cleanSegment(repositoryPart, "repository name");
  return Object.freeze({
    provider,
    namespace,
    repository,
    requested_ref: requestedRef,
    coordinate: `${provider}:${namespace}/${repository}`,
    source_url: sourceUrl(provider, namespace, repository),
  });
}

export function fileRecord(path, size = null) {
  const clean = cleanPath(path);
  if (!clean) return null;
  const bytes = Number(size);
  return Object.freeze({ path: clean, bytes: Number.isFinite(bytes) && bytes >= 0 ? bytes : null });
}

const EXTENSIONS = Object.freeze({
  ".id": "idol", ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript", ".ts": "typescript", ".tsx": "typescript",
  ".rs": "rust", ".go": "go", ".py": "python", ".c": "c", ".h": "c", ".cc": "cpp", ".cpp": "cpp", ".hpp": "cpp",
  ".zig": "zig", ".java": "java", ".kt": "kotlin", ".cs": "csharp", ".swift": "swift", ".rb": "ruby", ".php": "php",
  ".sh": "shell", ".ps1": "powershell", ".lua": "lua", ".wasm": "wasm", ".wat": "wasm",
});

const BUILD_MARKERS = Object.freeze([
  ["package.json", "node"], ["Cargo.toml", "cargo"], ["go.mod", "go"], ["pyproject.toml", "python"], ["setup.py", "python"],
  ["CMakeLists.txt", "cmake"], ["meson.build", "meson"], ["Makefile", "make"], ["build.zig", "zig"], ["pom.xml", "maven"],
  ["build.gradle", "gradle"], ["build.gradle.kts", "gradle"], ["Gemfile", "bundler"], ["composer.json", "composer"],
]);

function extension(path) {
  const base = path.split("/").at(-1) || "";
  const index = base.lastIndexOf(".");
  return index > 0 ? base.slice(index).toLowerCase() : "";
}

function evidence(paths, predicate) {
  return paths.filter(predicate).slice(0, 20);
}

export function summarizeRepositoryFiles(entries, { truncated = false } = {}) {
  const accepted = [];
  const seen = new Set();
  let knownBytes = 0;
  let sized = 0;
  for (const candidate of entries || []) {
    const record = fileRecord(candidate?.path ?? candidate, candidate?.bytes ?? candidate?.size);
    if (!record || seen.has(record.path)) continue;
    seen.add(record.path);
    accepted.push(record);
    if (record.bytes !== null) { knownBytes += record.bytes; sized += 1; }
    if (accepted.length >= MAX_FILES) { truncated = true; break; }
  }
  accepted.sort((a, b) => a.path.localeCompare(b.path));
  const paths = accepted.map((entry) => entry.path);
  const languages = {};
  for (const path of paths) {
    const language = EXTENSIONS[extension(path)] || "other";
    languages[language] = (languages[language] || 0) + 1;
  }
  const buildSystems = BUILD_MARKERS.flatMap(([marker, id]) => {
    const matches = evidence(paths, (path) => path === marker || path.endsWith(`/${marker}`));
    return matches.length ? [{ id, evidence: matches, status: "observed-marker" }] : [];
  });
  const tests = evidence(paths, (path) => /(^|\/)(test|tests|spec|specs)(\/|\.|$)/i.test(path) || /(?:\.test|_test|\.spec)\.[^.]+$/i.test(path));
  const benchmarks = evidence(paths, (path) => /(^|\/)(bench|benches|benchmark|benchmarks)(\/|\.|$)/i.test(path));
  const ci = evidence(paths, (path) => path.startsWith(".github/workflows/") || path === ".gitlab-ci.yml" || path === "bitbucket-pipelines.yml");
  const manifests = evidence(paths, (path) => BUILD_MARKERS.some(([marker]) => path === marker || path.endsWith(`/${marker}`)));
  const commands = [];
  for (const build of buildSystems) {
    if (build.id === "node") commands.push({ phase: "build", command: "npm run build", status: "candidate", evidence: build.evidence });
    if (build.id === "cargo") commands.push({ phase: "build", command: "cargo build", status: "candidate", evidence: build.evidence });
    if (build.id === "go") commands.push({ phase: "build", command: "go build ./...", status: "candidate", evidence: build.evidence });
    if (build.id === "python") commands.push({ phase: "test", command: "python -m pytest", status: "candidate", evidence: build.evidence });
    if (build.id === "cmake") commands.push({ phase: "build", command: "cmake -S . -B build && cmake --build build", status: "candidate", evidence: build.evidence });
    if (build.id === "zig") commands.push({ phase: "build", command: "zig build", status: "candidate", evidence: build.evidence });
  }
  if (tests.length && !commands.some((command) => command.phase === "test")) commands.push({ phase: "test", command: "requires human confirmation", status: "unresolved", evidence: tests });
  if (benchmarks.length) commands.push({ phase: "bench", command: "requires human confirmation", status: "unresolved", evidence: benchmarks });
  return Object.freeze({
    file_count: accepted.length,
    truncated: Boolean(truncated),
    paths: Object.freeze(paths),
    bytes: Object.freeze({ known: knownBytes, sized_files: sized, total_files: accepted.length }),
    languages: Object.freeze(languages),
    build_systems: Object.freeze(buildSystems),
    manifests: Object.freeze(manifests),
    tests: Object.freeze(tests),
    benchmarks: Object.freeze(benchmarks),
    ci: Object.freeze(ci),
    commands: Object.freeze(commands),
  });
}
