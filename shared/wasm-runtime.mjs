const DEFAULT_OUTPUT_LIMIT = 1024 * 1024;
const HOST_AUTHORITY = "wasi-fd-write-and-proc-exit-only";

class WasiExit extends Error {
  constructor(code) {
    super(`WASI proc_exit(${code})`);
    this.name = "WasiExit";
    this.code = Number(code) >>> 0;
  }
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("Idol Wasm bytes must be an ArrayBuffer or typed array");
}

function appendBounded(chunks, chunk, state) {
  if (!chunk.byteLength) return;
  if (state.bytes + chunk.byteLength > state.limit) {
    throw new RangeError(`Idol Wasm output exceeded ${state.limit} bytes`);
  }
  chunks.push(chunk.slice());
  state.bytes += chunk.byteLength;
}

function concat(chunks, length) {
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function readIovecs(memory, pointer, count) {
  if (!(memory instanceof WebAssembly.Memory)) throw new Error("Idol Wasm called fd_write without exported memory");
  const view = new DataView(memory.buffer);
  const bytes = new Uint8Array(memory.buffer);
  const chunks = [];
  for (let index = 0; index < count; index += 1) {
    const base = pointer + index * 8;
    if (base < 0 || base + 8 > view.byteLength) throw new RangeError("Idol Wasm iovec is outside memory");
    const start = view.getUint32(base, true);
    const length = view.getUint32(base + 4, true);
    if (start + length > bytes.byteLength) throw new RangeError("Idol Wasm output slice is outside memory");
    chunks.push(bytes.slice(start, start + length));
  }
  return chunks;
}

function writeU32(memory, pointer, value) {
  if (!(memory instanceof WebAssembly.Memory)) throw new Error("Idol Wasm called fd_write without exported memory");
  if (pointer < 0 || pointer + 4 > memory.buffer.byteLength) throw new RangeError("Idol Wasm nwritten pointer is outside memory");
  new DataView(memory.buffer).setUint32(pointer, value >>> 0, true);
}

export async function runIdolWasmBytes(value, options = {}) {
  const bytes = bytesOf(value);
  const outputLimit = Number.isSafeInteger(options.outputLimit) && options.outputLimit > 0
    ? options.outputLimit
    : DEFAULT_OUTPUT_LIMIT;
  const stdout = [];
  const stderr = [];
  const outputState = { bytes: 0, limit: outputLimit };
  let memory = null;
  let exitCode = 0;

  const imports = {
    wasi_snapshot_preview1: {
      fd_write(fd, iovs, iovsLength, nwritten) {
        if (fd !== 1 && fd !== 2) return 8;
        const chunks = readIovecs(memory, iovs >>> 0, iovsLength >>> 0);
        let written = 0;
        for (const chunk of chunks) {
          appendBounded(fd === 1 ? stdout : stderr, chunk, outputState);
          written += chunk.byteLength;
        }
        writeU32(memory, nwritten >>> 0, written);
        return 0;
      },
      proc_exit(code) {
        throw new WasiExit(code);
      },
    },
  };

  const result = await WebAssembly.instantiate(bytes, imports);
  const instance = result.instance || result;
  memory = instance.exports.memory instanceof WebAssembly.Memory ? instance.exports.memory : null;
  const entryName = String(options.entry || "_start");
  const entry = instance.exports[entryName];
  if (typeof entry !== "function") throw new Error(`Idol Wasm export ${entryName} is absent`);

  try {
    entry();
  } catch (error) {
    if (error instanceof WasiExit) exitCode = error.code;
    else throw error;
  }

  const stdoutBytes = concat(stdout, stdout.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  const stderrBytes = concat(stderr, stderr.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return Object.freeze({
    stdout: decoder.decode(stdoutBytes),
    stderr: decoder.decode(stderrBytes),
    exitCode,
    hostAuthority: HOST_AUTHORITY,
    exports: Object.freeze(Object.keys(instance.exports).sort()),
    bytes: bytes.byteLength,
  });
}

export async function runIdolWasmResponse(response, options = {}) {
  if (!response || !response.ok) throw new Error(`Idol Wasm response ${response?.status || "unavailable"}`);
  return runIdolWasmBytes(await response.arrayBuffer(), options);
}

export async function runIdolWasmUrl(url, options = {}) {
  const fetcher = options.fetcher || fetch;
  const response = await fetcher(url, { cache: options.cache || "force-cache" });
  return runIdolWasmResponse(response, options);
}

export const IDOL_WASM_HOST_AUTHORITY = HOST_AUTHORITY;
