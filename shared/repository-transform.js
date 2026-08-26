import {
  REPOSITORY_AUTHORITY_BOUNDARY,
  RepositoryError,
  exact,
  text,
} from "./repository-core.js";
import { unifiedAddPatch } from "./repository-scaffold.js";

const ALLOWED_EVIDENCE = Object.freeze(["bench", "build", "graph", "semantic-diff", "test"]);
const MAX_SELECTED_FILES = 64;

function frozenCopy(value) {
  return Object.freeze({ ...value });
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return bytesToHex(new Uint8Array(digest));
}

function normalizedEvidence(input) {
  if (input == null) return Object.freeze([]);
  if (!Array.isArray(input)) {
    throw new RepositoryError("TRANSFORMATION_EVIDENCE_INVALID", "transformation evidence request must be an array", 422);
  }
  const allowed = new Set(ALLOWED_EVIDENCE);
  const values = [...new Set(input.map((value) => text(value)).filter(Boolean))].sort();
  for (const value of values) {
    if (!allowed.has(value)) {
      throw new RepositoryError("TRANSFORMATION_EVIDENCE_UNSUPPORTED", `unsupported transformation evidence: ${value}`, 422);
    }
  }
  return Object.freeze(values);
}

function selectedFiles(scaffold, input) {
  const available = new Map((scaffold.files || []).map((file) => [String(file.path), file]));
  const requested = input?.selected_files == null
    ? [...available.keys()]
    : input.selected_files;
  if (!Array.isArray(requested) || !requested.length || requested.length > MAX_SELECTED_FILES) {
    throw new RepositoryError(
      "TRANSFORMATION_FILES_REQUIRED",
      `select between 1 and ${MAX_SELECTED_FILES} scaffold files`,
      422,
    );
  }
  const paths = [...new Set(requested.map((value) => exact(value, "transformation file path", 1024)))].sort();
  if (paths.length !== requested.length) {
    throw new RepositoryError("TRANSFORMATION_FILE_DUPLICATE", "transformation file selection contains duplicates", 422);
  }
  const files = paths.map((path) => {
    const file = available.get(path);
    if (!file) {
      throw new RepositoryError(
        "TRANSFORMATION_FILE_NOT_IN_SCAFFOLD",
        `transformation file is not part of the scaffold: ${path}`,
        422,
      );
    }
    return frozenCopy(file);
  });
  return Object.freeze(files);
}

function parentWorld(observation) {
  return Object.freeze({
    semantic_id: null,
    identity_status: "not-published",
    observation_id: observation.id || null,
    provider: observation.provider,
    coordinate: observation.coordinate,
    revision: observation.resolved_revision,
    mutated: false,
  });
}

function derivedWorld(observation, scaffold, paths, patchDigest) {
  return Object.freeze({
    semantic_id: null,
    identity_status: "not-published",
    parent_observation_id: observation.id || null,
    parent_scaffold_id: scaffold.id || null,
    isolation: "derived-preview",
    selected_files: Object.freeze([...paths]),
    patch_sha256: patchDigest,
    published: false,
  });
}

function grants() {
  return Object.freeze([
    Object.freeze({ world: "filesystem", capability: "write", status: "not-granted" }),
    Object.freeze({ world: "process", capability: "execute", status: "not-granted" }),
    Object.freeze({ world: "network", capability: "provider-write", status: "not-granted" }),
    Object.freeze({ world: "repository", capability: "mutate", status: "not-granted" }),
    Object.freeze({ world: "world-registry", capability: "publish", status: "not-granted" }),
  ]);
}

function baseDocument(observation, scaffold, timestamp) {
  return {
    schema: "idol.web.repository.transformation.v1",
    semantic_id: null,
    identity_status: "not-published",
    authority: REPOSITORY_AUTHORITY_BOUNDARY,
    observation_id: observation.id || null,
    scaffold_id: scaffold.id || null,
    source: Object.freeze({
      provider: observation.provider,
      coordinate: observation.coordinate,
      revision: observation.resolved_revision,
    }),
    parent_world: parentWorld(observation),
    required_grants: grants(),
    created_at: timestamp,
    executed: false,
    source_world_mutated: false,
    repository_written: false,
    world_published: false,
  };
}

function refusedTransformation(observation, scaffold, timestamp, code, detail) {
  const document = baseDocument(observation, scaffold, timestamp);
  return Object.freeze({
    ...document,
    status: "refused",
    intent: "review scaffold projection",
    selected_files: Object.freeze([]),
    patch: "",
    patch_sha256: null,
    transformation: Object.freeze({
      semantic_id: null,
      identity_status: "not-published",
      face: "repository-scaffold-projection",
    }),
    derived_world: derivedWorld(observation, scaffold, [], null),
    evidence: Object.freeze({ requested: Object.freeze([]), status: "unexecuted", results: Object.freeze([]) }),
    refusal: Object.freeze({ code, detail }),
  });
}

export function repositoryTransformationSummary(record) {
  if (!record) return null;
  const status = exact(record.status, "transformation status", 16);
  if (status !== "preview" && status !== "refused") {
    throw new RepositoryError("INVALID_REPOSITORY_INPUT", "transformation status must be preview or refused", 422);
  }
  const count = Number(record.selected_file_count ?? record.selected_files?.length ?? record.files?.length ?? 0);
  const selectedFileCount = Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
  const evidenceStatus = exact(
    record.evidence_status ?? record.evidence?.status ?? "unexecuted",
    "transformation evidence status",
    32,
  );
  const rawRefusalCode = text(record.refusal_code ?? record.refusal?.code);
  const refusalCode = rawRefusalCode ? exact(rawRefusalCode, "transformation refusal code", 160) : null;
  return Object.freeze({
    schema: "idol.web.repository.transformation.summary.v1",
    id: exact(record.id, "transformation id", 160),
    observation_id: exact(record.observation_id, "observation id", 160),
    scaffold_id: exact(record.scaffold_id, "scaffold id", 160),
    status,
    selected_file_count: selectedFileCount,
    evidence_status: evidenceStatus,
    refusal_code: refusalCode,
    created_at: exact(record.created_at, "transformation creation time", 64),
  });
}

export async function createRepositoryTransformation(
  observation,
  scaffold,
  input = {},
  { createdAt = () => new Date().toISOString() } = {},
) {
  if (!observation || observation.schema !== "idol.web.repository.observation.v1") {
    throw new RepositoryError("TRANSFORMATION_OBSERVATION_REQUIRED", "valid repository observation required", 422);
  }
  if (!scaffold || scaffold.schema !== "idol.web.repository.scaffold.v1") {
    throw new RepositoryError("TRANSFORMATION_SCAFFOLD_REQUIRED", "valid repository scaffold required", 422);
  }
  if (String(scaffold.observation_id || "") !== String(observation.id || "")) {
    throw new RepositoryError(
      "TRANSFORMATION_PARENT_MISMATCH",
      "transformation scaffold does not belong to the selected observation",
      409,
    );
  }
  const timestamp = exact(createdAt(), "transformation creation time", 64);
  if (scaffold.status !== "preview" || !Array.isArray(scaffold.files) || !scaffold.files.length) {
    return refusedTransformation(
      observation,
      scaffold,
      timestamp,
      "TRANSFORMATION_SCAFFOLD_NOT_PREVIEW",
      "a lawful scaffold preview is required before a derived-world transformation can be projected",
    );
  }

  const intent = input?.intent == null
    ? "review scaffold projection"
    : exact(input.intent, "transformation intent", 240);
  const files = selectedFiles(scaffold, input);
  const paths = Object.freeze(files.map((file) => file.path));
  const patch = unifiedAddPatch(files);
  const patchDigest = await sha256(patch);
  const requestedEvidence = normalizedEvidence(input?.evidence);
  const document = baseDocument(observation, scaffold, timestamp);

  return Object.freeze({
    ...document,
    status: "preview",
    intent,
    selected_files: paths,
    files,
    patch,
    patch_sha256: patchDigest,
    transformation: Object.freeze({
      semantic_id: null,
      identity_status: "not-published",
      face: "repository-scaffold-projection",
    }),
    derived_world: derivedWorld(observation, scaffold, paths, patchDigest),
    evidence: Object.freeze({
      requested: requestedEvidence,
      status: "unexecuted",
      results: Object.freeze([]),
    }),
    refusal: null,
  });
}
