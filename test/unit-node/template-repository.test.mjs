import test from "node:test";
import assert from "node:assert/strict";
import { TemplateStore, normalizeTemplateRecord } from "../../src-web/template-repository.mjs";

const template = { basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] }, schemas: [[]] };

test("TemplateStore aggregates, searches and loads memory repositories", async () => {
  const store = new TemplateStore([
    { id: "local", type: "memory", records: [{ id: "invoice", name: "Invoice", tags: ["sales"], status: "published", template }] },
    { id: "shared", type: "memory", records: [{ id: "label", name: "Shipping label", tags: ["logistics"], status: "draft", template }] }
  ]);
  const records = await store.list({ search: "sales", status: "published" });
  assert.equal(records.length, 1);
  assert.equal(records[0].repositoryId, "local");
  assert.equal((await store.get("invoice", { repositoryId: "local" })).name, "Invoice");
});

test("TemplateStore saves and reloads localStorage records", async () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const store = new TemplateStore({ id: "browser", type: "localStorage", storageKey: "templates" }, { context: { storage } });
  const saved = await store.save({ name: "Receipt", template, mapping: { fields: { total: "order.total" } } });
  assert.ok(saved.id);
  assert.equal((await store.list()).length, 1);
  assert.deepEqual((await store.get(saved.id)).mapping, { fields: { total: "order.total" } });
  const updated = await store.save({ ...saved, name: "Receipt v2" });
  assert.equal(updated.version, "2");
});

test("REST repository follows pagination and uses detail endpoints", async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push([String(url), options.method || "GET"]);
    if (String(url).endsWith("/one")) return { ok: true, status: 200, json: async () => ({ id: "one", name: "One", template }) };
    if (String(url).includes("page=2")) return { ok: true, status: 200, json: async () => ({ items: [{ id: "two", name: "Two" }] }) };
    return { ok: true, status: 200, json: async () => ({ items: [{ id: "one", name: "One" }], next: "/templates?page=2" }) };
  };
  const store = new TemplateStore({ id: "api", type: "rest", url: "https://example.test/templates", fetch });
  assert.equal((await store.list()).length, 2);
  assert.equal((await store.get("one")).template.schemas.length, 1);
  assert.ok(calls.some(([url]) => url.includes("page=2")));
});

test("OData records normalize JSON columns", () => {
  const record = normalizeTemplateRecord({ ID: "a", Name: "A", Tags: '["finance"]', TemplateJson: JSON.stringify(template), MappingJson: '{"fields":{}}' }, "odata");
  assert.deepEqual(record.tags, ["finance"]);
  assert.deepEqual(record.template, template);
  assert.deepEqual(record.mapping, { fields: {} });
});

test("OData records normalize dynamic ETags", () => {
  assert.equal(normalizeTemplateRecord({ etag: 'W/"lower"' }).etag, 'W/"lower"');
  assert.equal(normalizeTemplateRecord({ ETag: 'W/"upper"' }).etag, 'W/"upper"');
  assert.equal(normalizeTemplateRecord({ "@odata.etag": 'W/"v4"' }).etag, 'W/"v4"');
  assert.equal(normalizeTemplateRecord({ __metadata: { etag: 'W/"v2"' } }).etag, 'W/"v2"');
});

test("OData records normalize V2 minute offsets and UI5 timestamps to RFC 3339", () => {
  const v2 = normalizeTemplateRecord({ CreatedAt: "/Date(0-0060)/", UpdatedAt: "/Date(1000+0060)/" });
  assert.equal(v2.createdAt, "1969-12-31T23:00:00.000Z");
  assert.equal(v2.updatedAt, "1970-01-01T01:00:01.000Z");
  assert.equal(normalizeTemplateRecord({ CreatedAt: "/Date(0)/" }).createdAt, "1970-01-01T00:00:00.000Z");
  assert.equal(normalizeTemplateRecord({ UpdatedAt: new Date(2000) }).updatedAt, "1970-01-01T00:00:02.000Z");
});

test("HTTP OData V2 uses V2 query syntax and writes an Int32 version", async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if ((options.method || "GET") === "GET") return { ok: true, status: 200, json: async () => ({ d: { results: [] } }) };
    const body = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ d: { ...body, ID: "invoice-es" } }) };
  };
  const store = new TemplateStore({
    id: "gateway", type: "odata", odataVersion: 2, url: "https://example.test/Templates",
    query: { $filter: "Tenant eq 'A' or Public eq true" }, etag: 'W/"source"', headers: { "x-app": "templates" }, fetch
  });

  await store.list({ search: "Tax's", status: "published", top: 20 });
  const query = new URL(calls[0].url).searchParams;
  assert.match(query.get("$filter"), /substringof\('Tax''s',Name\) eq true/);
  assert.match(query.get("$filter"), /^\(Tenant eq 'A' or Public eq true\) and \(/);
  assert.doesNotMatch(query.get("$filter"), /contains\(|tolower\(|toupper\(/);
  assert.equal(query.get("$inlinecount"), "allpages");
  assert.equal(query.has("$count"), false);
  assert.equal(query.get("$select"), "ID,Name,Description,Tags,Status,Version,CreatedAt,UpdatedAt");
  assert.equal(calls[0].options.headers.accept, "application/json");

  await store.save({ id: "invoice-es", name: "Invoice", version: "7", etag: 'W/"record"', createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", template });
  assert.equal(calls[1].options.method, "MERGE");
  assert.equal(calls[1].options.headers["if-match"], 'W/"record"');
  assert.equal(calls[1].options.headers["content-type"], "application/json");
  assert.equal(calls[1].options.headers["x-app"], "templates");
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.Version, 7);
  assert.equal(Object.hasOwn(body, "ID"), false);
  assert.equal(Object.hasOwn(body, "CreatedAt"), false);
  assert.equal(Object.hasOwn(body, "UpdatedAt"), false);
});

test("HTTP OData V4 keeps its case-insensitive contains filter", async () => {
  let requestedUrl;
  const fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, status: 200, json: async () => ({ value: [] }) };
  };
  const store = new TemplateStore({ id: "v4", type: "odata", url: "https://example.test/Templates", fetch });
  await store.list({ search: "Tax's" });
  assert.match(new URL(requestedUrl).searchParams.get("$filter"), /contains\(tolower\(Name\),tolower\('Tax''s'\)\)/);
});

test("HTTP OData update can require an ETag before fetching", async () => {
  let fetchCalls = 0;
  const fetch = async () => { fetchCalls += 1; throw new Error("fetch must not run"); };
  const store = new TemplateStore({ id: "strict", type: "odata", url: "https://example.test/Templates", requireEtag: true, etag: 'W/"static-is-not-enough"', fetch });
  await assert.rejects(
    store.save({ id: "invoice-es", name: "Invoice", version: "7", template }),
    /requires an ETag for OData updates/
  );
  assert.equal(fetchCalls, 0);
});

test("HTTP OData update refreshes the record and dynamic ETag after a 204 response", async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if ((options.method || "GET") === "MERGE") return { ok: true, status: 204, json: async () => { throw new Error("204 has no body"); } };
    return { ok: true, status: 200, json: async () => ({ d: { ID: "invoice-es", Name: "Invoice", Version: 8, TemplateJson: JSON.stringify(template), __metadata: { etag: 'W/"8"' } } }) };
  };
  const store = new TemplateStore({ id: "gateway", type: "odata", odataVersion: 2, url: "https://example.test/Templates", requireEtag: true, fetch });
  const saved = await store.save({ id: "invoice-es", name: "Invoice", version: "7", etag: 'W/"7"', template });
  assert.equal(saved.id, "invoice-es");
  assert.equal(saved.name, "Invoice");
  assert.equal(saved.version, "8");
  assert.equal(saved.etag, 'W/"8"');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers.accept, "application/json");
});

test("HTTP OData rejects versions outside the Int32 contract", async () => {
  const fetch = async () => { throw new Error("fetch must not run"); };
  const store = new TemplateStore({ id: "odata", type: "odata", url: "https://example.test/Templates", fetch });
  await assert.rejects(
    store.save({ id: "invoice-es", name: "Invoice", version: "2147483648", template }),
    /OData Version must be an Int32/
  );
  for (const version of ["1e3", "0x10", " 7 ", "01", "1.5", "0"]) {
    await assert.rejects(store.save({ id: "invoice-es", name: "Invoice", version, template }), /canonical decimal digits/);
  }
});
