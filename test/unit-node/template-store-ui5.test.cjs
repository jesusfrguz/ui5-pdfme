const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const loadUi5Module = require("./loadUi5Module.cjs");

const root = path.resolve(__dirname, "../..");
const TemplateStore = loadUi5Module(path.join(root, "src/ui5/pdfme/template/TemplateStore.js"));
const ExampleTemplateSeeder = loadUi5Module(path.join(root, "test/ui5/pdfme/demokit/model/ExampleTemplateSeeder.js"));
const template = { basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] }, schemas: [[]] };

test("UI5 TemplateStore lists, filters, saves and gets templates", async () => {
  const store = new TemplateStore({ id: "memory", type: "memory", records: [{ id: "one", name: "Invoice", status: "published", tags: ["sales"], template }] });
  assert.equal((await store.list({ search: "sales" })).length, 1);
  const saved = await store.save({ name: "Receipt", template });
  assert.ok(saved.id);
  assert.equal((await store.get(saved.id)).name, "Receipt");
});

test("UI5 demo migrates older high-version examples by bundled revision", () => {
  const key = "ui5-pdfme.demo.templates";
  const values = new Map([[key, JSON.stringify([
    { id: "invoice-demo", name: "Old invoice", version: "9", template: { basePdf: { padding: [40, 12, 40, 12] }, schemas: [[]] } },
    { id: "purchase-order-demo", name: "Old purchase order", version: "12", template: { basePdf: { padding: [12, 12, 25, 12] }, schemas: [[]] } },
    { id: "user-template", name: "User template", version: "20", template }
  ])]]);
  const storage = {
    getItem: (name) => values.get(name) || null,
    setItem: (name, value) => values.set(name, value)
  };
  const corrected = [
    {
      id: "invoice-demo",
      name: "Invoice demo",
      version: "7",
      metadata: { exampleRevision: 1 },
      template: { basePdf: { padding: [12, 12, 12, 12] }, schemas: [[]] }
    },
    {
      id: "purchase-order-demo",
      name: "Purchase order demo",
      version: "2",
      metadata: { exampleRevision: 1 },
      template: { basePdf: { padding: [12, 12, 12, 12] }, schemas: [[]] }
    }
  ];

  const seeded = ExampleTemplateSeeder.seed(storage, key, corrected);

  assert.equal(seeded.find(({ id }) => id === "invoice-demo").version, "10");
  assert.deepEqual(seeded.find(({ id }) => id === "invoice-demo").template.basePdf.padding, [12, 12, 12, 12]);
  assert.equal(seeded.find(({ id }) => id === "purchase-order-demo").version, "13");
  assert.deepEqual(seeded.find(({ id }) => id === "purchase-order-demo").template.basePdf.padding, [12, 12, 12, 12]);
  assert.equal(seeded.find(({ id }) => id === "user-template").version, "20");
});
