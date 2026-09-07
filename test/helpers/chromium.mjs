import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

export async function executableChrome() {
  for (const candidate of [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean)) {
    try { await access(candidate, constants.X_OK); return candidate; } catch {}
  }
  return null;
}

export function dumpDom(chrome, url, profile) {
  return execute(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", `--user-data-dir=${profile}`, "--dump-dom", "--virtual-time-budget=15000", url], { timeout: 30000, killSignal: "SIGKILL", maxBuffer: 2 * 1024 * 1024 });
}
