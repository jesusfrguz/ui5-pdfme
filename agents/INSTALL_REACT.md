# Install in React

## Procedure

```bash
npm install ui5-pdfme react react-dom
```

```jsx
import { useEffect, useRef } from "react";
import { PdfTemplateStudio } from "ui5-pdfme/react";

export function PrintTemplatePage({ template }) {
  const studioRef = useRef(null);

  useEffect(() => {
    studioRef.current
      ?.registerLoader("totals", (_source, context) => ({
        total: context.data.order.items.reduce((sum, row) => sum + row.amount, 0)
      }))
      .refreshData();
  }, []);

  return (
    <PdfTemplateStudio
      ref={studioRef}
      template={template}
      templateRepositories={[{ id: "browser", type: "localStorage", storageKey: "my-app.templates" }]}
      autoResolve={false}
      dataSources={[
        { id: "order", type: "rest", url: "/api/orders/5001" },
        { id: "totals", type: "function", loader: "totals", dependsOn: ["order"] }
      ]}
      mapping={{ fields: { total: { path: "totals.total", formatter: "number" } } }}
      filename="order.pdf"
      language="es"
    />
  );
}
```

The ref is the underlying `WebPdfTemplateStudio`. Use it for `preview`, `download`, `print`, `generate`, `openTemplateCatalog`, `listTemplates`, `loadTemplate`, `saveTemplateRecord`, registrations and state inspection. Props update the active configuration; keep template, mapping and repository arrays stable when possible. A standalone `PdfTemplateCatalog` is also exported.

## Success check

Verify the component survives mount/unmount, its ref is non-null after mount, data fields appear, fixed-only content stays on its original page, repeated fixed content and resolved Text values appear on every page, and `await studioRef.current.generate()` returns a non-empty `Uint8Array`.
