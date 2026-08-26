import { TEXT, ALLOWED_CAPABILITIES, REPOSITORY_AUTHORITY_BOUNDARY, RepositoryError, exact, text } from "./repository-core.js";

function normalizeCapabilities(input) {
  if (!Array.isArray(input) || !input.length) throw new RepositoryError("SCAFFOLD_CAPABILITY_REQUIRED", "select at least one scaffold capability", 422);
  const allowed = new Set(ALLOWED_CAPABILITIES);
  const capabilities = [...new Set(input.map((value) => text(value)).filter(Boolean))].sort();
  for (const capability of capabilities) if (!allowed.has(capability)) throw new RepositoryError("SCAFFOLD_CAPABILITY_UNSUPPORTED", `unsupported scaffold capability: ${capability}`, 422);
  return Object.freeze(capabilities);
}

function quoteYaml(value) {
  return JSON.stringify(String(value));
}

function workflow(observation, capabilities) {
  const phases = capabilities.filter((value) => ["build", "test", "bench", "graph"].includes(value));
  const steps = phases.map((phase) => `      - name: Idol ${phase}\n        run: idol ${phase}`);
  return `name: idol\n\non:\n  push:\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Install pinned Idol bootstrap seed\n        env:\n          IDOL_AUTHORITY: ${quoteYaml(observation.authority_pin.language.commit)}\n        run: curl -fsSL https://idol.id/install | sh\n${steps.join("\n") || "      - name: Inspect Idol authority\n        run: idol --version"}\n`;
}

function generatedFiles(observation, capabilities, authorityPin) {
  const authority = {
    schema: "idol.authority.pin.v1",
    language: authorityPin.language,
    native: authorityPin.native,
    source: { provider: observation.provider, coordinate: observation.coordinate, revision: observation.resolved_revision },
    authority_boundary: REPOSITORY_AUTHORITY_BOUNDARY,
  };
  const project = {
    schema: "idol.repository.scaffold.v1",
    semantic_id: null,
    identity_status: "not-published",
    source: { provider: observation.provider, coordinate: observation.coordinate, revision: observation.resolved_revision },
    capabilities,
    observed: {
      build_systems: observation.inventory.build_systems,
      commands: observation.inventory.commands,
      tests: observation.inventory.tests,
      benchmarks: observation.inventory.benchmarks,
    },
    authority_boundary: "candidate project integration only; generated files do not prove compiler admission or repository behavior",
  };
  const files = [
    { path: ".idol/authority.json", content: `${JSON.stringify(authority, null, 2)}\n` },
    { path: ".idol/project.json", content: `${JSON.stringify(project, null, 2)}\n` },
    { path: ".idol/README.md", content: `# Idol integration candidate\n\nGenerated from ${observation.coordinate}@${observation.resolved_revision}.\n\nThis scaffold is a reviewable candidate. It does not claim semantic identity, behavior equivalence, world authority, or a successful Idol build.\n` },
  ];
  if (capabilities.includes("ci")) files.push({ path: ".github/workflows/idol.yml", content: workflow({ ...observation, authority_pin: authorityPin }, capabilities) });
  return files;
}

export function unifiedAddPatch(files) {
  return files.map(({ path, content }) => {
    const lines = String(content).replace(/\n$/, "").split("\n");
    return [`diff --git a/${path} b/${path}`, "new file mode 100644", "--- /dev/null", `+++ b/${path}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`), ""].join("\n");
  }).join("\n");
}

export function createRepositoryScaffold(observation, input, { authorityPin, createdAt = () => new Date().toISOString() } = {}) {
  if (!observation || observation.schema !== "idol.web.repository.observation.v1") throw new RepositoryError("OBSERVATION_REQUIRED", "valid repository observation required", 422);
  if (!authorityPin?.language?.commit || !authorityPin?.native?.commit) throw new RepositoryError("AUTHORITY_PIN_REQUIRED", "language and native authority pins are required", 500);
  const capabilities = normalizeCapabilities(input?.capabilities);
  const files = generatedFiles(observation, capabilities, authorityPin);
  const existing = new Set(observation.inventory.paths || []);
  const conflicts = files.map((file) => file.path).filter((path) => existing.has(path));
  if (conflicts.length) {
    return Object.freeze({
      schema: "idol.web.repository.scaffold.v1",
      status: "refused",
      refusal: Object.freeze({ code: "SCAFFOLD_PATH_CONFLICT", detail: "generated scaffold would overwrite existing repository paths", paths: Object.freeze(conflicts) }),
      observation_id: observation.id || null,
      files: Object.freeze([]),
      patch: "",
      semantic_id: null,
      identity_status: "not-published",
    });
  }
  const frozenFiles = Object.freeze(files.map((file) => Object.freeze({ ...file, bytes: TEXT.encode(file.content).byteLength })));
  return Object.freeze({
    schema: "idol.web.repository.scaffold.v1",
    status: "preview",
    semantic_id: null,
    identity_status: "not-published",
    authority: REPOSITORY_AUTHORITY_BOUNDARY,
    observation_id: observation.id || null,
    source: Object.freeze({ provider: observation.provider, coordinate: observation.coordinate, revision: observation.resolved_revision }),
    capabilities,
    files: frozenFiles,
    patch: unifiedAddPatch(frozenFiles),
    created_at: exact(createdAt(), "scaffold time", 64),
    executed: false,
    repository_written: false,
  });
}
