(() => {
  "use strict";

  let active = null;
  let depth = 0;
  const queue = new Set();
  let scheduled = false;

  function flush() {
    scheduled = false;
    const work = [...queue];
    queue.clear();
    for (const run of work) run();
  }

  function schedule(run) {
    queue.add(run);
    if (depth > 0 || scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
  }

  function batch(fn) {
    depth += 1;
    try {
      return fn();
    } finally {
      depth -= 1;
      if (depth === 0 && queue.size && !scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    }
  }

  function state(initial) {
    let value = initial;
    const readers = new Set();
    return Object.freeze({
      get() {
        if (active) {
          readers.add(active);
          active.sources.add(readers);
        }
        return value;
      },
      set(next) {
        if (Object.is(value, next)) return value;
        value = next;
        for (const reader of readers) schedule(reader.run);
        return value;
      },
      update(change) {
        return this.set(change(value));
      },
      subscribe(reader) {
        const observer = typeof reader === "function" ? { run: reader, sources: new Set() } : reader;
        readers.add(observer);
        return () => readers.delete(observer);
      },
    });
  }

  function effect(fn) {
    const observer = {
      sources: new Set(),
      disposed: false,
      run() {
        if (observer.disposed) return;
        for (const source of observer.sources) source.delete(observer);
        observer.sources.clear();
        const previous = active;
        active = observer;
        try {
          fn();
        } finally {
          active = previous;
        }
      },
      dispose() {
        observer.disposed = true;
        for (const source of observer.sources) source.delete(observer);
        observer.sources.clear();
      },
    };
    observer.run();
    return observer.dispose;
  }

  function derive(fn) {
    const output = state(undefined);
    effect(() => output.set(fn()));
    return output;
  }

  function text(node, read) {
    return effect(() => {
      const value = typeof read === "function" ? read() : read.get();
      const next = value == null ? "" : String(value);
      if (node.textContent !== next) node.textContent = next;
    });
  }

  function attr(node, name, read) {
    return effect(() => {
      const value = typeof read === "function" ? read() : read.get();
      if (value === false || value == null) node.removeAttribute(name);
      else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value));
    });
  }

  function on(node, event, listener, options) {
    node.addEventListener(event, listener, options);
    return () => node.removeEventListener(event, listener, options);
  }

  function mount(root, render) {
    const disposers = [];
    const api = {
      root,
      use(dispose) {
        if (typeof dispose === "function") disposers.push(dispose);
        return dispose;
      },
    };
    render(api);
    return () => {
      while (disposers.length) disposers.pop()();
      root.replaceChildren();
    };
  }

  window.IdolWeb = Object.freeze({
    version: "0.1.0",
    realization: "semantic-bridge",
    state,
    derive,
    effect,
    batch,
    text,
    attr,
    on,
    mount,
  });
})();
