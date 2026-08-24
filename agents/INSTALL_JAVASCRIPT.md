# Install in a JavaScript web app

## Preconditions

- Node.js 20 or newer.
- A browser build tool that supports ESM and WebAssembly, such as Vite.

## Procedure

```bash
npm install ui5-pdfme
```

Create a host element with a useful height:

```html
<div id="print-studio" style="height: 760px"></div>
```

Instantiate the editor. Register function loaders before the first manual refresh:

```javascript
import { WebPdfTemplateStudio } from "ui5-pdfme";

const studio = new WebPdfTemplateStudio("#print-studio", {
  template,
  templateRepositories: [{ id: "browser", type: "localStorage", storageKey: "my-app.templates" }],
  dataSources: [
    { id: "order", type: "rest", url: "/api/orders/5001" },
    { id: "brand", type: "json", data: { company: "Example S.L." } }
  ],
  mapping: {
    fields: {
      customer: "order.customerName",
      company: "brand.company"
    }
  },
  filename: "order-5001.pdf",
  language: "es",
  helpUrl: "/ayuda/plantillas-pdf"
});

document.querySelector("#print-studio").addEventListener("pdfme:templateSaved", ({ detail }) => {
  console.info("Persisted", detail.record.id);
});
```

Use `autoResolve: false` when a source needs a loader or formatter that will be registered after construction, then call `await studio.refreshData()`.

The toolbar help button opens a short built-in checklist and links to the configured `helpUrl`. Omit it to use the official bilingual user guide, or set `showHelp: false` when the host application provides its own help entry point. The public `openHelp()` method opens the same dialog.

## Success check

The data panel shows resolved paths, selecting one inserts a field, Templates opens the searchable catalog, Save persists through the configured repository, and Preview opens a PDF containing mapped values. A static or data-bound Text field marked **Fixed non-moving position** must remain at its coordinates; with **Repeat on every page** enabled it and its resolved value must appear throughout a multipage preview. See [template repositories](TEMPLATE_REPOSITORIES.md) for REST/OData.
