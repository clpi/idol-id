(() => {
  "use strict";
  const state = { available: false, admitted: false, inspected: false, loaded: false, manifest: null, instance: null, error: null };
  const hex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
  async function inspect() {
    if (state.inspected || state.error) return state;
    try {
      const response = await fetch("/runtime/manifest.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`runtime manifest ${response.status}`);
      state.manifest = await response.json();
      state.available = Boolean(state.manifest?.wasm?.available);
      state.admitted = Boolean(state.manifest?.wasm?.admitted && state.manifest?.wasm?.admission?.admitted);
      if (state.available && !state.admitted) throw new Error("Wasm artifact is present without admitted artifact-bound evidence");
      state.inspected = true;
    } catch (error) { state.error = String(error?.message || error); }
    return state;
  }
  async function load(imports = {}) {
    await inspect();
    if (!state.available || !state.admitted || state.loaded || state.error) return state;
    try {
      const response = await fetch(state.manifest.wasm.file, { cache: "force-cache" });
      if (!response.ok) throw new Error(`runtime wasm ${response.status}`);
      const bytes = await response.arrayBuffer();
      const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
      if (digest !== state.manifest.wasm.sha256) throw new Error(`runtime wasm sha256 mismatch: ${digest}`);
      const result = await WebAssembly.instantiate(bytes, imports);
      state.instance = result.instance || result;
      state.loaded = true;
    } catch (error) { state.error = String(error?.message || error); }
    return state;
  }
  window.IdolWasm = Object.freeze({ state, inspect, load, ready: inspect() });
})();
