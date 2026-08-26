import test from "node:test";
import assert from "node:assert/strict";
import { PlatformError } from "../shared/platform.js";
import { handleRepositoryTransport } from "../worker/repository.js";

const env = {
  ACCESS_TEAM_DOMAIN: "team.example",
  REPOSITORY_ACCESS_AUD: "repo-aud",
  ACCESS_EMAIL: "user@example.com",
  PLATFORM_DB: {},
};
const platformInfo = { app: "platform", surface: "platform", origin: false };
const apiInfo = { app: "api", surface: "api", origin: true };
const repositoryService = {
  async listObservations() { return []; },
  async listScaffolds() { return []; },
};

test("repository API preserves invalid-token status instead of converting it to 500", async () => {
  const request = new Request("https://api.idol.id/v1/repository/api/observations", {
    headers: { authorization: "Bearer invalid" },
  });
  const response = await handleRepositoryTransport(
    request,
    env,
    "/v1/repository/api/observations",
    apiInfo,
    {
      platformService: {
        async authenticateApiToken() {
          throw new PlatformError("API_TOKEN_INVALID", "API token is invalid", 401);
        },
      },
      repositoryService,
    },
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "API_TOKEN_INVALID", detail: "API token is invalid" });
});

test("repository browser preserves platform session validation status", async () => {
  const request = new Request("https://platform.idol.id/v1/repository/browser/observations", {
    headers: { "cf-access-jwt-assertion": "test" },
  });
  const response = await handleRepositoryTransport(
    request,
    env,
    "/v1/repository/browser/observations",
    platformInfo,
    {
      verifyAccess: async () => ({ subject: "user", email: "user@example.com", displayName: "User" }),
      platformService: {
        async session() {
          throw new PlatformError("PROFILE_INVALID", "profile is invalid", 422);
        },
      },
      repositoryService,
    },
  );
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "PROFILE_INVALID", detail: "profile is invalid" });
});

test("repository browser does not reuse the IDE Access audience", async () => {
  const response = await handleRepositoryTransport(
    new Request("https://platform.idol.id/v1/repository/browser/observations"),
    { ACCESS_TEAM_DOMAIN: "team.example", ACCESS_AUD: "ide-aud", ACCESS_EMAIL: "user@example.com", PLATFORM_DB: {} },
    "/v1/repository/browser/observations",
    platformInfo,
    {
      verifyAccess: async () => ({ subject: "user", email: "user@example.com" }),
      platformService: {},
      repositoryService,
    },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "ACCESS_NOT_CONFIGURED" });
});
