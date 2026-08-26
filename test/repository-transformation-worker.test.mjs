import test from "node:test";
import assert from "node:assert/strict";
import { handleRepositoryTransport } from "../worker/repository.js";

const platformInfo = { app: "platform", surface: "platform", origin: false };
const apiInfo = { app: "api", surface: "api", origin: true };
const identity = { subject: "user-1", email: "user@example.com", displayName: "User" };
const env = {
  ACCESS_TEAM_DOMAIN: "team.example",
  REPOSITORY_ACCESS_AUD: "repo-aud",
  ACCESS_EMAIL: "user@example.com",
  PLATFORM_DB: {},
};

function services() {
  const requiredScopes = [];
  const transformation = {
    schema: "idol.web.repository.transformation.v1",
    id: "trn_test_identifier_1",
    observation_id: "obs_test_identifier_1",
    scaffold_id: "scf_test_identifier_1",
    status: "preview",
    semantic_id: null,
    identity_status: "not-published",
    selected_files: [".idol/project.json"],
    patch: "patch",
    patch_sha256: "a".repeat(64),
    evidence: { requested: ["test"], status: "unexecuted" },
    executed: false,
    source_world_mutated: false,
    repository_written: false,
    world_published: false,
  };
  return {
    requiredScopes,
    platformService: {
      async session(candidate) { return { profile: candidate }; },
      async authenticateApiToken(token, scope) {
        assert.equal(token, "idol_pat_example.secret");
        requiredScopes.push(scope);
        return identity;
      },
    },
    repositoryService: {
      async listObservations() { return []; },
      async listScaffolds() { return []; },
      async listTransformations() { return [{ id: transformation.id, status: transformation.status }]; },
      async getTransformation(_identity, id) { assert.equal(id, transformation.id); return transformation; },
      async createTransformation(_identity, scaffoldId, input) {
        assert.equal(scaffoldId, transformation.scaffold_id);
        assert.deepEqual(input.selected_files, transformation.selected_files);
        return transformation;
      },
    },
  };
}

function browserRequest(path, init = {}) {
  return new Request(`https://platform.idol.id${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      origin: "https://platform.idol.id",
      "x-idol-request": "browser",
      ...(init.headers || {}),
    },
  });
}

function apiRequest(path, init = {}) {
  return new Request(`https://api.idol.id${path}`, {
    ...init,
    headers: {
      authorization: "Bearer idol_pat_example.secret",
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

test("browser creates and reads a non-executing derived-world transformation preview", async () => {
  const dependencies = { ...services(), verifyAccess: async () => identity };
  const createPath = "/v1/repository/browser/scaffolds/scf_test_identifier_1/transformations";
  let response = await handleRepositoryTransport(browserRequest(createPath, {
    method: "POST",
    body: JSON.stringify({
      intent: "adopt Idol graph surface",
      selected_files: [".idol/project.json"],
      evidence: ["test"],
    }),
  }), env, createPath, platformInfo, dependencies);
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.executed, false);
  assert.equal(created.repository_written, false);
  assert.equal(created.world_published, false);

  const readPath = `/v1/repository/browser/transformations/${created.id}`;
  response = await handleRepositoryTransport(browserRequest(readPath), env, readPath, platformInfo, dependencies);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).patch_sha256, "a".repeat(64));
});

test("API transformation write requires repository:transform while reads remain repository:read", async () => {
  const dependencies = services();
  const listPath = "/v1/repository/api/transformations";
  let response = await handleRepositoryTransport(apiRequest(listPath), env, listPath, apiInfo, dependencies);
  assert.equal(response.status, 200);

  const createPath = "/v1/repository/api/scaffolds/scf_test_identifier_1/transformations";
  response = await handleRepositoryTransport(apiRequest(createPath, {
    method: "POST",
    body: JSON.stringify({ selected_files: [".idol/project.json"] }),
  }), env, createPath, apiInfo, dependencies);
  assert.equal(response.status, 201);
  assert.deepEqual(dependencies.requiredScopes, ["repository:read", "repository:transform"]);
});

test("repository status publishes preview-only Program N boundaries", async () => {
  const response = await handleRepositoryTransport(
    new Request("https://platform.idol.id/v1/repository/status"),
    env,
    "/v1/repository/status",
    platformInfo,
  );
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.equal(status.transformation, "derived-world-preview-only");
  assert.equal(status.execution, false);
  assert.equal(status.repository_write, false);
  assert.equal(status.world_publication, false);
});
