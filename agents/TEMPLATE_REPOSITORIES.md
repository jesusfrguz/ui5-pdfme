# Template catalog and persistence

## Record contract

Every repository returns the same JSON shape. `template` may be omitted from list summaries, but `get` must return it.

```javascript
{
  id: "invoice-es",
  name: "Spanish invoice",
  description: "Approved sales invoice",
  tags: ["sales", "es"],
  status: "published", // draft | published | archived
  version: "3",
  updatedAt: "2026-08-23T10:30:00Z",
  template,
  mapping,
  metadata: { dataContractVersion: "2" }
}
```

Do not persist credentials. `dataSources` is excluded when the studio saves unless `persistDataSources: true` is explicitly configured. Loading stored sources is also opt-in with `applyStoredDataSources: true`.

## Fastest setup: browser storage

```javascript
const studio = new WebPdfTemplateStudio("#studio", {
  template,
  templateRepositories: [{
    id: "browser",
    name: "This browser",
    type: "localStorage",
    storageKey: "my-app.pdf-templates",
    default: true
  }]
});
```

The Templates toolbar button opens the responsive catalog. It can start a blank A4 template or load a local PDF as the pdfme `basePdf`, even when no repository is configured. Search matches name, description and tags; status and repository selectors filter stored records. Save asks for metadata the first time and updates the active record afterwards.

## REST backend

```javascript
templateRepositories: [{
  id: "company-api",
  name: "Company templates",
  type: "rest",
  url: "/api/templates",
  headers: { "x-client": "print-studio" }
}]
```

Default HTTP contract:

| Operation | Request | Response |
| --- | --- | --- |
| List | `GET /api/templates?search=&status=&tags=&top=&skip=` | array or `{ items, total, next }` |
| Get | `GET /api/templates/:id` | full template record |
| Create | `POST /api/templates` | saved record |
| Update | `PUT /api/templates/:id` | saved record |

The client follows `next`, `nextLink`, OData `@odata.nextLink`, and V2 `d.__next` unless `followNext: false`. Override `getUrl`, `createMethod`, `updateMethod`, `mapRecord`, or `serializeRecord` when an existing API differs.

Run the dependency-free example with:

```bash
node examples/backend/node/server.mjs
```

The example is intentionally in-memory. Replace its `Map` with the included [PostgreSQL schema](../examples/backend/sql/postgresql.sql) and enforce authentication/authorization in the service.

## OData over HTTP

```javascript
templateRepositories: [{
  id: "cap",
  type: "odata",
  url: "/odata/v4/pdf-templates/Templates",
  fields: { template: "TemplateJson", mapping: "MappingJson" }
}]
```

The web adapter reads V2/V4 collection envelopes, follows server-driven paging and uses `POST`/`PATCH`. The default OData entity fields are `ID`, `Name`, `Description`, `Tags`, `Status`, `Version`, `CreatedAt`, `UpdatedAt`, `TemplateJson`, `MappingJson`, `MetadataJson`, and `DataSourcesJson`.

For SAPUI5/Fiori, prefer the propagated model so destinations, sessions, batch groups and CSRF remain owned by the application:

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

The UI5 provider supports OData V4 list/context bindings and V2 `read`, `create`, and `update`. V4 list binding is read in pages until exhausted (bounded by `maxRecords`, default 10,000).

The included [CAP schema](../examples/backend/cap/db/schema.cds) and [service projection](../examples/backend/cap/srv/template-service.cds) can be copied into an existing CAP project.

## Custom/database adapter

Browsers should not connect directly to a database. Put authorization and database access behind a service, or register application functions:

```javascript
const repository = {
  id: "custom",
  type: "function",
  list: (query) => api.listTemplates(query),
  get: (id) => api.getTemplate(id),
  save: (record) => api.saveTemplate(record)
};
```

For a reusable provider type:

```javascript
studio.registerTemplateRepositoryProvider("acme", {
  list: (source, query, context) => {},
  get: (source, id, context) => {},
  save: (source, record, context) => {}
});
```

## Standalone catalog and APIs

```javascript
import { TemplateStore, WebTemplateCatalog } from "ui5-pdfme";

const store = new TemplateStore(repositories);
const catalog = new WebTemplateCatalog("#catalog", {
  store,
  language: "es",
  onTemplateOpen: ({ template }) => studio.applyTemplateRecord(template)
});

await studio.listTemplates({ search: "invoice", status: "published" });
await studio.loadTemplate("invoice-es", { repositoryId: "cap" });
await studio.saveTemplateRecord({ name: "Invoice", tags: ["sales"] });
```

React exports `PdfTemplateCatalog` and accepts `templateRepositories` on `PdfTemplateStudio`. UI5 exposes `setTemplateRepositories`, `openTemplateCatalog`, `listTemplates`, `getTemplateRecord`, `loadTemplate`, and `saveTemplateRecord`.

Web events: `pdfme:templatesListed`, `pdfme:templateLoaded`, `pdfme:templateSaved`. UI5 equivalents: `templatesListed`, `templateLoaded`, `templatePersisted`.

## Production checklist

- Authorize list, get, create, update and publish independently.
- Validate pdfme schemas and mapping server-side before publishing.
- Use optimistic locking (`ETag`/version) and immutable published versions.
- Apply tenant/owner filters in the backend, never only in the catalog UI.
- Restrict stored data-source URLs and never store tokens, cookies or private payloads.
- Bound page size, total records and JSON payload size.
