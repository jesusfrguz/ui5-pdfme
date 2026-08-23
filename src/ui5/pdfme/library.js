sap.ui.define([
  "sap/ui/core/Core",
  "sap/ui/core/library",
  "sap/m/library",
  "sap/ui/layout/library"
], function (Core) {
  "use strict";

  // Some ESM bundlers preserve structuredClone as an exported function and
  // later invoke it through a module namespace. Chromium requires the native
  // function to be bound to the global object in that situation.
  if (typeof globalThis.structuredClone === "function" && !globalThis.structuredClone.__ui5PdfmeBound) {
    var clone = globalThis.structuredClone.bind(globalThis);
    Object.defineProperty(clone, "__ui5PdfmeBound", { value: true });
    globalThis.structuredClone = clone;
  }

  return Core.initLibrary({
    name: "ui5.pdfme",
    version: "${version}",
    dependencies: ["sap.ui.core", "sap.m", "sap.ui.layout"],
    controls: ["ui5.pdfme.PdfTemplateStudio"],
    elements: [],
    noLibraryCSS: false
  });
});
