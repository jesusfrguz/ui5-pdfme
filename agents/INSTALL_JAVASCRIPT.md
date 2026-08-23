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
  language: "es"
});

document.querySelector("#print-studio").addEventListener("pdfme:templateSave", ({ detail }) => {
  saveTemplate(detail.template);
});
```

Use `autoResolve: false` when a source needs a loader or formatter that will be registered after construction, then call `await studio.refreshData()`.

## Success check

The data panel shows resolved paths, selecting one inserts a field, Save emits `pdfme:templateSave`, and Preview opens a PDF containing mapped values.
