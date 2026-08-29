await import("./provision-platform-base.mjs");
if (process.exitCode) throw new Error("base Platform provisioning failed");
await import("./provision-live-access.mjs");
