# Template catalog and persistence

The bilingual web guide is available in [Spanish](../docs/repositories/index.html) and [English](../docs/repositories/en.html).

## Choose a repository

| Type | Lifetime / owner | Best fit |
| --- | --- | --- |
| `memory` | Current repository instance | Tests, demos and seeded examples |
| `localStorage` | Current browser origin and profile | Prototypes and individual local work |
| `rest` | Application HTTP service | Shared backends with a custom JSON contract |
| `odata` | OData HTTP service or propagated UI5 model | SAP Fiori, CAP and OData V2/V4 |
| `function` | Application callbacks | SDKs, caches and application-owned persistence |

For multi-user production, use an authorized service through `rest`, `odata`, or `function`. Neither `memory` nor `localStorage` provides access control, conflict handling, or a shared source of truth.

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
  createdAt: "2026-08-20T09:00:00Z",
  updatedAt: "2026-08-23T10:30:00Z",
  template,
  mapping,
  metadata: { dataContractVersion: "2" },
  dataSources // optional
}
```

The store adds `repositoryId` after loading. It also preserves a transport-only `etag` read from `etag`, `ETag`, OData V4 `@odata.etag`, or OData V2 `__metadata.etag`; do not persist it as repository content. `draft`, `published`, and `archived` are catalog conventions rather than a full approval workflow, and `version` does not create history by itself. Do not persist credentials. `dataSources` is excluded when the studio saves unless `persistDataSources: true` is explicitly configured. Loading stored sources is also opt-in with `applyStoredDataSources: true`.

### Exact field contract

| Property | REST / JavaScript | OData / storage | Validation |
| --- | --- | --- | --- |
| `id` / `ID` | string | `Edm.String(128)` key; `varchar/CHAR/String(128)` | 1–128; `^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$` |
| `name` / `Name` | string | `Edm.String(160)` | trimmed, 1–160 |
| `description` / `Description` | string | `Edm.String(1024)` | 0–1024 |
| `tags` / `Tags` | array of strings | JSON text in `Edm.String(4096)` | at most 32 case-insensitively unique items, each 1–64 |
| `status` / `Status` | enum string | `Edm.String(20)` | `draft`, `published`, or `archived` |
| `version` / `Version` | normalized decimal string | `Edm.Int32`; integer/INT4 | 1–2,147,483,647; convert only at the OData boundary |
| `template` / `TemplateJson` | JSON value | JSON text in unbounded `Edm.String`; CLOB/STRING/LargeString | valid pdfme template |
| `mapping`, `metadata`, `dataSources` | JSON values | JSON text in unbounded `Edm.String`; CLOB/STRING/LargeString | valid JSON; `dataSources` stays opt-in |
| `createdAt`, `updatedAt` | RFC 3339 strings | `Edm.DateTimeOffset` precision 7 (V4) / `Edm.DateTime` precision 7 (V2) | backend-owned audit values; adapters normalize V2 dates to RFC 3339 |

The reference implementations cap the total serialized request at 5,000,000 characters. Validate decoded JSON and per-field business rules, not just database column lengths. Machine-readable versions live in [`examples/backend/contracts`](../examples/backend/contracts).

## Volatile memory

```javascript
templateRepositories: [{
  id: "examples",
  name: "Example templates",
  type: "memory",
  records: [invoiceRecord, shippingLabelRecord]
}]
```

The provider mutates `records` for the lifetime of that repository configuration. It creates IDs and timestamps, increments `version` when the same ID is saved again, and loses all changes when the page or application instance is replaced. Use it for deterministic seeds, demos and tests, not durable storage.

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

The default key is `ui5-pdfme.templates`; use an application- and environment-specific `storageKey`. The provider rewrites the complete JSON array, so browser quotas, clearing, private-mode restrictions and concurrent tabs must be handled as application risks.

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

Default web HTTP contract:

| Operation | Request | Response |
| --- | --- | --- |
| List | `GET /api/templates?search=&status=&tags=&top=&skip=` | array or `{ items, total, next }` |
| Get | `GET /api/templates/:id` | full template record |
| Create | `POST /api/templates` | saved record |
| Update | `PUT /api/templates/:id` | saved record |

The web client follows `next`, `nextLink`, OData `@odata.nextLink`, and V2 `d.__next` unless `followNext: false`, up to `maxPages` (100 by default). In the web adapter, override parameter names, `getUrl`, `createMethod`, `updateMethod`, `mapRecord`, or `serializeRecord` when an existing API differs. The native UI5 REST provider uses fixed `search`, `status`, `top`, and `skip` parameters and does not apply the web mapping hooks.

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
  odataVersion: 4,
  url: "/odata/v4/pdf-templates/Templates",
  fields: { template: "TemplateJson", mapping: "MappingJson" }
}]
```

The web adapter reads V2/V4 collection envelopes and follows server-driven paging. V4 is the default and uses `contains`, `$count=true`, and `PATCH`; set `odataVersion: 2` to use SAP-compatible `substringof` without `tolower`, `$inlinecount=allpages`, and `MERGE`. V2 search case-sensitivity therefore follows the backend. Lists use `$select` for ID/name/description/tags/status/version/audit fields by default so the four long JSON fields are read only by detail calls; override with `listSelect` or set it to `false`. The default OData entity fields are `ID`, `Name`, `Description`, `Tags`, `Status`, `Version`, `CreatedAt`, `UpdatedAt`, `TemplateJson`, `MappingJson`, `MetadataJson`, and `DataSourcesJson`. `fields` changes filtering and serialization names; reads still normalize the standard aliases. Use REST mapping hooks, `function`, or a registered provider when a service returns completely different field names.

For SAP Gateway HTTP writes, provide an application-owned `fetch` wrapper that obtains/refreshes `X-CSRF-Token` while keeping the authenticated session. Set `requireEtag: true` so an update fails unless the record carries a dynamic ETag loaded from the service. A static CSRF token or ETag in repository configuration is not a safe substitute. After a bodyless update the adapter rereads the entity to obtain its new version, audit values, and ETag. Prefer the propagated UI5 model when available.

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

For SAP implementation choices, packages/transports, SEGW downloads and the optional dry-run installer, use [SAP_BACKENDS.md](SAP_BACKENDS.md).

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

`list` must return an array of records or summaries. `get` and `save` return complete records. These callbacks own durable IDs, timestamps, version/conflict behavior and the persistence transaction; they may return values or promises.

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

React exports `PdfTemplateCatalog` and accepts `templateRepositories` on `PdfTemplateStudio`. UI5 exposes `setTemplateRepositories`, `openTemplateCatalog`, `listTemplates`, `getTemplateRecord`, `loadTemplate`, `saveTemplateRecord`, and `registerTemplateRepositoryProvider`.

`WebTemplateCatalog` dispatches `pdfme:templatesListed` and `pdfme:templateOpen` on its own root. `WebPdfTemplateStudio` dispatches `pdfme:templateLoaded` and `pdfme:templateSaved` on the studio root. UI5 equivalents are `templatesListed`, `templateLoaded`, and `templatePersisted`.

There is no common delete, move, publish, or version-history API. Changing only `repositoryId` does not move a record. Clear `id` to create a copy according to the application's workflow, and implement protected lifecycle operations in the backend.

## Production checklist

- Authorize list, get, create, update and publish independently.
- Validate pdfme schemas and mapping server-side before publishing.
- Implement optimistic locking (`ETag`/version) in the application transport/backend and keep published versions immutable.
- Apply tenant/owner filters in the backend, never only in the catalog UI.
- Restrict stored data-source URLs and never store tokens, cookies or private payloads.
- Bound page size, total records and JSON payload size.
