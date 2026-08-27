#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runIdolWasmBytes } from "../shared/wasm-runtime.mjs";

const args = process.argv.slice(2);
const json = args[0] === "--json";
const path = resolve(json ? args[1] || "" : args[0] || "");
if (!path) {
  console.error("usage: node scripts/run-idol-wasm.mjs [--json] <module.wasm>");
  process.exit(2);
}

try {
  const result = await runIdolWasmBytes(await readFile(path));
  if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
} catch (error) {
  console.error(`idol wasm: ${error.message}`);
  process.exitCode = 2;
}
