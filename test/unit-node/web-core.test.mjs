import test from "node:test";
import assert from "node:assert/strict";
import { DataResolver, MappingEngine, createDefaultRegistry, flattenData } from "../../src-web/core.mjs";

test("web core resolves multiple dependent sources", async () => {
  const resolver = new DataResolver(createDefaultRegistry());
  const data = await resolver.resolve([
    { id: "order", type: "json", data: { items: [{ amount: 10 }, { amount: 15 }] } },
    { id: "brand", type: "json", data: { name: "Fiori Labs" } },
    { id: "totals", type: "function", loader: "sum", dependsOn: ["order"] }
  ], {
    loaders: { sum: (_source, context) => ({ total: context.data.order.items.reduce((sum, item) => sum + item.amount, 0) }) }
  });
  assert.deepEqual(data.totals, { total: 25 });
  assert.equal(data.brand.name, "Fiori Labs");
});

test("web core normalizes OData V2 and V4 payloads", async () => {
  const resolver = new DataResolver();
  const fetch = async (url) => ({
    ok: true,
    json: async () => String(url).includes("v2") ? { d: { results: [{ ID: "1" }] } } : { value: [{ ID: "2" }] }
  });
  const data = await resolver.resolve([
    { id: "v2", type: "odata", url: "https://example.test/v2" },
    { id: "v4", type: "odata", url: "https://example.test/v4", query: { $top: 1 } }
  ], { fetch });
  assert.deepEqual(data.v2, [{ ID: "1" }]);
  assert.deepEqual(data.v4, [{ ID: "2" }]);
});

test("web mapping supports templates, tables and repeat", () => {
  const mapper = new MappingEngine();
  const data = { brand: { name: "Lab" }, orders: [{ id: "A", rows: [{ name: "One", qty: 2 }] }] };
  const inputs = mapper.mapInputs(data, {
    repeat: "orders",
    fields: {
      title: { template: "{brand.name}-{\$item.id}" },
      rows: { path: "$item.rows", formatter: "table", options: { columns: ["name", "qty"] } }
    }
  });
  assert.equal(inputs[0].title, "Lab-A");
  assert.equal(inputs[0].rows, '[["One","2"]]');
  assert.ok(flattenData(data).some(({ path }) => path === "orders[0].rows"));
});
