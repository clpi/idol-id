import { createServer } from "node:net";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const artifacts = resolve(".artifacts/browser-smoke");
const MAX_ATTEMPTS = 3;
const OUTPUT_LIMIT = 1024 * 1024;
const STARTUP_FAILURE = /timed out waiting for http:\/\/127\.0\.0\.1:|EADDRINUSE|ECONNREFUSED/i;
const gates = Object.freeze([
  Object.freeze({ name: "observatory", script: "scripts/browser-smoke.mjs", portVariable: "IDOL_BROWSER_DEBUG_PORT" }),
  Object.freeze({ name: "studio", script: "scripts/studio-browser-smoke.mjs", portVariable: "IDOL_STUDIO_DEBUG_PORT" }),
  Object.freeze({ name: "live-mcp", script: "scripts/live-mcp-browser-smoke.mjs", portVariable: "IDOL_LIVE_BROWSER_DEBUG_PORT" }),
]);

function appendBounded(current, chunk) {
  const next = current + String(chunk);
  return next.length <= OUTPUT_LIMIT ? next : next.slice(next.length - OUTPUT_LIMIT);
}

async function executableChrome() {
  for (const candidate of [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean)) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  throw new Error("Chrome/Chromium executable not found before browser-smoke orchestration");
}

async function ephemeralPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? Number(address.port) : 0;
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  if (!Number.isInteger(port) || port < 1) throw new Error("operating system did not allocate a browser-smoke CDP port");
  return port;
}

async function wrapper(realChrome) {
  const directory = await mkdtemp(join(tmpdir(), "idol-chrome-smoke-"));
  const path = join(directory, "chrome");
  await writeFile(path, `#!/usr/bin/env bash\nset -euo pipefail\n: "\${IDOL_CHROME_REAL_BIN:?}"\n: "\${IDOL_CHROME_LOG:?}"\nexec "\$IDOL_CHROME_REAL_BIN" "\$@" 2>>"\$IDOL_CHROME_LOG"\n`, { mode: 0o755 });
  return { directory, path, realChrome };
}

async function runProcess(script, environment) {
  const child = spawn(process.execPath, [script], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout = appendBounded(stdout, chunk);
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr = appendBounded(stderr, chunk);
    process.stderr.write(chunk);
  });
  const result = await new Promise((resolveRun, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolveRun({ code, signal }));
  });
  return { ...result, stdout, stderr };
}

async function printChromeLog(path, gate, attempt) {
  let value = "";
  try { value = await readFile(path, "utf8"); } catch {}
  if (!value.trim()) return;
  const bounded = value.length <= OUTPUT_LIMIT ? value : value.slice(value.length - OUTPUT_LIMIT);
  process.stderr.write(`\n--- ${gate} Chrome stderr · attempt ${attempt} ---\n${bounded}\n--- end Chrome stderr ---\n`);
}

async function runGate(gate, launch) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const port = await ephemeralPort();
    await mkdir(artifacts, { recursive: true });
    const log = join(artifacts, `${gate.name}-chrome-attempt-${attempt}.log`);
    const environment = {
      ...process.env,
      CHROME_BIN: launch.path,
      IDOL_CHROME_REAL_BIN: launch.realChrome,
      IDOL_CHROME_LOG: log,
      [gate.portVariable]: String(port),
    };
    console.log(`browser smoke ${gate.name}: attempt ${attempt}/${MAX_ATTEMPTS} on ephemeral CDP port ${port}`);
    const result = await runProcess(gate.script, environment);
    if (result.code === 0) return;

    await printChromeLog(log, gate.name, attempt);
    const output = `${result.stdout}\n${result.stderr}`;
    const retryable = STARTUP_FAILURE.test(output);
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`${gate.name} browser smoke failed with code ${result.code ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}; retryable_startup_failure=${retryable}`);
    }
    console.error(`browser smoke ${gate.name}: retrying after bounded Chrome startup failure`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 250 * attempt));
  }
}

async function main() {
  const launch = await wrapper(await executableChrome());
  try {
    for (const gate of gates) await runGate(gate, launch);
  } finally {
    await rm(launch.directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
