(() => {
  "use strict";

  const state = {
    available: false,
    inspected: false,
    loaded: false,
    manifest: null,
    instance: null,
    error: null,
  };

  async function inspect() {
    if (state.inspected || state.error) return state;
    try {
      const response = await fetch("/runtime/manifest.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`runtime manifest ${response.status}`);
      state.manifest = await response.json();
      state.available = Boolean(state.manifest?.wasm?.available);
      state.inspected = true;
    } catch (error) {
      state.error = String(error?.message || error);
    }
    return state;
  }

  async function load(imports = {}) {
    await inspect();
    if (!state.available || state.loaded || state.error) return state;
    try {
      const response = await fetch(state.manifest.wasm.file, { cache: "force-cache" });
      if (!response.ok) throw new Error(`runtime wasm ${response.status}`);
      const bytes = await response.arrayBuffer();
      const result = await WebAssembly.instantiate(bytes, imports);
      state.instance = result.instance || result;
      state.loaded = true;
    } catch (error) {
      state.error = String(error?.message || error);
    }
    return state;
  }

  window.IdolWasm = Object.freeze({
    state,
    inspect,
    load,
    ready: inspect(),
  });
})();
