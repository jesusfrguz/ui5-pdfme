const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const loadUi5Module = require("./loadUi5Module.cjs");

const root = path.resolve(__dirname, "../..");
const objectPath = loadUi5Module(path.join(root, "src/ui5/pdfme/util/ObjectPath.js"));
const MappingEngine = loadUi5Module(
  path.join(root, "src/ui5/pdfme/data/MappingEngine.js"),
  { "../util/ObjectPath": objectPath }
);

test("ObjectPath resolves aliases, arrays and missing defaults", () => {
  const data = { order: { items: [{ name: "A" }] }, $item: { id: 7 } };
  assert.equal(objectPath.get(data, "order.items[0].name"), "A");
  assert.equal(objectPath.get(data, "$item.id"), 7);
  assert.equal(objectPath.get(data, "order.unknown", "fallback"), "fallback");
});

test("ObjectPath exposes arrays and representative nested fields", () => {
  const fields = objectPath.flatten({ order: { items: [{ product: "A", quantity: 2 }] } });
  const paths = fields.map((field) => field.path);
  assert.ok(paths.includes("order.items"));
  assert.ok(paths.includes("order.items[0].product"));
});

test("MappingEngine combines sources without evaluating arbitrary code", () => {
  const engine = new MappingEngine();
  const data = {
    order: {
      id: "42",
      customer: { name: "ACME" },
      items: [{ description: "Service", quantity: 2 }]
    },
    brand: { name: "Fiori Labs" }
  };
  const input = engine.map(data, {
    customer: "order.customer.name",
    heading: { template: "Order {order.id} · {brand.name}" },
    items: {
      path: "order.items",
      formatter: "table",
      options: { columns: ["description", "quantity"] }
    }
  });
  assert.deepEqual(JSON.parse(input.items), [["Service", "2"]]);
  assert.equal(input.customer, "ACME");
  assert.equal(input.heading, "Order 42 · Fiori Labs");
});

test("MappingEngine creates one input per repeated record", () => {
  const engine = new MappingEngine();
  const inputs = engine.mapInputs(
    { orders: [{ id: 1 }, { id: 2 }], brand: { name: "X" } },
    { repeat: "orders", fields: { id: "$item.id", label: { template: "{brand.name}-{\$item.id}" } } }
  );
  assert.deepEqual(inputs.map((input) => input.id), ["1", "2"]);
  assert.deepEqual(inputs.map((input) => input.label), ["X-1", "X-2"]);
});
