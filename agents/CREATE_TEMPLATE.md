# Create and maintain templates

## Contract

A template is a pdfme template object. `schemas` contains one array per page; each field has a unique `name`. Mappings target that name. Keep layout and business data separate.

The visual designer lets you rename the identifier of a static field and checks that it is unique across the template. For a field connected to data, the identifier becomes a searchable selector limited to available mapping keys and resolved data paths; arbitrary values are rejected. Selecting another value moves the schema to that known mapping key/path without evaluating expressions.
In the field list, the database icon identifies fields with an explicit, automatic or resolvable implicit data mapping, while the eye identifies static/simple template content. Fixed static fields show a pin; fixed fields with `repeatOnEveryPage: true` show a stacked-pages icon.

The property labelled **Value from data** controls this distinction: unchecked uses the content stored in the template; checked resolves an input through the mapping layer and shows the data selector with its database icon. Fields added from the pdfme palette start as static, while fields inserted from the data panel are connected automatically.

A connected `Text` may also enable **Show label** and set **Label text**. The designer, preview and generated PDF then render the label and resolved value together as `Label: value`, while the mapping remains attached to the same schema `name`. For a static `Text`, **Show label** is displayed as checked and disabled because its template content already is the visible label/text. The optional properties persisted in the schema are `showLabel: true` and `label: "Subtotal"`.

For a static element or data-bound Text field, **Fixed non-moving position** sets `fixedPosition: true`. The editable template keeps the element in `schemas` so it remains selectable; preview and generation materialize it into `basePdf.staticSchema` without mutating the saved template. A connected Text preserves its resolved input value. Its `position` remains absolute and it is drawn only on its original page unless the optional **Repeat on every page** flag also sets `repeatOnEveryPage: true`. During generation, a repeated fixed field automatically extends the nearest top or bottom `basePdf.padding` boundary to its outer edge, preventing tables, lists, expanding text and following totals from overlapping it after a page break. Configured padding remains the minimum and can still reserve additional whitespace. The options remain unavailable for non-Text connected fields and imported PDF backgrounds.

```javascript
export const template = {
  basePdf: { width: 210, height: 297, padding: [12, 12, 25, 12] },
  schemas: [[
    { name: "title", type: "text", position: { x: 20, y: 18 }, width: 90, height: 12, content: "INVOICE", readOnly: true, fontSize: 22 },
    { name: "customer", type: "text", position: { x: 20, y: 42 }, width: 120, height: 10, content: "Acme", showLabel: true, label: "Customer" },
    { name: "items", type: "table", position: { x: 20, y: 70 }, width: 170, height: 55, content: "[]", head: ["Item", "Qty", "Price"] },
    { name: "footer", type: "text", position: { x: 20, y: 275 }, width: 170, height: 8, content: "Page {currentPage} of {totalPages}", readOnly: true, fixedPosition: true, repeatOnEveryPage: true, alignment: "center" }
  ]]
};
```

`{currentPage}` and `{totalPages}` are resolved for repeated static text during generation.

## Agent workflow

1. List document sections, required fields, table columns, locales, page size and branding.
2. Give every field a semantic, stable name. Never use translated display text as the key.
3. Create a minimal valid template or load an existing version.
   In the visual catalog, choose **Blank template** for pdfme's blank A4 base or **Load PDF** to use every page of a local PDF as the background.
4. Define `mapping.fields` separately and provide representative data.
5. Open the visual designer for final positioning and styling.
6. Generate a PDF and inspect long strings, empty values, large tables, page breaks and locale formats.
7. Save `{ template, mapping, version, metadata }` through a configured [template repository](TEMPLATE_REPOSITORIES.md).

## Dynamic tables

Map table rows to a JSON matrix:

```javascript
items: {
  path: "order.items",
  formatter: "table",
  options: { columns: ["description", "quantity", "price"] }
}
```

## Multi-variable text

Write placeholders in the schema text using either a complete data path or a configured mapping alias. The studio creates the JSON input required by pdfme automatically:

```javascript
// Both forms are supported:
"Subtotal: {totals.subtotal}"
"Subtotal: {subtotal}" // when mapping.fields.subtotal targets totals.subtotal
```

For one document per record, set `mapping.repeat` and address the current record through `$item`.

## Versioning

Do not overwrite published templates blindly. Store an immutable version identifier, author, timestamp, status and compatible data-contract version. Validate the template server-side before publishing it.
