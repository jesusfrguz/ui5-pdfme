const test = require("node:test");
const assert = require("node:assert/strict");

test("pdfme creates a final PDF with text and dynamic table data", async () => {
  const [{ generate }, { text, table }] = await Promise.all([
    import("@pdfme/generator"),
    import("@pdfme/schemas")
  ]);
  const template = {
    basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
    schemas: [[
      {
        name: "title",
        type: "text",
        position: { x: 15, y: 15 },
        width: 100,
        height: 12,
        content: "Invoice"
      },
      {
        name: "items",
        type: "table",
        position: { x: 15, y: 40 },
        width: 180,
        height: 40,
        content: "[[\"Example\",\"1\"]]",
        showHead: true,
        head: ["Item", "Quantity"],
        headWidthPercentages: [75, 25],
        tableStyles: { borderWidth: 0.3, borderColor: "#888888" },
        headStyles: {
          alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1,
          characterSpacing: 0, fontColor: "#ffffff", backgroundColor: "#2980ba",
          borderColor: "", borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 5, right: 5, bottom: 5, left: 5 }
        },
        bodyStyles: {
          alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1,
          characterSpacing: 0, fontColor: "#000000", backgroundColor: "",
          alternateBackgroundColor: "#f5f5f5", borderColor: "#888888",
          borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
          padding: { top: 5, right: 5, bottom: 5, left: 5 }
        },
        columnStyles: {}
      }
    ]]
  };
  const bytes = await generate({
    template,
    inputs: [{ title: "Final invoice", items: JSON.stringify([["Service", "2"], ["Support", "1"]]) }],
    plugins: { Text: text, Table: table }
  });
  const header = Buffer.from(bytes).subarray(0, 5).toString("ascii");
  assert.equal(header, "%PDF-");
  assert.ok(bytes.length > 1000);
});

test("pdfme creates a final PDF with a multi-variable JSON input", async () => {
  const [{ generate }, { multiVariableText }, { MappingEngine }] = await Promise.all([
    import("@pdfme/generator"),
    import("@pdfme/schemas"),
    import("../../src-web/core.mjs")
  ]);
  const schema = structuredClone(multiVariableText.propPanel.defaultSchema);
  Object.assign(schema, {
    name: "summary",
    text: "Subtotal: {subtotal}",
    variables: ["subtotal"],
    position: { x: 15, y: 15 },
    width: 100,
    height: 15
  });
  const inputs = [new MappingEngine().map({ totals: { subtotal: 125.5 } }, {
    summary: { variables: { subtotal: "totals.subtotal" } }
  })];
  const bytes = await generate({
    template: {
      basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
      schemas: [[schema]]
    },
    inputs,
    plugins: { MultiVariableText: multiVariableText }
  });

  assert.equal(inputs[0].summary, '{"subtotal":"125.5"}');
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(bytes.length > 1000);
});

test("fixed static and data-bound Text fields render correctly on dynamic pages", async () => {
  const [{ text, table }, { PDFDocument }, { generatePdf }] = await Promise.all([
    import("@pdfme/schemas"),
    import("@pdfme/pdf-lib"),
    import("../../src-web/index.mjs")
  ]);
  const footerRenders = [];
  const trackedFooter = {
    ...text,
    propPanel: {
      ...text.propPanel,
      defaultSchema: { ...text.propPanel.defaultSchema, type: "trackedFooter" }
    },
    pdf: async (args) => {
      footerRenders.push({ value: args.value, y: args.schema.position.y });
      return text.pdf({ ...args, schema: { ...args.schema, type: "text" } });
    }
  };
  const tableSchema = structuredClone(table.propPanel.defaultSchema);
  Object.assign(tableSchema, {
    name: "items",
    position: { x: 15, y: 88 },
    width: 180,
    height: 60
  });
  const template = {
    basePdf: { width: 210, height: 297, padding: [40, 12, 40, 12] },
    schemas: [[
      tableSchema,
      {
        name: "firstPageNote",
        type: "trackedFooter",
        position: { x: 15, y: 15 },
        width: 180,
        height: 8,
        content: "First page only",
        readOnly: true,
        fixedPosition: true,
        fontSize: 8
      },
      {
        name: "mappedHeader",
        type: "trackedFooter",
        position: { x: 120, y: 15 },
        width: 75,
        height: 8,
        content: "Company",
        readOnly: false,
        fixedPosition: true,
        repeatOnEveryPage: true,
        fontSize: 8
      },
      {
        name: "issueDate",
        type: "trackedFooter",
        position: { x: 120, y: 38 },
        width: 75,
        height: 8,
        content: "Date",
        readOnly: false,
        fixedPosition: true,
        repeatOnEveryPage: true,
        fontSize: 8
      },
      {
        name: "subtotal",
        type: "trackedFooter",
        position: { x: 120, y: 168 },
        width: 75,
        height: 8,
        content: "Subtotal"
      },
      {
        name: "tax",
        type: "trackedFooter",
        position: { x: 120, y: 178 },
        width: 75,
        height: 8,
        content: "Tax"
      },
      {
        name: "total",
        type: "trackedFooter",
        position: { x: 120, y: 190 },
        width: 75,
        height: 10,
        content: "Total"
      },
      {
        name: "footer",
        type: "trackedFooter",
        position: { x: 15, y: 275 },
        width: 180,
        height: 8,
        content: "Page {currentPage} of {totalPages}",
        readOnly: true,
        fixedPosition: true,
        repeatOnEveryPage: true,
        fontSize: 8
      }
    ]]
  };
  const rows = Array.from({ length: 90 }, (_, index) => [`Service ${index + 1}`, "1", "Repeated footer QA"]);
  const bytes = await generatePdf({
    template,
    inputs: [{
      items: JSON.stringify(rows),
      mappedHeader: "Fiori Labs",
      issueDate: "24/08/2026",
      subtotal: "1.000,00 €",
      tax: "210,00 €",
      total: "1.210,00 €"
    }],
    plugins: { Table: table, Footer: trackedFooter }
  });
  const pageCount = (await PDFDocument.load(bytes)).getPageCount();
  const footerValues = footerRenders.map(({ value }) => value);

  assert.ok(pageCount > 1);
  assert.equal(footerValues.filter((value) => value === "First page only").length, 1);
  assert.equal(footerValues.filter((value) => value === "Fiori Labs").length, pageCount);
  assert.equal(footerValues.filter((value) => value === "24/08/2026").length, pageCount);
  ["1.000,00 €", "210,00 €", "1.210,00 €"].forEach((value) => {
    const render = footerRenders.find((entry) => entry.value === value);
    assert.ok(render, `${value} should be rendered`);
    assert.ok(render.y >= 46, `${value} should start below the repeated date`);
  });
  const pageValues = footerValues.filter((value) => value.startsWith("Page "));
  assert.equal(pageValues.length, pageCount);
  assert.equal(pageValues[0], `Page 1 of ${pageCount}`);
  assert.equal(pageValues.at(-1), `Page ${pageCount} of ${pageCount}`);
});
