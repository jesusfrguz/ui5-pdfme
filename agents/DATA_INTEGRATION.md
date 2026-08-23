# Data integration and mappings

## Source types

```javascript
const dataSources = [
  { id: "static", type: "json", data: { locale: "es-ES" } },
  { id: "order", type: "rest", url: "/api/orders/5001" },
  { id: "customers", type: "odata", url: "/odata/v4/Customers?$top=20" },
  { id: "totals", type: "function", loader: "calculateTotals", dependsOn: ["order"] }
];
```

The web OData provider accepts an HTTP URL and normalizes V2 `{ d: { results } }` and V4 `{ value }` collections. The UI5 OData provider should use the host application's model instead, preserving destinations, batches and authentication.

Sources without dependencies resolve concurrently. `dependsOn` creates a directed dependency. Cycles are invalid. Use `optional: true` plus `defaultValue` only when the document remains valid without that source.

## Mapping forms

```javascript
const mapping = {
  fields: {
    plain: "order.customer.name",
    fallback: { path: "order.reference", defaultValue: "—" },
    composed: { template: "Order {order.number} · {static.locale}" },
    currency: { path: "totals.total", formatter: "number", options: { locale: "es-ES", style: "currency", currency: "EUR" } },
    date: { path: "order.createdAt", formatter: "date", options: { locale: "es-ES" } },
    items: { path: "order.items", formatter: "table", options: { columns: ["description", "quantity", "amount"] } }
  }
};
```

Built-in formatters: `raw`, `json`, `join`, `number`, `date`, `table`. Register custom formatters by name. A formatter receives already-resolved values; it must be deterministic and should not perform network access.

## Security

- Allowlist REST/OData origins in the host app; do not let arbitrary saved templates choose unrestricted URLs.
- Never store secrets in a template or mapping.
- Enforce backend authorization independently of fields shown in the UI.
- Limit collection sizes and timeouts to prevent accidental large documents.
- Treat returned strings as untrusted and keep HTML rendering disabled unless explicitly sanitized.
