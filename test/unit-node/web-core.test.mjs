import test from "node:test";
import assert from "node:assert/strict";
import { DataResolver, MappingEngine, createDefaultRegistry, flattenData, prepareInputsForGeneration, prepareTemplateForGeneration } from "../../src-web/core.mjs";

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

test("web mapping creates the JSON input expected by multi-variable text", () => {
  const mapper = new MappingEngine();
  const input = mapper.map({ totals: { subtotal: 125.5 } }, {
    summary: {
      variables: {
        "totals.subtotal": "totals.subtotal",
        subtotal: "totals.subtotal"
      }
    }
  });

  assert.deepEqual(JSON.parse(input.summary), {
    "totals.subtotal": "125.5",
    subtotal: "125.5"
  });
});

test("fixed static fields are materialized without mutating the editable template", () => {
  const template = {
    basePdf: {
      width: 210,
      height: 297,
      padding: [12, 12, 10, 12],
      staticSchema: [{ name: "watermark", type: "text", position: { x: 10, y: 100 }, width: 190, height: 10, content: "Draft", readOnly: true }]
    },
    schemas: [[
      { name: "items", type: "table", position: { x: 15, y: 40 }, width: 180, height: 80 },
      { name: "header", type: "text", position: { x: 15, y: 10 }, width: 180, height: 8, content: "First page", readOnly: true, fixedPosition: true },
      { name: "footer", type: "text", position: { x: 15, y: 270 }, width: 180, height: 8, content: "Page {currentPage} of {totalPages}", readOnly: true, required: true, fixedPosition: true, repeatOnEveryPage: true },
      { name: "mapped", type: "text", position: { x: 15, y: 20 }, width: 80, height: 8, content: "Sample", readOnly: false, fixedPosition: true, repeatOnEveryPage: true }
    ]]
  };

  const prepared = prepareTemplateForGeneration(template);
  const input = { mapped: "Resolved value" };
  const preparedInputs = prepareInputsForGeneration(prepared, [input]);

  assert.notEqual(prepared, template);
  assert.deepEqual(prepared.schemas[0].map(({ name }) => name), ["items"]);
  assert.deepEqual(prepared.basePdf.padding, [28, 12, 27, 12]);
  assert.deepEqual(prepared.basePdf.staticSchema.map(({ name }) => name), ["watermark", "header", "footer", "mapped"]);
  assert.match(prepared.basePdf.staticSchema[1].content, /^\u0000ui5-pdfme-fixed:1:\{currentPage\}\u0000First page$/);
  assert.equal(prepared.basePdf.staticSchema[2].content, "Page {currentPage} of {totalPages}");
  assert.equal(prepared.basePdf.staticSchema[2].required, false);
  assert.equal(prepared.basePdf.staticSchema[3].readOnly, true);
  assert.match(prepared.basePdf.staticSchema[3].content, /^\{__ui5PdfmeFixed_0_3\}$/);
  assert.equal(preparedInputs[0].__ui5PdfmeFixed_0_3, "Resolved value");
  assert.deepEqual(input, { mapped: "Resolved value" });
  assert.equal(template.schemas[0].length, 4);
  assert.equal(template.basePdf.staticSchema.length, 1);
  assert.deepEqual(template.basePdf.padding, [12, 12, 10, 12]);
});

test("fixed materialization is ignored for imported PDFs and templates without enabled fields", () => {
  const imported = { basePdf: "data:application/pdf;base64,AA==", schemas: [[{ name: "footer", readOnly: true, fixedPosition: true, repeatOnEveryPage: true }]] };
  const unchanged = { basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] }, schemas: [[{ name: "footer", readOnly: true, repeatOnEveryPage: true }]] };

  assert.equal(prepareTemplateForGeneration(imported), imported);
  assert.equal(prepareTemplateForGeneration(unchanged), unchanged);
});
