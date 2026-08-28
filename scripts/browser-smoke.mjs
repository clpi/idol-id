import { spawnSync } from "node:child_process";

for (const script of ["scripts/browser-smoke-base.mjs", "scripts/live-mcp-browser-smoke.mjs"]) {
  const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

// Required evidence: live-mobile.png live-desktop.png mcp-mobile.png mcp-desktop.png
// Required viewports: 390, 844 and 1440, 900. Both gates check scrollWidth,
// reject any visible control with height < 44, and observe Runtime.exceptionThrown.
