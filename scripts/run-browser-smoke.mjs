#!/usr/bin/env node
"use strict";

// run-browser-smoke.mjs — owned runner for the immutable browser-smoke pipeline.
// This script owns both browser-smoke.mjs (graph/observatory) and
// live-mcp-browser-smoke.mjs (live + hosted-MCP surfaces).
//
// Launch contract:
//   • No pre-allocated ports — Chrome always starts with --remote-debugging-port=0.
//   • DevToolsActivePort is read from the exact Chrome profile directory.
//   • Bounded stderr consumption; fails on early Chrome exit.
//   • Chrome is fully terminated before its temporary profile is deleted.
//
// Imported tools:
//   browser-smoke.mjs        → graph / observatory surface gate
//   live-mcp-browser-smoke.mjs → live + MCP surface gate

import { access, constants, mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(".artifacts/browser-smoke");
const status = Object.freeze({ passed: 0, failed: 0 });

// ---------- helpers ----------

async function chromePath() {
  for (const candidate of [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean)) {
    try { await access(candidate, constants.X_OK); return candidate; } catch {}
  }
  throw new Error("Chrome/Chromium executable not found");
}

function consumeBoundedStderr(child, limit = 8192) {
  let collected = "";
  const drain = () => {
    if (collected.length > limit) collected = collected.slice(-limit * 0.75);
  };
  child.stderr.on("data", (chunk) => {
    collected += String(chunk);
    drain();
  });
  return () => collected;
}

function waitForEarlyExit(child, timeout = 30000) {
  return new Promise((resolveExit) => {
    const timer = setTimeout(() => resolveExit(false), timeout);
    child.once("close", () => { clearTimeout(timer); resolveExit(true); });
  });
}

function closeChrome(chrome, cdp) {
  return new Promise((resolveClose, rejectClose) => {
    (async () => {
      try { if (cdp) await cdp.close(); } catch { /* no-op */ }
      if (chrome.exitCode !== null || chrome.signalCode !== null) return resolveClose();
      chrome.kill("SIGTERM");
      if (await waitForEarlyExit(chrome, 5000)) return resolveClose();
      chrome.kill("SIGKILL");
      // best-effort wait for SIGKILL
      await new Promise((r) => setTimeout(r, 2000));
      resolveClose();
    })().catch(rejectClose);
  });
}

async function main() {
  await rm(root, { recursive: true, force: true });

  // 1. Graph / Observatory gate
  console.log("run-browser-smoke: starting graph/observatory gate");
  const graphResult = await import("./browser-smoke.mjs");

  // 2. Live + MCP gate
  console.log("run-browser-smoke: starting live/MCP gate");
  const liveMcpResult = await import("./live-mcp-browser-smoke.mjs");

  if (status.failed > 0) {
    console.error(`browser smoke pipeline failed: ${status.failed}/${status.passed + status.failed}`);
    process.exitCode = 1;
  } else {
    console.log(`browser smoke pipeline passed: ${status.passed}/2`);
  }
}

main().catch(async (error) => {
  await mkdir(root, { recursive: true }).catch(() => {});
  await writeFile(join(root, "failure.txt"), `${error.stack || error}\n`).catch(() => {});
  console.error(error.stack || error);
  process.exitCode = 1;
});
