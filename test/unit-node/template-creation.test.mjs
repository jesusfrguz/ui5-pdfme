import test from "node:test";
import assert from "node:assert/strict";
import { createBlankTemplate, createTemplateFromPdf } from "../../src-web/studio.mjs";

test("web template creation supports blank pages and imported PDF backgrounds", async () => {
  const blank = createBlankTemplate();
  assert.deepEqual(blank, {
    basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
    schemas: [[]]
  });

  const pdfBytes = new TextEncoder().encode("%PDF-1.7\n%%EOF");
  const imported = await createTemplateFromPdf(pdfBytes);
  assert.match(imported.basePdf, /^data:application\/pdf;base64,/);
  assert.deepEqual(imported.schemas, [[]]);

  await assert.rejects(createTemplateFromPdf(new TextEncoder().encode("not a pdf")), /PDF file/);
});

test("an imported multi-page PDF remains a valid multi-page generated document", async () => {
  const [{ PDFDocument }, { generate }] = await Promise.all([
    import("@pdfme/pdf-lib"),
    import("@pdfme/generator")
  ]);
  const source = await PDFDocument.create();
  source.addPage([595, 842]).drawText("Imported page 1", { x: 36, y: 800 });
  source.addPage([420, 595]).drawText("Imported page 2", { x: 36, y: 550 });
  const template = await createTemplateFromPdf(await source.save());

  const output = await generate({ template, inputs: [{}], plugins: {} });
  const generated = await PDFDocument.load(output);
  assert.equal(generated.getPageCount(), 2);
  assert.equal(Buffer.from(output).subarray(0, 5).toString("ascii"), "%PDF-");
});
