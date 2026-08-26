import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const output = resolve(root, "runtime", "worlds.json");
const source = process.env.IDOL_WORLD_SOURCE || "https://api.idol.id/api/worlds";
const optional = process.env.IDOL_WORLD_SNAPSHOT_OPTIONAL === "1";

function parseRegistryProjection(raw) {
  // The registry currently emits graph ids as JSON numbers. Preserve exact
  // 64-bit identities before JSON.parse can round them in JavaScript.
  const exact = raw.replace(/("graph_id"\s*:\s*)(-?\d{16,})(?=\s*[,}])/g, '$1"$2"');
  return JSON.parse(exact);
}

function validate(payload) {
  if (!payload || !Array.isArray(payload.worlds)) throw new Error("registry response must contain worlds[]");
  for (const [index, world] of payload.worlds.entries()) {
    if (!world || typeof world !== "object") throw new Error(`world ${index} is not an object`);
    if (typeof world.name !== "string" || !world.name) throw new Error(`world ${index} has no name`);
    if (world.graph_id !== undefined && typeof world.graph_id !== "string") {
      world.graph_id = String(world.graph_id);
    }
  }
  return payload.worlds;
}

async function snapshot() {
  const response = await fetch(source, {
    headers: { accept: "application/json", "user-agent": "idol-id-world-snapshot/1" },
  });
  if (!response.ok) throw new Error(`world source answered ${response.status}`);
  const worlds = validate(parseRegistryProjection(await response.text()));
  const document = {
    schema: "idol.web.worlds.v1",
    captured_at: new Date().toISOString(),
    source,
    worlds,
  };
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`);
  await rename(temporary, output);
  console.log(`snapshotted ${worlds.length} worlds from ${source}`);
}

try {
  await snapshot();
} catch (error) {
  if (optional) {
    console.warn(`world snapshot retained: ${error.message}`);
  } else {
    console.error(`world snapshot failed: ${error.message}`);
    process.exitCode = 1;
  }
}
