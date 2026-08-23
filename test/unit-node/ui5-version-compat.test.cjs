const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const loadUi5Module = require("./loadUi5Module.cjs");

const root = path.resolve(__dirname, "../..");

test("library initialization uses the Core API shared by UI5 1.71 and 1.120", () => {
  let settings;
  const library = loadUi5Module(path.join(root, "src/ui5/pdfme/library.js"), {
    "sap/ui/core/Core": {
      initLibrary(value) {
        settings = value;
        return value;
      }
    },
    "sap/ui/core/library": {},
    "sap/m/library": {},
    "sap/ui/layout/library": {}
  });

  assert.equal(settings.name, "ui5.pdfme");
  assert.equal(library, settings);
});

test("UI5 sources only use modules available in both supported branches", () => {
  const librarySource = fs.readFileSync(path.join(root, "src/ui5/pdfme/library.js"), "utf8");
  const studioSource = fs.readFileSync(path.join(root, "src/ui5/pdfme/PdfTemplateStudio.js"), "utf8");

  assert.doesNotMatch(librarySource, /sap\/ui\/core\/Lib/);
  assert.match(librarySource, /sap\/ui\/core\/Core/);
  assert.doesNotMatch(studioSource, /sap\/ui\/core\/Lib/);
  assert.match(studioSource, /sap\/base\/i18n\/ResourceBundle/);
});
