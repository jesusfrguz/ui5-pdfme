const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const loadUi5Module = require("./loadUi5Module.cjs");

const root = path.resolve(__dirname, "../..");

test("UI5 protects field identifiers for default and custom pdfme plugins", async () => {
  var generatedTemplate;
  var generatedInputs;
  var renderedValues = [];
  const basePlugin = {
    pdf: function (args) { renderedValues.push(args.value); },
    propPanel: {
      schema: { customValue: { type: "string" } },
      defaultSchema: { name: "field", type: "field" }
    }
  };
  const textPlugin = {
    ...basePlugin,
    ui: function (args) { renderedValues.push(args.value); },
    propPanel: {
      ...basePlugin.propPanel,
      defaultSchema: { name: "text", type: "text" }
    }
  };
  const schemas = {
    text: textPlugin, multiVariableText: basePlugin, table: basePlugin, list: basePlugin,
    image: basePlugin, signature: basePlugin, svg: basePlugin, line: basePlugin,
    rectangle: basePlugin, ellipse: basePlugin, date: basePlugin, dateTime: basePlugin,
    time: basePlugin, select: basePlugin, radioGroup: basePlugin, checkbox: basePlugin,
    circleMark: basePlugin,
    barcodes: {
      qrcode: basePlugin, code128: basePlugin, ean13: basePlugin,
      gs1datamatrix: basePlugin, pdf417: basePlugin
    }
  };
  const customPlugin = {
    propPanel: {
      schema: () => ({ anotherValue: { type: "number" } }),
      defaultSchema: { name: "custom", type: "custom" }
    }
  };
  const PdfEngine = loadUi5Module(path.join(root, "src/ui5/pdfme/pdf/PdfEngine.js"), {
    "@pdfme/ui": { Designer: function () {} },
    "@pdfme/generator": { generate: function (options) { generatedTemplate = options.template; generatedInputs = options.inputs; return options.template; } },
    "@pdfme/schemas": schemas,
    "@pdfme/common": {
      checkTemplate: function () {},
      getB64BasePdf: function (data) { return Promise.resolve(data); }
    }
  });
  const plugins = new PdfEngine({
    plugins: { Custom: customPlugin },
    isDataBound: function (schema) { return schema && schema.readOnly === false; },
    isUniqueName: function (name) { return name !== "duplicate"; },
    getDataFieldOptions: function () {
      return [
        { value: "customer", label: "customer — order.customer" },
        { value: "total", label: "total — totals.total" }
      ];
    }
  }).getPlugins();
  const props = { i18n: (key) => key, activeSchema: { id: "one", name: "note", readOnly: true, fixedPosition: true }, schemas: [], basePdf: { width: 210, height: 297, padding: [0, 0, 20, 0] } };

  assert.equal(plugins.Text.propPanel.schema(props).name.disabled, false);
  assert.equal(plugins.Text.propPanel.schema(props).customValue.type, "string");
  assert.equal(plugins.Text.propPanel.defaultSchema.readOnly, true);
  assert.equal(plugins.Text.propPanel.schema(props).fixedPosition.hidden, false);
  assert.equal(plugins.Text.propPanel.schema(props).fixedPosition.props.title, "fixedPositionHelp");
  assert.equal(plugins.Text.propPanel.schema(props).repeatOnEveryPage.hidden, false);
  assert.equal(plugins.Text.propPanel.schema(props).repeatOnEveryPage.props.title, "repeatOnEveryPageHelp");
  assert.equal(plugins.Text.propPanel.schema(props).showLabelControl.widget, "FieldLabelToggle");
  assert.equal(plugins.Text.propPanel.schema(props).label.hidden, true);
  assert.equal(plugins.Text.propPanel.schema({ ...props, activeSchema: { name: "subtotal", type: "text", readOnly: false, showLabel: true, label: "Subtotal" } }).label.hidden, false);
  assert.equal(plugins.Custom.propPanel.schema(props).name.disabled, false);
  assert.equal(plugins.Custom.propPanel.schema(props).anotherValue.type, "number");
  assert.equal(plugins.Custom.propPanel.schema(props).name.rules[0].validator(null, "duplicate"), false);
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "customer", readOnly: false } }).name.props.classNames.prefix, "pdfme-field-data-icon");
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "customer", readOnly: false } }).name.disabled, false);
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "customer", readOnly: false } }).name.widget, "select");
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "customer", readOnly: false } }).name.props.showSearch, true);
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "customer", readOnly: false } }).name.rules[1].validator(null, "unknown"), false);
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "note", readOnly: true } }).name.props.classNames, undefined);
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "customer", readOnly: false } }).repeatOnEveryPage.hidden, true);
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "customer", type: "text", readOnly: false, fixedPosition: true } }).fixedPosition.hidden, false);
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "customer", type: "text", readOnly: false, fixedPosition: true } }).repeatOnEveryPage.hidden, false);
  assert.equal(plugins.Custom.propPanel.schema({ ...props, activeSchema: { name: "note", readOnly: true } }).repeatOnEveryPage.hidden, true);

  await plugins.Text.pdf({ value: "\u0000ui5-pdfme-fixed:1:2\u0000Hidden" });
  await plugins.Text.pdf({ value: "\u0000ui5-pdfme-fixed:1:1\u0000Visible" });
  await plugins.Text.pdf({ value: "125.50", schema: { type: "text", readOnly: false, showLabel: true, label: "Subtotal" } });
  await plugins.Text.ui({ value: "125.50", schema: { type: "text", readOnly: false, showLabel: true, label: "Subtotal" }, mode: "designer" });
  assert.deepEqual(renderedValues, ["Visible", "Subtotal: 125.50", "Subtotal: 125.50"]);

  const template = {
    basePdf: { width: 210, height: 297, padding: [10, 10, 25, 10] },
    schemas: [[
      { name: "body", type: "field", position: { x: 10, y: 20 }, width: 100, height: 10 },
      { name: "company", type: "text", position: { x: 120, y: 15 }, width: 80, height: 10, content: "Company", readOnly: false, fixedPosition: true, repeatOnEveryPage: true },
      { name: "footer", type: "field", position: { x: 10, y: 275 }, width: 190, height: 8, content: "Page {currentPage}", readOnly: true, fixedPosition: true, repeatOnEveryPage: true }
    ]]
  };
  const engine = new PdfEngine();
  const importedTemplate = await PdfEngine.createTemplateFromPdf("data:application/pdf;base64,JVBERi0=");
  assert.equal(importedTemplate.basePdf, "data:application/pdf;base64,JVBERi0=");
  assert.equal(importedTemplate.schemas.length, 1);
  assert.equal(importedTemplate.schemas[0].length, 0);
  engine.generate(template, [{ company: "Fiori Labs" }]);

  assert.equal(generatedTemplate.schemas[0].map((schema) => schema.name).join(","), "body");
  assert.deepEqual(generatedTemplate.basePdf.padding, [25, 10, 25, 10]);
  assert.equal(generatedTemplate.basePdf.staticSchema.map((schema) => schema.name).join(","), "company,footer");
  assert.equal(generatedInputs[0].__ui5PdfmeFixed_0_1, "Fiori Labs");
  assert.equal(template.schemas[0].length, 3);
});
