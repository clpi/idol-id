import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(import.meta.url);
const here = dirname(file);
const root = resolve(here, "..");
const output = resolve(root, "runtime", "worlds.json");
const defaultSource = "https://api.idol.id/api/worlds";

export function parseRegistryProjection(raw) {
  // The registry currently emits graph ids as JSON numbers. Preserve exact
  // 64-bit identities before JSON.parse can round them in JavaScript.
  const exact = raw.replace(/("graph_id"\s*:\s*)(-?\d{16,})(?=\s*[,}])/g, '$1"$2"');
  return JSON.parse(exact);
}

function validateWorlds(worlds) {
  if (!Array.isArray(worlds)) throw new Error("registry response must contain worlds[]");
  return worlds.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") throw new Error(`world ${index} is not an object`);
    if (typeof candidate.name !== "string" || !candidate.name) throw new Error(`world ${index} has no name`);
    const world = { ...candidate };
    if (world.graph_id !== undefined) world.graph_id = String(world.graph_id);
    return world;
  });
}

function sourceRevision(worlds) {
  const timestamps = worlds
    .map((world) => typeof world.published_at === "string" ? world.published_at : "")
    .filter(Boolean)
    .sort();
  return timestamps.at(-1) || "not-published";
}

export function buildSnapshot(worlds, source = defaultSource) {
  const exactWorlds = validateWorlds(worlds);
  return {
    schema: "idol.web.worlds.v1",
    // This is a revision of the published input facts, not wall-clock build
    // time. Identical registry facts therefore produce byte-identical output.
    captured_at: sourceRevision(exactWorlds),
    source,
    worlds: exactWorlds,
  };
}

export async function snapshotWorlds({
  source = process.env.IDOL_WORLD_SOURCE || defaultSource,
  target = output,
  fetcher = fetch,
} = {}) {
  const response = await fetcher(source, {
    headers: { accept: "application/json", "user-agent": "idol-id-world-snapshot/1" },
  });
  if (!response.ok) throw new Error(`world source answered ${response.status}`);
  const payload = parseRegistryProjection(await response.text());
  const document = buildSnapshot(payload.worlds, source);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`);
  await rename(temporary, target);
  return document;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(file);
if (isMain) {
  const optional = process.env.IDOL_WORLD_SNAPSHOT_OPTIONAL === "1";
  try {
    const document = await snapshotWorlds();
    console.log(`snapshotted ${document.worlds.length} worlds from ${document.source}`);
  } catch (error) {
    if (optional) {
      console.warn(`world snapshot retained: ${error.message}`);
    } else {
      console.error(`world snapshot failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
