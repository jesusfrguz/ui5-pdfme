const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const loadUi5Module = require("./loadUi5Module.cjs");

const root = path.resolve(__dirname, "../..");
const Registry = loadUi5Module(path.join(root, "src/ui5/pdfme/data/DataProviderRegistry.js"));
const Resolver = loadUi5Module(path.join(root, "src/ui5/pdfme/data/DataResolver.js"), {
  "./DataProviderRegistry": Registry,
  "./providers/JsonProvider": {},
  "./providers/RestProvider": {},
  "./providers/FunctionProvider": {},
  "./providers/Ui5ModelProvider": {}
});

test("DataResolver combines independent and dependent sources", async () => {
  const registry = new Registry();
  registry.register("value", (source) => source.value);
  registry.register("derived", (source, context) => context.data[source.dependsOn[0]] * source.factor);
  const resolver = new Resolver(registry);
  const result = await resolver.resolve([
    { id: "base", type: "value", value: 21 },
    { id: "label", type: "value", value: "answer" },
    { id: "total", type: "derived", dependsOn: ["base"], factor: 2 }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { base: 21, label: "answer", total: 42 });
});

test("DataResolver applies fallback only to optional sources", async () => {
  const registry = new Registry().register("failure", () => { throw new Error("offline"); });
  const resolver = new Resolver(registry);
  const result = await resolver.resolve([
    { id: "optional", type: "failure", optional: true, defaultValue: { available: false } }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { optional: { available: false } });
});

test("DataResolver detects circular dependencies", async () => {
  const registry = new Registry().register("value", (source) => source.value);
  const resolver = new Resolver(registry);
  await assert.rejects(() => resolver.resolve([
    { id: "a", type: "value", dependsOn: ["b"] },
    { id: "b", type: "value", dependsOn: ["a"] }
  ]), /Circular or missing/);
});
