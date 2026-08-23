# Install in SAPUI5, OpenUI5 or Fiori

## Procedure

Install the package and ensure it is present in the application's dependency graph:

```bash
npm install ui5-pdfme
```

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

One precompiled UI5 artifact supports SAPUI5/OpenUI5 1.71.x and 1.120.x in modern browsers. No dynamic `sap/ui/core/Lib` loading or consumer-side pdfme bundling is required. Internet Explorer is not supported.

Add the control to an XML view:

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m" xmlns:pdf="ui5.pdfme">
  <pdf:PdfTemplateStudio
    id="printStudio"
    height="48rem"
    filename="sales-order.pdf"
    templateSave=".onTemplateSave" />
</mvc:View>
```

Configure it from the controller:

```javascript
var studio = this.byId("printStudio");
studio.configure({
  template: template,
  dataSources: [{
    id: "order",
    type: "odata",
    modelName: "main",
    path: "/SalesOrderList('5001')",
    parameters: { $expand: "Items" }
  }],
  mapping: {
    fields: {
      orderNumber: "order.SalesOrder",
      items: { path: "order.Items", formatter: "table", options: { columns: ["Product", "Quantity", "NetAmount"] } }
    }
  }
});
```

The UI5 provider uses a propagated named model. It supports V4 context/list bindings, V2 `read`, and `JSONModel#getProperty`. Keep backend authentication, destinations and CSRF handling in the host application.

## Fiori integration

Place the studio on a dedicated route or full-screen page. Use the normal flexible column/full-screen navigation pattern; do not squeeze the designer into a small object-page section. Persist templates through an application service with authorization and version checks.

## Success check

Run a production `ui5 build`, load the app without loader errors, resolve an OData entity including navigation properties, save the template JSON, and generate a PDF in the deployed route/base-path configuration.
