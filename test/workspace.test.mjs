import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryWorkspaceStore,
  addFile,
  createWorkspace,
  removeFile,
  renameFile,
  restoreWorkspace,
  selectFile,
  workspaceSnapshot,
  writeFile,
} from "../shared/workspace.js";

function ids(...values) {
  let index = 0;
  return () => values[index++] || `id-${index}`;
}

test("workspace mutations are immutable and select the first file", () => {
  const initial = createWorkspace("scratch", { idFactory: ids("workspace-1") });
  const withMain = addFile(initial, "main.id", "main() 0", { idFactory: ids("file-1"), now: "2026-08-26T00:00:00.000Z" });
  assert.notEqual(withMain, initial);
  assert.equal(initial.files.length, 0);
  assert.equal(withMain.files[0].path, "main.id");
  assert.equal(withMain.files[0].source, "main() 0");
  assert.equal(withMain.active, "file-1");
  assert.ok(Object.isFrozen(withMain));
  assert.ok(Object.isFrozen(withMain.files));
  assert.ok(Object.isFrozen(withMain.files[0]));
});

test("workspace paths reject traversal absolute forms and collisions", () => {
  const workspace = addFile(
    createWorkspace("scratch", { idFactory: ids("workspace-1") }),
    "src/main.id",
    "main() 0",
    { idFactory: ids("file-1") },
  );
  for (const path of ["", "/main.id", "../secret", "src/../secret", "./main.id", "src\\main.id", "src//main.id", "src/\0bad.id"]) {
    assert.throws(() => addFile(workspace, path, "", { idFactory: ids("file-x") }), /invalid workspace path/);
  }
  assert.throws(() => addFile(workspace, "src/main.id", "", { idFactory: ids("file-x") }), /already exists/);
  assert.throws(() => renameFile(workspace, "file-1", "../main.id"), /invalid workspace path/);
});

test("rename write select and removal preserve deterministic active selection", () => {
  let workspace = createWorkspace("scratch", { idFactory: ids("workspace-1") });
  workspace = addFile(workspace, "b.id", "b", { idFactory: ids("file-b"), now: "2026-08-26T00:00:00.000Z" });
  workspace = addFile(workspace, "a.id", "a", { idFactory: ids("file-a"), now: "2026-08-26T00:00:01.000Z" });
  workspace = selectFile(workspace, "file-a");
  workspace = writeFile(workspace, "file-a", "a2", { now: "2026-08-26T00:00:02.000Z" });
  workspace = renameFile(workspace, "file-a", "src/a.id", { now: "2026-08-26T00:00:03.000Z" });
  assert.equal(workspace.files.find((file) => file.id === "file-a").source, "a2");
  assert.equal(workspace.files.find((file) => file.id === "file-a").path, "src/a.id");
  workspace = removeFile(workspace, "file-a", { now: "2026-08-26T00:00:04.000Z" });
  assert.equal(workspace.active, "file-b");
  workspace = removeFile(workspace, "file-b");
  assert.equal(workspace.active, null);
});

test("workspace enforces file count file size and snapshot size bounds", () => {
  let workspace = createWorkspace("scratch", { idFactory: ids("workspace-1") });
  assert.throws(() => addFile(workspace, "huge.id", "x".repeat(2 * 1024 * 1024 + 1), { idFactory: ids("huge") }), /file exceeds 2097152 bytes/);
  for (let index = 0; index < 256; index += 1) {
    workspace = addFile(workspace, `f${index}.id`, "", { idFactory: ids(`file-${index}`) });
  }
  assert.throws(() => addFile(workspace, "overflow.id", "", { idFactory: ids("overflow") }), /workspace file limit/);

  const oversized = {
    schema: "idol.browser.workspace.v1",
    id: "workspace-1",
    name: "large",
    active: "file-1",
    created_at: "2026-08-26T00:00:00.000Z",
    updated_at: "2026-08-26T00:00:00.000Z",
    files: Array.from({ length: 5 }, (_, index) => ({ id: `file-${index}`, path: `f${index}.id`, source: "x".repeat(2 * 1024 * 1024) })),
  };
  assert.throws(() => restoreWorkspace(oversized), /snapshot exceeds 8388608 bytes/);
});

test("snapshot ordering and restore are deterministic and validated", () => {
  let workspace = createWorkspace("scratch", { idFactory: ids("workspace-1"), now: "2026-08-26T00:00:00.000Z" });
  workspace = addFile(workspace, "z.id", "z", { idFactory: ids("file-z") });
  workspace = addFile(workspace, "a.id", "a", { idFactory: ids("file-a") });
  const first = workspaceSnapshot(workspace);
  const second = workspaceSnapshot(restoreWorkspace(first));
  assert.deepEqual(first, second);
  assert.deepEqual(first.files.map((file) => file.path), ["a.id", "z.id"]);
  assert.throws(() => restoreWorkspace({ ...first, schema: "other" }), /unsupported workspace schema/);
  assert.throws(() => restoreWorkspace({ ...first, active: "missing" }), /active file is not present/);
});

test("memory store round trips clones and sorts by updated time", async () => {
  const store = new MemoryWorkspaceStore();
  let older = createWorkspace("older", { idFactory: ids("workspace-old"), now: "2026-08-26T00:00:00.000Z" });
  older = addFile(older, "main.id", "old", { idFactory: ids("file-old"), now: "2026-08-26T00:00:00.000Z" });
  let newer = createWorkspace("newer", { idFactory: ids("workspace-new"), now: "2026-08-26T00:00:01.000Z" });
  newer = addFile(newer, "main.id", "new", { idFactory: ids("file-new"), now: "2026-08-26T00:00:01.000Z" });
  await store.save(older);
  await store.save(newer);
  const loaded = await store.load("workspace-old");
  assert.deepEqual(workspaceSnapshot(loaded), workspaceSnapshot(older));
  assert.notEqual(loaded, older);
  assert.deepEqual((await store.list()).map((workspace) => workspace.id), ["workspace-new", "workspace-old"]);
  await store.delete("workspace-new");
  assert.equal(await store.load("workspace-new"), null);
});
