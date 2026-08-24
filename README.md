# ui5-pdfme

Visual PDF template studio for SAPUI5, OpenUI5, Fiori, React and framework-neutral JavaScript. It combines the [pdfme](https://pdfme.com/) designer/generator with declarative JSON, REST, OData V2/V4 and calculated data sources.

![ui5-pdfme running in SAPUI5](docs/assets/images/ui5-studio.png)

## Highlights

- Visual editor for text, tables, lists, images, signatures, SVG, shapes, dates and barcodes.
- One template/data/mapping contract across UI5, JavaScript and React.
- JSON, REST, OData V2/V4, UI5 models and registered function sources.
- Dependent/concurrent sources, custom providers, loaders and formatters.
- PDF preview, byte generation, download and browser printing.
- Versionable JSON templates suitable for OData, CAP, ABAP, BTP or any backend.
- Responsive template catalog with search, status/source filters, loading and saving.
- Pluggable template repositories for memory, localStorage, REST, OData and application functions.
- Technical/functional [web documentation](https://jesusfrguz.github.io/ui5-pdfme/) and an [AI integration playbook](AGENTS.md).
- Live [OpenUI5, JavaScript and React examples](https://jesusfrguz.github.io/ui5-pdfme/examples/), built and deployed from `main` with GitHub Pages.

## Install

```bash
npm install ui5-pdfme
```

Until the package is published in npm, install the precompiled GitHub release (including the UI5 distribution):

```bash
npm install https://github.com/jesusfrguz/ui5-pdfme/releases/download/v0.1.0/ui5-pdfme-0.1.0.tgz
```

Node.js 20+ is required for development. Browser consumers should use a modern ESM/WASM-capable bundler such as Vite.

## JavaScript

```html
<div id="studio" style="height:760px"></div>
```

```javascript
import { WebPdfTemplateStudio } from "ui5-pdfme";

const studio = new WebPdfTemplateStudio("#studio", {
  template,
  templateRepositories: [{ id: "browser", type: "localStorage", storageKey: "my-app.templates" }],
  dataSources: [
    { id: "order", type: "rest", url: "/api/orders/5001" },
    { id: "brand", type: "json", data: { company: "Example S.L." } }
  ],
  mapping: {
    fields: {
      customer: "order.customerName",
      company: "brand.company",
      items: { path: "order.items", formatter: "table", options: { columns: ["description", "quantity", "amount"] } }
    }
  },
  language: "es",
  filename: "pedido.pdf"
});
```

Run the complete example with `npm run example:js`.

## React

```jsx
import { PdfTemplateStudio } from "ui5-pdfme/react";

<PdfTemplateStudio
  ref={studioRef}
  template={template}
  templateRepositories={[{ id: "browser", type: "localStorage", storageKey: "my-app.templates" }]}
  dataSources={dataSources}
  mapping={mapping}
  language="es"
  filename="pedido.pdf"
/>
```

The ref exposes the underlying studio API. Run `npm run example:react` for the complete loader/refresh lifecycle.

## SAPUI5 / OpenUI5 / Fiori

Declare the library in `manifest.json`:

```json
{
  "sap.ui5": {
    "dependencies": {
      "minUI5Version": "1.71.0",
      "libs": {
        "sap.m": {},
        "ui5.pdfme": {}
      }
    }
  }
}
```

Use the native control:

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m" xmlns:pdf="ui5.pdfme">
  <pdf:PdfTemplateStudio id="printStudio" height="48rem" filename="pedido.pdf" />
</mvc:View>
```

```javascript
this.byId("printStudio").configure({
  template: template,
  templateRepositories: [{ id: "templates", type: "odata", modelName: "templates", path: "/Templates" }],
  dataSources: [{
    id: "order",
    type: "odata",
    modelName: "main",
    path: "/SalesOrderList('5001')",
    parameters: { $expand: "Items" }
  }],
  mapping: { fields: { orderNumber: "order.SalesOrder" } }
});
```

The UI5 adapter uses propagated OData V2/V4 and JSON models. The npm artifact contains the precompiled UI5 resources; consumer applications do not need this repository's custom build task.

The same UI5 artifact supports SAPUI5/OpenUI5 1.71.x and 1.120.x in modern browsers. It uses the `sap/ui/core/Core` and `sap/base/i18n/ResourceBundle` APIs shared by both branches; `sap/ui/core/Lib` is neither loaded nor bundled. Internet Explorer is not supported.

## Shared API

```javascript
await studio.refreshData();
const bytes = await studio.generate();
await studio.preview();
await studio.download();
await studio.print();
studio.openHelp();

studio.getTemplate();
studio.getResolvedData();
studio.getInputs();
studio.registerDataProvider(type, provider);
studio.registerLoader(name, loader);
studio.registerFormatter(name, formatter);

await studio.listTemplates({ search: "invoice", status: "published" });
await studio.loadTemplate("invoice-es", { repositoryId: "templates" });
await studio.saveTemplateRecord({ name: "Invoice", tags: ["sales"] });
```

The toolbar includes a bilingual quick-help dialog. Configure `helpUrl` to point at an application-specific manual, use `showHelp: false` when the host already provides help, and listen for the `pdfme:help`/UI5 `help` event when opening help must be observed.

Static fields and data-bound Text fields expose **Fixed non-moving position** (`fixedPosition: true`). This keeps the element at its absolute coordinates and outside the dynamic-content flow. Enabling it reveals the optional **Repeat on every page** flag (`repeatOnEveryPage: true`). The saved schema remains selectable in the designer; preview and generation materialize fixed content, including its resolved input value, without mutating the saved template. During generation, repeated fixed fields automatically extend the nearest top or bottom `basePdf.padding` boundary so dynamic content that moves to another page cannot overlap them; configured padding remains the minimum. Repeated static text supports `{currentPage}` and `{totalPages}`.

`templateRepositories` accepts `memory`, `localStorage`, `rest`, `odata`, and `function` sources. The Templates toolbar action opens the visual catalog; it searches and filters across all configured repositories. REST/OData pagination is followed automatically. Stored data-source definitions are excluded by default and require explicit `persistDataSources`/`applyStoredDataSources` opt-ins.

Web events are prefixed with `pdfme:` (`pdfme:templateSave`, `pdfme:templatesListed`, `pdfme:templateLoaded`, `pdfme:templateSaved`, `pdfme:dataResolved`, `pdfme:generated`, `pdfme:error`). The UI5 control exposes the equivalent native events.

## Documentation

- [User guide in Spanish](docs/guide/index.html) · [English](docs/guide/en.html)
- [Technical and functional web documentation](https://jesusfrguz.github.io/ui5-pdfme/)
- [AI/agent instructions](AGENTS.md)
- [SAPUI5/OpenUI5/Fiori recipe](agents/INSTALL_UI5.md)
- [JavaScript recipe](agents/INSTALL_JAVASCRIPT.md)
- [React recipe](agents/INSTALL_REACT.md)
- [Template creation](agents/CREATE_TEMPLATE.md)
- [Data and OData integration](agents/DATA_INTEGRATION.md)
- [Template catalog and repositories](agents/TEMPLATE_REPOSITORIES.md)
- [Validation checklist](agents/VALIDATION_CHECKLIST.md)

## Development

```bash
npm ci
npm test
npm run build
npm run build:legacy
npm run start
npm run start:legacy
npm run docs:dev
```

`dist-v6/` is generated once with OpenUI5 1.120.x and must not be edited manually. `build:legacy` validates that same precompiled artifact against OpenUI5 1.71.x; it does not create a second published distribution. The development build patches a pinned `ui5-tooling-modules` compatibility gap for pdfme's PDFium/WASM resources; the patch is idempotent and fails on unsupported tooling versions.

Both `npm run start` and `npm run start:legacy` open the demo with an example catalog already populated with an invoice, a shipping label and a purchase order. The catalog supports search and filtering; selecting an entry loads it into the designer, where it can be edited and saved in the browser repository. `start:legacy` rebuilds `dist-v6/` first so the OpenUI5 1.71.x server always uses the current library sources.

## Security and production

- Keep credentials and access tokens outside templates/data-source definitions.
- Allowlist remote source origins and impose collection/timeout limits.
- Authorize and version template publishing in the backend.
- Test long text, empty/large tables, page breaks, fonts, locale and timezone.
- Normal browsers always show the print dialog; silent printing requires controlled external infrastructure.

## Author

[Jesús Franco Guzmán](https://www.linkedin.com/in/jesus-franco-guzman/)

## License and attribution

Copyright © 2026 [Jesús Franco Guzmán](https://www.linkedin.com/in/jesus-franco-guzman/). This project is licensed under Apache-2.0. It uses and distributes components from pdfme, licensed under MIT and copyright © 2020 HandDot. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
