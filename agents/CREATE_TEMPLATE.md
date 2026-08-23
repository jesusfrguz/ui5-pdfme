# Create and maintain templates

## Contract

A template is a pdfme template object. `schemas` contains one array per page; each field has a unique `name`. Mappings target that name. Keep layout and business data separate.

```javascript
export const template = {
  basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
  schemas: [[
    { name: "title", type: "text", position: { x: 20, y: 18 }, width: 90, height: 12, content: "INVOICE", fontSize: 22 },
    { name: "customer", type: "text", position: { x: 20, y: 42 }, width: 120, height: 10, content: "Customer" },
    { name: "items", type: "table", position: { x: 20, y: 70 }, width: 170, height: 55, content: "[]", head: ["Item", "Qty", "Price"] }
  ]]
};
```

## Agent workflow

1. List document sections, required fields, table columns, locales, page size and branding.
2. Give every field a semantic, stable name. Never use translated display text as the key.
3. Create a minimal valid template or load an existing version.
4. Define `mapping.fields` separately and provide representative data.
5. Open the visual designer for final positioning and styling.
6. Generate a PDF and inspect long strings, empty values, large tables, page breaks and locale formats.
7. Save `{ template, mapping, version, metadata }` through the application's persistence layer.

## Dynamic tables

Map table rows to a JSON matrix:

```javascript
items: {
  path: "order.items",
  formatter: "table",
  options: { columns: ["description", "quantity", "price"] }
}
```

For one document per record, set `mapping.repeat` and address the current record through `$item`.

## Versioning

Do not overwrite published templates blindly. Store an immutable version identifier, author, timestamp, status and compatible data-contract version. Validate the template server-side before publishing it.
