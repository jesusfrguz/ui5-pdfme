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
