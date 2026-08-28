import { readFile } from "node:fs/promises";

function parseJsonc(source) {
  return JSON.parse(String(source)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1"));
}
const wrangler = parseJsonc(await readFile("wrangler.jsonc", "utf8"));
const authority = JSON.parse(await readFile("runtime/authority.json", "utf8"));
const expectedCommit = process.env.EXPECTED_WEB_COMMIT || process.env.GITHUB_SHA;
if (!/^[0-9a-f]{40}$/.test(expectedCommit || "")) throw new Error("EXPECTED_WEB_COMMIT or GITHUB_SHA must be an exact commit");
const hosts = [...new Set(wrangler.routes.map((route) => route.pattern.split("/")[0]))].sort();
const attempts = Number(process.env.IDOL_VERIFY_ATTEMPTS || 20);
const delay = Number(process.env.IDOL_VERIFY_DELAY_MS || 3000);
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function document(url, init = {}) {
  const response = await fetch(url, { redirect: "manual", cache: "no-store", ...init });
  const type = response.headers.get("content-type") || "";
  let body;
  try { body = type.includes("json") ? await response.json() : await response.text(); }
  catch { body = null; }
  return { response, body };
}
function assert(condition, message) { if (!condition) throw new Error(message); }
async function verifyVersion(host) {
  const { response, body } = await document(`https://${host}/__idol/version`);
  assert(response.ok, `${host} version ${response.status}`);
  assert(body?.commit === expectedCommit, `${host} web commit ${body?.commit} != ${expectedCommit}`);
  assert(body?.authority === authority.language.commit, `${host} authority mismatch`);
  assert(body?.native_authority === authority.native.commit, `${host} native authority mismatch`);
  assert(body?.source_law === authority.language.source_law.sha256, `${host} source law mismatch`);
  return { host, status: response.status, app: body.app, surface: body.surface };
}
async function verifyHost(host) {
  if (host === "www.idol.id") {
    const { response } = await document(`https://${host}/`);
    const location = response.headers.get("location");
    assert(response.status === 308 && String(location || "").startsWith("https://idol.id"), `${host} redirect mismatch`);
    return { host, status: response.status, redirect: location };
  }
  if (host === "live.idol.id") {
    const { response } = await document("https://live.idol.id/");
    assert([301, 302, 303, 307, 401, 403].includes(response.status), `Live Access boundary returned ${response.status}`);
    const location = response.headers.get("location") || "";
    if ([301, 302, 303, 307].includes(response.status)) assert(location.includes("cloudflareaccess.com"), `Live redirect is not Cloudflare Access: ${location}`);
    return { host, status: response.status, access: "protected" };
  }
  return verifyVersion(host);
}
async function verifyMcp() {
  const shell = await document("https://mcp.idol.id/");
  assert(shell.response.status === 200, `MCP shell returned ${shell.response.status}`);
  assert(String(shell.body).includes("https://mcp.idol.id/mcp"), "MCP shell omits canonical endpoint");

  const refusal = await document("https://mcp.idol.id/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": "server/discover"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: "production-boundary", method: "server/discover", params: {} })
  });
  assert(refusal.response.status === 401, `unauthenticated MCP returned ${refusal.response.status}`);
  assert(refusal.body?.error?.code === "API_TOKEN_REQUIRED", `unexpected MCP refusal ${JSON.stringify(refusal.body)}`);

  for (const [path, schema] of [
    ["/runtime/mcp.json", "idol.web.mcp.runtime.v1"],
    ["/runtime/live-contract.json", "idol.web.live.contract.v1"]
  ]) {
    const value = await document(`https://mcp.idol.id${path}`);
    assert(value.response.status === 200, `${path} returned ${value.response.status}`);
    assert(value.body?.schema === schema, `${path} schema mismatch`);
    assert(value.body?.semantic_authority === false, `${path} overclaims semantic authority`);
  }
}

let last;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const results = [];
    for (const host of hosts) results.push(await verifyHost(host));
    await verifyMcp();
    console.log(JSON.stringify({
      verified: true,
      commit: expectedCommit,
      authority: authority.language.commit,
      hosts: results,
      live: "Cloudflare Access protected",
      mcp: "server/discover fails closed without API token"
    }, null, 2));
    process.exit(0);
  } catch (error) {
    last = error;
    if (attempt < attempts) await sleep(delay);
  }
}
throw last;
