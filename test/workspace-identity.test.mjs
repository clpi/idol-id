import test from "node:test";
import assert from "node:assert/strict";
import { restoreWorkspace } from "../shared/workspace.js";

const base = {
  schema: "idol.browser.workspace.v1",
  id: "workspace-1",
  name: "scratch",
  active: "file-1",
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
  files: [{ id: "file-1", path: "main.id", source: "main() 0" }],
};

test("workspace restoration rejects missing or null workspace identities", () => {
  assert.throws(() => restoreWorkspace({ ...base, id: undefined }), /invalid workspace identity/);
  assert.throws(() => restoreWorkspace({ ...base, id: null }), /invalid workspace identity/);
});

test("workspace restoration rejects missing or null file identities", () => {
  assert.throws(() => restoreWorkspace({ ...base, files: [{ ...base.files[0], id: undefined }] }), /invalid workspace identity/);
  assert.throws(() => restoreWorkspace({ ...base, files: [{ ...base.files[0], id: null }] }), /invalid workspace identity/);
});
