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
