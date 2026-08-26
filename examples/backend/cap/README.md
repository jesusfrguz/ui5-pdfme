# SAP CAP / BTP quickstart

This directory is a runnable CAP Node.js 10 application exposing the ui5-pdfme template repository as OData V4. It uses in-memory SQLite during development and can be extended with SAP HANA Cloud and XSUAA for SAP BTP.

## Run locally

Use a supported Node.js LTS release (22 or 24). Enable a newer even-numbered release only after it becomes LTS and the selected SAP BTP runtime/buildpack supports it:

```bash
cd examples/backend/cap
npm install
npm run watch
```

Run the CAP integration tests with `npm test`; they exercise roles, create/read/update, ETags, conflict handling, and invalid input against the in-memory service.

Open `http://localhost:4004/odata/v4/pdf-templates/$metadata`. Development-only mock users are `viewer` / `viewer` for reads and `editor` / `editor` for reads and writes.

Configure the propagated UI5 OData V4 model with the service root, then use:

```javascript
studio.setTemplateRepositories([{
  id: "cap",
  type: "odata",
  modelName: "templates",
  path: "/Templates",
  pageSize: 100,
  updateGroupId: "templates"
}]);
```

The exposed entity follows the default names expected by ui5-pdfme. `ID` is `String(128)`, `Name` is `String(160)`, `Description` is `String(1024)`, `Tags` is JSON text in `String(4096)`, `Status` is `String(20)`, and `Version` is `Integer`/OData `Edm.Int32`. Template, mapping, metadata, and data-source payloads are JSON text in `LargeString` fields.

The service accepts at most 32 unique, case-insensitive tags after trimming, each containing 1–64 characters. It validates the canonical ID pattern and JSON payload shapes, caps their combined serialized size at 5,000,000 characters, increments `Version` on update, and exposes it as an OData ETag. Updates require `If-Match`; sending `Version` in the body is optional, but if present it must match. List responses are paged at 100 records by default and 1,000 maximum.

## Prepare for SAP BTP

In a copy of this quickstart, use the CAP generators so their output matches the installed CAP release:

```bash
npx cds add hana
npx cds add xsuaa
npx cds add mta
npm install
npx cds build --production
```

Build and deploy the generated MTA with the normal Cloud Foundry toolchain. Map the generated `TemplateViewer` and `TemplateEditor` scopes to role collections. Mock authentication is restricted to the development profile and must not be used in production.

Before production, add tenant/owner predicates appropriate to the application, verify XSUAA role assignments, keep published versions immutable according to the business workflow, and configure application-level monitoring and backups.
