const PRESERVED_PROJECTION_CONTRACTS = Object.freeze({
  applications: Object.freeze(["universe", "platform-universe-entry.js"]),
  universe: Object.freeze({
    public: "https://lib.idol.id/universe",
    kind: "operational-projection",
    dispatcher_access: false,
  }),
  repository: Object.freeze({
    transformation: "derived-world-preview-only",
    world_publication: false,
  }),
});
void PRESERVED_PROJECTION_CONTRACTS;

await import("./build-base.mjs");
await import("./build-live.mjs");
