import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMemoryRepositoryStore } from "../shared/repository-memory.js";
import { isCompleteRepositoryObservation } from "../shared/repository-ui.js";

const timestamp = "2026-08-26T12:00:00.000Z";

function event(id) {
  return {
    id: `audit_${id}`,
    subject: "user",
    actor_email: "user@example.com",
    type: "repository.test",
    target: id,
    metadata: {},
    created_at: timestamp,
  };
}

test("repository observation summaries require detail hydration", async () => {
  assert.equal(isCompleteRepositoryObservation({ schema: "idol.web.repository.observation.summary.v1" }), false);
  assert.equal(isCompleteRepositoryObservation({ schema: "idol.web.repository.observation.v1" }), true);
  assert.equal(isCompleteRepositoryObservation(null), false);

  const application = await readFile("shared/repository-app.js", "utf8");
  assert.match(application, /isCompleteRepositoryObservation\(cached\)/);
  assert.match(application, /request\(`observations\/\$\{encodeURIComponent\(s\.observation_id\)\}`\)/);
});

test("memory observation and scaffold limits retain newest equal-timestamp records", async () => {
  const store = createMemoryRepositoryStore();
  for (let index = 0; index < 55; index += 1) {
    const observationId = `obs_${String(index).padStart(2, "0")}`;
    await store.commitObservation({
      id: observationId,
      subject: "user",
      provider: "github",
      namespace: "acme",
      repository: `repo-${index}`,
      resolved_revision: `revision-${index}`,
      file_count: index,
      inventory_truncated: false,
      document: {
        schema: "idol.web.repository.observation.v1",
        id: observationId,
        provider: "github",
        namespace: "acme",
        repository: `repo-${index}`,
        coordinate: `github:acme/repo-${index}`,
        resolved_revision: `revision-${index}`,
        inventory: { file_count: index, truncated: false },
        created_at: timestamp,
      },
      created_at: timestamp,
    }, event(observationId));

    const scaffoldId = `scf_${String(index).padStart(2, "0")}`;
    await store.commitScaffold({
      id: scaffoldId,
      subject: "user",
      observation_id: observationId,
      status: "preview",
      file_count: index,
      refusal_code: null,
      document: {
        schema: "idol.web.repository.scaffold.v1",
        id: scaffoldId,
        observation_id: observationId,
        status: "preview",
        created_at: timestamp,
      },
      created_at: timestamp,
    }, event(scaffoldId));
  }

  const observations = await store.listObservations("user", 50);
  const scaffolds = await store.listScaffolds("user", 50);
  assert.equal(observations.length, 50);
  assert.equal(scaffolds.length, 50);
  assert.equal(observations[0].id, "obs_54");
  assert.equal(observations.at(-1).id, "obs_05");
  assert.equal(scaffolds[0].id, "scf_54");
  assert.equal(scaffolds.at(-1).id, "scf_05");
});
