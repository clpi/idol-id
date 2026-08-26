import { access, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = join(root, "dist");
const authorityPin = JSON.parse(await readFile(join(root, "runtime", "authority.json"), "utf8"));
const authority = authorityPin.language.commit;
const native = authorityPin.native.commit;
const commit = process.env.GITHUB_SHA || process.env.IDOL_WEB_COMMIT || "development";

async function exists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const directory of ["apps", "shared", "content"]) {
  await cp(join(root, directory), join(dist, directory), { recursive: true });
}

const runtimeScripts = [
  '<script src="/shared/web.js" defer></script>',
  '<script src="/shared/wasm.js" defer></script>',
].join("\n    ");

for (const app of ["site", "docs", "lib", "api", "graph", "worlds", "platform"]) {
  const path = join(dist, "apps", app, "index.html");
  let html = await readFile(path, "utf8");
  if (!html.includes("/shared/web.js")) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n    <!-- idol runtime -->\n    ${runtimeScripts}`);
  }
  await writeFile(path, html);
}

await mkdir(join(dist, "runtime"), { recursive: true });
await cp(join(root, "runtime", "worlds.json"), join(dist, "runtime", "worlds.json"));
const configured = process.env.IDOL_WASM_PATH ? resolve(process.env.IDOL_WASM_PATH) : join(root, "runtime", "idol-web.wasm");
let wasm = { available: false, file: null, bytes: 0, sha256: null };
if (await exists(configured)) {
  const target = join(dist, "runtime", "idol-web.wasm");
  await cp(configured, target);
  const bytes = await readFile(target);
  wasm = {
    available: true,
    file: "/runtime/idol-web.wasm",
    bytes: (await stat(target)).size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

const runtimeManifest = {
  schema: "idol.web.runtime.v1",
  authority: { repository: "clpi/idol", commit: authority },
  native: { repository: "clpi/idol-native", commit: native },
  bridge: "/shared/web.js",
  wasm,
  note: wasm.available
    ? "Idol Wasm artifact is deployed and loaded as the preferred compute realization."
    : "The semantic web bridge is active; provide IDOL_WASM_PATH when the canonical Idol browser artifact is admitted.",
};
await writeFile(join(dist, "runtime", "manifest.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);

const manifest = {
  schema: "idol.web.deploy.v1",
  commit,
  authority,
  surfaces: {
    "idol.id": "site",
    "docs.idol.id": "docs",
    "lib.idol.id": "lib",
    "api.idol.id": "api",
    "graph.idol.id": "graph",
    "worlds.idol.id": "worlds",
    "platform.idol.id": "platform",
    "r8a.idol.id": "graph:r8a",
    "r8b.idol.id": "graph:r8b",
    "r16.idol.id": "graph:r16",
  },
  runtime: runtimeManifest,
};
await writeFile(join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`built ${Object.keys(manifest.surfaces).length} idol.id surfaces at ${commit}`);
console.log(`idol wasm: ${wasm.available ? `${wasm.bytes} bytes ${wasm.sha256}` : "not supplied (bridge remains explicit)"}`);
