import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { handleLiveTransport } from "../worker/live.js";
import { createD1LiveStore } from "../shared/live-d1.js";
import { createLiveService } from "../shared/live-service.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const execute = promisify(execFile);
const identity = { subject: "pack-browser-owner", email: "owner@example.test", displayName: "Pack owner" };

function d1(database) {
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        bind(...values) {
          return {
            run() { statement.run(...values); return { success: true }; },
            first() { return statement.get(...values) ?? null; },
            all() { return { results: statement.all(...values) }; },
          };
        },
      };
    },
    batch(statements) {
      database.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.run());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

async function browserForms(cases) {
  const wait = async (predicate) => {
    const started = Date.now();
    while (!predicate()) {
      if (Date.now() - started > 10000) throw new Error("Live form did not settle");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const result = document.createElement("output");
  result.id = "live-pack-proof";
  try {
    await wait(() => document.querySelector("#live-node-grid [data-record-id]"));
    const form = document.querySelector("#live-application-form");
    const button = form.querySelector("button[type=submit]");
    for (const input of cases) {
      const { error, ...fields } = input;
      for (const [name, value] of Object.entries(fields)) form.elements.namedItem(name).value = value;
      form.requestSubmit();
      await wait(() => !button.disabled);
      const notice = document.querySelector("#live-notice");
      if (error ? notice.hidden || !notice.textContent.includes(error) : !notice.hidden) throw new Error(notice.textContent || "Expected refusal was not displayed");
    }
    result.textContent = "complete";
  } catch (error) {
    result.textContent = error.message;
  }
  document.body.append(result);
}

test("Live browser preserves repeated operand/result slots through D1 persistence and graph readback", { timeout: 60000 }, async (t) => {
  let chrome;
  for (const candidate of [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean)) {
    try { await access(candidate, constants.X_OK); chrome = candidate; break; } catch {}
  }
  if (!chrome) {
    assert.ok(!process.env.CI && process.env.LIVE_BROWSER_REQUIRED !== "1", "Set CHROME_BIN: the real-browser persistence proof is required");
    return t.skip("Set CHROME_BIN to run the real-browser persistence proof");
  }
  const directory = await mkdtemp(join(tmpdir(), "idol-live-pack-"));
  const path = join(directory, "live.sqlite");
  let database = new DatabaseSync(path);
  let server;
  t.after(async () => {
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  for (const migration of (await readdir(new URL("../migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort()) {
    database.exec(await read(`migrations/${migration}`));
  }
  const env = { PLATFORM_DB: d1(database) };
  const dependencies = { verifyAccess: async () => identity };
  const route = (pathname, body) => handleLiveTransport(new Request(`https://live.idol.id${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: "https://live.idol.id", "x-idol-request": "browser", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env, pathname, { surface: "live" }, dependencies);
  const create = async (pathname, body) => {
    const response = await route(pathname, body);
    assert.equal(response.status, 201, await response.clone().text());
    return response.json();
  };
  assert.equal((await route("/v1/live/browser/session")).status, 200);
  const project = await create("/v1/live/browser/projects", { name: "Pack proof", slug: "pack-proof", summary: "Preserve exact slots", visibility: "private" });
  const prefix = `/v1/live/browser/projects/${project.id}`;
  const a = await create(`${prefix}/nodes`, { category: "task", label: "α / first", summary: "First exact node" });
  const b = await create(`${prefix}/nodes`, { category: "task", label: "β / second", summary: "Second exact node" });
  const cases = [
    { relation: "repeated operands", subject: a.id, target: b.id, operands: ` ${a.id} , ${a.id} `, results: `${a.id},${b.id},${a.id}`, worlds: "world_a,world_a", witnesses: "witness_a,witness_a" },
    { relation: "repeated results", subject: b.id, target: a.id, operands: `${a.id},${b.id},${a.id}`, results: `${a.id},${a.id}`, worlds: "world_a", witnesses: "witness_a" },
  ];
  const expected = [
    { operands: [a.id, a.id], results: [a.id, b.id, a.id] },
    { operands: [a.id, b.id, a.id], results: [a.id, a.id] },
  ];
  cases.push({ relation: "missing operand", subject: a.id, target: b.id, operands: `${a.id},,${b.id}`, results: "", worlds: "", witnesses: "", error: "INVALID_LIVE_INPUT" });
  const requests = [];
  const html = (await read("apps/live/index.html")).replace("</body>", `<script>(${browserForms.toString()})(${JSON.stringify(cases)});</script></body>`);
  let origin;
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, origin).pathname;
      if (pathname.startsWith("/v1/live/browser/")) {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const headers = new Headers(request.headers);
        if (body.length) {
          assert.equal(headers.get("origin"), origin);
          assert.equal(headers.get("x-idol-request"), "browser");
          headers.set("origin", "https://live.idol.id");
        }
        if (pathname.endsWith("/applications") && request.method === "POST") requests.push(JSON.parse(body));
        const result = await handleLiveTransport(new Request(`https://live.idol.id${pathname}`, {
          method: request.method, headers, ...(body.length ? { body } : {}),
        }), env, pathname, { surface: "live" }, dependencies);
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      if (pathname === "/apps/live/index.html") { response.setHeader("content-type", "text/html"); response.end(html); return; }
      if (pathname === "/config.js") { response.setHeader("content-type", "application/javascript"); response.end("window.IDOL={app:'live',surface:'live'};"); return; }
      if (/^\/shared\/[a-z.-]+\.(js|css)$/.test(pathname)) {
        response.setHeader("content-type", pathname.endsWith(".js") ? "application/javascript" : "text/css");
        response.end(await read(pathname.slice(1)));
        return;
      }
      response.writeHead(404); response.end();
    } catch (error) {
      response.writeHead(500); response.end(error.message);
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const { stdout } = await execute(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", `--user-data-dir=${join(directory, "chrome")}`, "--dump-dom", "--virtual-time-budget=15000", `${origin}/apps/live/index.html?project=${project.id}`], { timeout: 30000, killSignal: "SIGKILL", maxBuffer: 2 * 1024 * 1024 });
  assert.match(stdout, /<output id="live-pack-proof">complete<\/output>/);
  assert.equal(requests.length, 3);
  assert.deepEqual(requests[2].operands, [a.id, "", b.id]);
  for (let index = 0; index < expected.length; index += 1) {
    assert.deepEqual(requests[index].operands, expected[index].operands);
    assert.deepEqual(requests[index].results, expected[index].results);
    assert.equal(requests[index].relation, cases[index].relation);
    assert.deepEqual(requests[index].worlds, ["world_a"]);
    assert.deepEqual(requests[index].witnesses, ["witness_a"]);
  }
  const before = database.prepare("SELECT (SELECT COUNT(*) FROM live_application) AS applications, (SELECT COUNT(*) FROM platform_audit) AS audits").get();
  for (const field of ["worlds", "witnesses"]) {
    const response = await route(`${prefix}/applications`, { ...requests[0], [field]: ["repeated", "repeated"] });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error, "LIVE_DUPLICATE_REFERENCE");
  }
  assert.deepEqual(database.prepare("SELECT (SELECT COUNT(*) FROM live_application) AS applications, (SELECT COUNT(*) FROM platform_audit) AS audits").get(), before);
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();
  database = new DatabaseSync(path, { readOnly: true });
  const stored = database.prepare("SELECT document FROM live_application ORDER BY rowid").all().map((row) => JSON.parse(row.document));
  const graph = await createLiveService({ store: createD1LiveStore(d1(database)) }).graph(identity, project.id);
  assert.equal(stored.length, expected.length);
  for (let index = 0; index < stored.length; index += 1) {
    const application = stored[index];
    assert.deepEqual(application.operands, expected[index].operands);
    assert.deepEqual(application.results, expected[index].results);
    assert.equal(application.relation, cases[index].relation);
    assert.equal(application.semantic_id, null);
    assert.equal(application.identity_status, "not-published");
    assert.deepEqual(graph.applications.find((entry) => entry.id === application.id), application);
    for (const [field, role] of [["operands", "operand"], ["results", "result"]]) {
      const edges = graph.edges.filter((edge) => edge.application_id === application.id && edge.role === role);
      assert.deepEqual(edges.map((edge) => edge.target), expected[index][field]);
      assert.deepEqual(edges.map((edge) => edge.id), expected[index][field].map((_, slot) => `${application.id}:${role}:${slot}`));
    }
  }
  for (const node of [a, b]) assert.equal(graph.nodes.find((entry) => entry.id === node.id).label, node.label);
  assert.equal(graph.boundary.semantic_identity_minting, false);
});
