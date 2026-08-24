import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultFieldMappings, createDefaultPlugins, formatFieldValueWithLabel, getDataFieldOptions, isDataBoundField, isUniqueFieldName, resolveStudioTitle, syncFieldListIndicators, withLockedFieldNames } from "../../src-web/studio.mjs";

const panelProps = {
  i18n: (key) => key,
  activeSchema: { id: "field-1", name: "customer", type: "image", readOnly: true, fixedPosition: true },
  schemas: [],
  options: {},
  basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] }
};

test("web palette plugins create static fields with editable unique identifiers", () => {
  const plugins = createDefaultPlugins();
  const schema = plugins.Image.propPanel.schema(panelProps);

  assert.equal(schema.name.title, "fieldName");
  assert.equal(schema.name.disabled, false);
  assert.equal(schema.name.props.title, "fieldIdentifierHelp");
  assert.equal(plugins.Image.propPanel.defaultSchema.readOnly, true);
  assert.equal(schema.editable.hidden, false);
  assert.equal(schema.fixedPosition.title, "fixedPosition");
  assert.equal(schema.fixedPosition.hidden, false);
  assert.equal(schema.fixedPosition.props.title, "fixedPositionHelp");
  assert.equal(schema.repeatOnEveryPage.title, "repeatOnEveryPage");
  assert.equal(schema.repeatOnEveryPage.hidden, false);
  assert.equal(schema.repeatOnEveryPage.props.title, "repeatOnEveryPageHelp");
});

test("Text fields expose an optional editable label only while connected to data", () => {
  const plugins = createDefaultPlugins((schema) => schema?.readOnly !== true);
  const staticPanel = plugins.Text.propPanel.schema({
    ...panelProps,
    activeSchema: { ...panelProps.activeSchema, type: "text", readOnly: true }
  });
  const connectedWithoutLabel = plugins.Text.propPanel.schema({
    ...panelProps,
    activeSchema: { ...panelProps.activeSchema, type: "text", readOnly: false }
  });
  const connectedWithLabel = plugins.Text.propPanel.schema({
    ...panelProps,
    activeSchema: { ...panelProps.activeSchema, type: "text", readOnly: false, showLabel: true, label: "Subtotal" }
  });

  assert.equal(staticPanel.showLabelControl.widget, "FieldLabelToggle");
  assert.equal(staticPanel.label.hidden, true);
  assert.equal(connectedWithoutLabel.label.hidden, true);
  assert.equal(connectedWithLabel.label.hidden, false);
  assert.equal(connectedWithLabel.label.title, "labelText");
  assert.equal(formatFieldValueWithLabel(connectedWithLabel, 125.5), "125.5");
  assert.equal(formatFieldValueWithLabel({ type: "text", readOnly: false, showLabel: true, label: "Subtotal" }, 125.5), "Subtotal: 125.5");
  assert.equal(formatFieldValueWithLabel({ type: "text", readOnly: true, showLabel: true, label: "Subtotal" }, 125.5), "125.5");
  assert.equal(formatFieldValueWithLabel({ type: "text", readOnly: true, showLabel: true, label: "Subtotal", __ui5PdfmeFixedInputAlias: "fixedSubtotal" }, 125.5), "Subtotal: 125.5");
});

test("Text plugin renders labels in the designer and generated PDF", async () => {
  const rendered = [];
  const textPlugin = {
    pdf: (args) => { rendered.push({ target: "pdf", value: args.value, schema: args.schema }); },
    ui: (args) => { rendered.push({ target: "ui", value: args.value, schema: args.schema, mode: args.mode }); },
    propPanel: {
      schema: {},
      defaultSchema: { name: "text", type: "text" }
    }
  };
  const plugin = withLockedFieldNames({ Text: textPlugin }).Text;
  const schema = { name: "subtotal", type: "text", readOnly: false, showLabel: true, label: "Subtotal" };

  await plugin.pdf({ value: "125.50", schema });
  await plugin.ui({ value: "125.50", schema, mode: "designer" });

  assert.deepEqual(rendered.map(({ value }) => value), ["Subtotal: 125.50", "Subtotal: 125.50"]);
  assert.equal(rendered[1].schema.readOnly, false);
  assert.equal(rendered[1].target, "ui");
  assert.equal(rendered[1].mode, "viewer");
  assert.equal(schema.readOnly, false);
});

test("web custom plugins retain their properties and protect duplicate identifiers", () => {
  const custom = {
    Custom: {
      propPanel: {
        schema: () => ({ customValue: { type: "string" }, name: { type: "string" } }),
        defaultSchema: { name: "custom", type: "custom" }
      }
    }
  };
  const schema = withLockedFieldNames(custom, undefined, (name) => name !== "duplicate").Custom.propPanel.schema(panelProps);

  assert.equal(schema.customValue.type, "string");
  assert.equal(schema.name.disabled, false);
  assert.equal(schema.name.rules[0].validator(null, "duplicate"), false);
  assert.equal(schema.name.rules[0].validator(null, "description"), true);
});

test("web field identifiers show a data icon only for mapped fields", () => {
  const plugins = withLockedFieldNames({ Custom: {
    propPanel: { schema: {}, defaultSchema: { name: "custom", type: "custom" } }
  } }, (schema) => schema.name === "customer", undefined, () => [
    { value: "customer", label: "customer — order.customer" },
    { value: "total", label: "total — totals.total" }
  ]);
  const mapped = plugins.Custom.propPanel.schema({ ...panelProps, activeSchema: { ...panelProps.activeSchema, name: "customer", readOnly: false } });
  const mappedText = plugins.Custom.propPanel.schema({ ...panelProps, activeSchema: { ...panelProps.activeSchema, name: "customer", type: "text", readOnly: false } });
  const plain = plugins.Custom.propPanel.schema({ ...panelProps, activeSchema: { ...panelProps.activeSchema, name: "note", readOnly: true } });

  assert.equal(mapped.name.props.classNames.prefix, "pdfme-field-data-icon");
  assert.equal(mapped.name.props.title, "fieldDataBound");
  assert.equal(mapped.name.disabled, false);
  assert.equal(mapped.name.widget, "select");
  assert.equal(mapped.name.props.showSearch, true);
  assert.deepEqual(mapped.name.props.options.map(({ value }) => value), ["customer", "total"]);
  assert.equal(mapped.name.rules[1].validator(null, "unknown"), false);
  assert.equal(plain.name.props.classNames, undefined);
  assert.equal(plain.name.disabled, false);
  assert.equal(plain.name.widget, undefined);
  assert.equal(mapped.repeatOnEveryPage.hidden, true);
  assert.equal(mappedText.fixedPosition.hidden, false);
  assert.equal(mappedText.repeatOnEveryPage.hidden, false);
  assert.equal(plain.repeatOnEveryPage.hidden, false);
  assert.equal(plugins.Custom.propPanel.schema({ ...panelProps, activeSchema: { ...plain, fixedPosition: false } }).repeatOnEveryPage.hidden, true);
});

test("data field choices combine configured, automatic and resolved fields", () => {
  const options = getDataFieldOptions({
    mapping: { fields: { customer: "order.customer", totalLabel: { template: "Total {totals.total}" } } },
    autoMappings: { items: "order.items" },
    resolvedData: { order: { customer: "ACME", items: [{ name: "Service" }] }, totals: { total: 42 } }
  });
  const byValue = Object.fromEntries(options.map((option) => [option.value, option.label]));

  assert.equal(byValue.customer, "customer — order.customer");
  assert.equal(byValue.totalLabel, "totalLabel — totals.total");
  assert.equal(byValue.items, "items — order.items");
  assert.equal(byValue["totals.total"], "totals.total");
  assert.equal(Object.prototype.hasOwnProperty.call(byValue, "unknown"), false);
});

test("multi-variable fields map both full paths and configured aliases", () => {
  const configured = { subtotal: "totals.subtotal" };
  const defaults = createDefaultFieldMappings({ schemas: [[
    { name: "summaryByPath", type: "multiVariableText", text: "Subtotal {totals.subtotal}", readOnly: false },
    { name: "summaryByAlias", type: "multiVariableText", text: "Subtotal {subtotal}", variables: ["subtotal"], readOnly: false }
  ]] }, configured);

  assert.deepEqual(defaults.summaryByPath, { variables: { "totals.subtotal": "totals.subtotal" } });
  assert.deepEqual(defaults.summaryByAlias, { variables: { subtotal: "totals.subtotal" } });
});

test("static field identifiers reject duplicates across pages", () => {
  const template = { schemas: [[{ name: "title" }], [{ name: "footer" }]] };

  assert.equal(isUniqueFieldName(template, "footer", "title"), false);
  assert.equal(isUniqueFieldName(template, "description", "title"), true);
  assert.equal(isUniqueFieldName(template, "title", "title"), true);
  assert.equal(isUniqueFieldName({ schemas: [[{ name: "title" }], [{ name: "title" }]] }, "title", "title"), false);
});

test("value-from-data state identifies connected fields", () => {
  assert.equal(isDataBoundField({ name: "customer" }, { mapping: { fields: { customer: "order.customer" } } }), true);
  assert.equal(isDataBoundField({ name: "items" }, { autoMappings: { items: "order.items" } }), true);
  assert.equal(isDataBoundField({ name: "order.number" }, { resolvedData: { order: { number: "42" } } }), true);
  assert.equal(isDataBoundField({ name: "note" }, { resolvedData: { order: { number: "42" } } }), true);
  assert.equal(isDataBoundField({ name: "order.number", readOnly: true }, { resolvedData: { order: { number: "42" } } }), false);
  assert.equal(isDataBoundField({ name: "summary", type: "multiVariableText", text: "Total {totals.subtotal}", readOnly: false }), true);
});

test("field list distinguishes fixed and repeated static or data-bound Text fields", () => {
  const classes = {};
  const rows = [0, 1, 2].map((index) => ({
    classList: { toggle: (className, active) => { (classes[className] ||= [])[index] = active; } }
  }));
  const count = syncFieldListIndicators({
    querySelectorAll: () => rows
  }, [
    { name: "header", readOnly: true, fixedPosition: true, repeatOnEveryPage: true },
    { name: "note", readOnly: true, fixedPosition: true },
    { name: "customer", type: "text", readOnly: false, fixedPosition: true, repeatOnEveryPage: true }
  ]);

  assert.equal(count, 3);
  assert.deepEqual(classes["pdfme-field-fixed-position"], [true, true, true]);
  assert.deepEqual(classes["pdfme-field-repeat-on-every-page"], [true, false, true]);
});

test("fixed-only plugin rendering is limited to its original page", async () => {
  const values = [];
  const plugin = withLockedFieldNames({ Plain: { pdf: async ({ value }) => { values.push(value); } } }).Plain;

  await plugin.pdf({ value: "\u0000ui5-pdfme-fixed:1:2\u0000Hidden" });
  await plugin.pdf({ value: "\u0000ui5-pdfme-fixed:1:1\u0000Visible" });

  assert.deepEqual(values, ["Visible"]);
});

test("studio title uses the loaded template name before the generic fallback", () => {
  assert.equal(resolveStudioTitle({ record: { name: "Invoice" }, fallback: "Print form designer" }), "Invoice");
  assert.equal(resolveStudioTitle({ title: "Custom title", record: { name: "Invoice" }, fallback: "Print form designer" }), "Custom title");
  assert.equal(resolveStudioTitle({ fallback: "Print form designer" }), "Print form designer");
});
