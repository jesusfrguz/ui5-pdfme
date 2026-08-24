import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { resolveHelpUrl } from "../../src-web/studio.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("help URLs use the matching official guide and allow host overrides", () => {
  assert.equal(resolveHelpUrl("es"), "https://jesusfrguz.github.io/ui5-pdfme/guide/");
  assert.equal(resolveHelpUrl("en"), "https://jesusfrguz.github.io/ui5-pdfme/guide/en.html");
  assert.equal(resolveHelpUrl("es", "/help/pdf-templates"), "/help/pdf-templates");
});

test("web and UI5 adapters expose the same help surface", async () => {
  const [web, react, ui5, spanishBundle] = await Promise.all([
    readFile(resolve(root, "src-web/studio.mjs"), "utf8"),
    readFile(resolve(root, "src-web/react.mjs"), "utf8"),
    readFile(resolve(root, "src/ui5/pdfme/PdfTemplateStudio.js"), "utf8"),
    readFile(resolve(root, "src/ui5/pdfme/i18n/i18n_es.properties"), "utf8")
  ]);

  assert.match(web, /data-action="openHelp"/);
  assert.match(web, /emit\("help", \{ url \}\)/);
  assert.match(react, /props\.showHelp, props\.helpUrl/);
  assert.match(ui5, /showHelp: \{ type: "boolean", defaultValue: true \}/);
  assert.match(ui5, /PdfTemplateStudio\.prototype\.openHelp/);
  assert.match(ui5, /help: \{ parameters: \{ url:/);
  assert.match(spanishBundle, /^helpTitle=Guía rápida de uso$/m);
  assert.match(spanishBundle, /^openGuide=Abrir la guía de uso completa$/m);
  assert.match(spanishBundle, /^helpStep2=.*QR\/código/m);
  assert.match(spanishBundle, /^helpStep3=.*repetirse en todas las páginas/m);
});

test("the bilingual user guide covers the complete functional workflow", async () => {
  const [spanish, english] = await Promise.all([
    readFile(resolve(root, "docs/guide/index.html"), "utf8"),
    readFile(resolve(root, "docs/guide/en.html"), "utf8")
  ]);

  for (const section of ["screen", "first-document", "fields", "templates", "validate", "troubleshooting", "glossary"]) {
    assert.match(spanish, new RegExp(`id="${section}"`));
    assert.match(english, new RegExp(`id="${section}"`));
  }
  assert.match(spanish, /hreflang="en" href="en\.html"/);
  assert.match(english, /hreflang="es" href="index\.html"/);
  assert.match(spanish, /Valor desde datos/);
  assert.match(english, /Value from data/);
  assert.match(spanish, /QR, Code 128, EAN-13, Data Matrix o PDF417/);
  assert.match(english, /QR, Code 128, EAN-13, Data Matrix, or PDF417/);
  assert.match(spanish, /fondos PDF importados/);
  assert.match(english, /imported PDF backgrounds/);
});
