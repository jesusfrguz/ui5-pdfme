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

The ref is the underlying `WebPdfTemplateStudio`. Use it for `preview`, `download`, `print`, `generate`, registrations and state inspection. Props update the active configuration; keep template and mapping objects stable when possible.

## Success check

Verify the component survives mount/unmount, its ref is non-null after mount, data fields appear, and `await studioRef.current.generate()` returns a non-empty `Uint8Array`.
