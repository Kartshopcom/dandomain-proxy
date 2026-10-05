const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { createProductChecker } = require("../product-check");

const response = data => ({ ok: true, json: async () => data });

test("present, blank and null descriptions are distinct from invalid responses", async () => {
  for (const [data, expected] of [
    [{ descriptions: { description: " Text " } }, true],
    [{ descriptions: { description: "  " } }, false],
    [{ descriptions: { description: null } }, false],
    [{ descriptions: null }, false],
    [{ error: "Unavailable" }, null],
    [{ error: "Unavailable", descriptions: null }, null],
    [null, null],
    [[], null],
    [{ descriptions: {} }, null],
    [{ descriptions: { description: 123 } }, null]
  ]) {
    const check = createProductChecker({ fetchImpl: async () => response(data) });
    const result = await check("base", "A", 26);
    assert.equal(result.present, expected);
    assert.equal(result.error, expected === null ? "INVALID_RESPONSE" : null);
  }
});

test("HTTP errors, malformed JSON, network errors and timeouts are unknown", async () => {
  for (const status of [401, 404, 429, 500, 503]) {
    const check = createProductChecker({ fetchImpl: async () => ({
      ok: false, status, json: async () => { throw new Error("must not parse"); }
    }) });
    assert.deepEqual(await check("base", "A", 29), { present: null, error: "HTTP_" + status });
  }
  const malformed = createProductChecker({ fetchImpl: async () => ({
    ok: true, json: async () => { throw new SyntaxError("bad JSON"); }
  }) });
  assert.equal((await malformed("base", "A", 26)).error, "INVALID_RESPONSE");
  const network = createProductChecker({ fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal((await network("base", "A", 26)).error, "NETWORK_ERROR");
  // Stall in body parsing, to verify timeout covers the entire response.
  const timeout = createProductChecker({ timeoutMs: 10, concurrency: 1,
    fetchImpl: async (url, { signal }) => ({
      ok: true,
      json: () => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })
    }) });
  const results = await Promise.all([timeout("base", "A", 26), timeout("base", "B", 29)]);
  assert.ok(results.every(r => r.present === null && r.error === "TIMEOUT"));
});

test("detail limit is shared across pages and includes body parsing", async () => {
  let active = 0, peak = 0, calls = 0;
  const check = createProductChecker({ fetchImpl: async () => {
    active++; calls++; peak = Math.max(peak, active);
    return { ok: true, json: async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return { descriptions: { description: "text" } };
    } };
  } });
  const page = () => Promise.all(Array.from({ length: 100 }, (_, i) =>
    Promise.all([check("base", String(i), 26), check("base", String(i), 29)])));
  await Promise.all([page(), page()]);
  assert.equal(calls, 400);
  assert.equal(peak, 6);
  assert.equal(active, 0);
});

function server(fetchImpl) {
  const routes = {};
  const app = { use() {}, get(route, handler) { routes[route] = handler; }, listen() {} };
  const express = Object.assign(() => app, { json() {}, static() {} });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../server.js"), "utf8"), {
    require: name => name === "express" ? express : require(name === "./product-check" ? "../product-check" : name),
    __dirname: path.join(__dirname, ".."), fetch: fetchImpl, process, console
  });
  return async () => {
    const result = { status: 200 };
    const res = { status(code) { result.status = code; return this; },
      json(data) { result.data = data; return this; } };
    await routes["/produkter"]({ query: { key: "test", page: "1", size: "100" } }, res);
    return result;
  };
}

test("route rejects failed/invalid lists and preserves per-site results", async () => {
  for (const data of [{ error: "bad" }, [null], [{ number: null }]]) {
    const result = await server(async () => response(data))();
    assert.equal(result.status, 502);
    assert.ok(!Array.isArray(result.data));
  }
  assert.equal((await server(async () => ({ ok: false, status: 429 }))()).status, 502);
  const empty = (await server(async () => response([]))()).data;
  assert.ok(Array.isArray(empty));
  assert.equal(empty.length, 0);
  const result = await server(async url => {
    if (url.includes("ProductPage")) return response([{ id: 1, number: "A", name: "Product" }]);
    if (url.endsWith("/26")) return response({ descriptions: { description: "" } });
    return { ok: false, status: 503 };
  })();
  assert.equal(result.status, 200);
  assert.equal(result.data[0].desc26, false);
  assert.equal(result.data[0].desc29, null);
  assert.equal(result.data[0].desc29Error, "HTTP_503");
});

function frontend(fetchImpl) {
  const elements = {};
  const document = { getElementById(id) {
    return elements[id] ||= { textContent: "", innerHTML: "" };
  } };
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const context = vm.createContext({ document, fetch: fetchImpl, Date, console });
  vm.runInContext(script, context);
  return { elements, load: () => vm.runInContext("loadProdukter()", context) };
}

test("frontend counts only confirmed missing descriptions and displays unknown", async () => {
  const ui = frontend(async () => response([
    { id: 1, desc26: true, desc29: true },
    { id: 2, desc26: false, desc29: true },
    { id: 3, desc26: null, desc29: true },
    { id: 4, desc26: false, desc29: null }
  ]));
  await ui.load();
  assert.equal(ui.elements["p-missing"].textContent, 2);
  assert.equal(ui.elements["p-unknown"].textContent, 2);
  assert.equal(ui.elements["p-total"].textContent, 4);
  assert.match(ui.elements["prod-tbody"].innerHTML, /Kunne ikke kontrolleres/);
  assert.doesNotMatch(ui.elements["prod-tbody"].innerHTML, /Alle produkter/);
});

test("frontend never presents a failed later page as a completed check", async () => {
  let calls = 0;
  const ui = frontend(async () => ++calls === 1
    ? response(Array.from({ length: 100 }, () => ({ desc26: true, desc29: true })))
    : { ok: false, status: 502 });
  await ui.load();
  assert.equal(calls, 2);
  assert.equal(ui.elements["p-total"].textContent, "—");
  assert.equal(ui.elements["p-missing"].textContent, "—");
  assert.match(ui.elements["prod-tbody"].innerHTML, /ikke gennemført/);
  assert.doesNotMatch(ui.elements["prod-tbody"].innerHTML, /Alle produkter/);
});

test("frontend rejects invalid lists and suppresses overlapping refreshes", async () => {
  const invalid = frontend(async () => response({ error: "bad" }));
  await invalid.load();
  assert.match(invalid.elements["prod-tbody"].innerHTML, /ikke gennemført/);
  let release, calls = 0;
  const ui = frontend(() => {
    calls++;
    return new Promise(resolve => { release = () => resolve(response([])); });
  });
  const first = ui.load();
  await ui.load();
  assert.equal(calls, 1);
  release();
  await first;
  assert.match(ui.elements["prod-tbody"].innerHTML, /Ingen produkter/);
});
