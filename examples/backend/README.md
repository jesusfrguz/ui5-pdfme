# Template repository backends

Choose one path; they all expose the record contract documented in [`agents/TEMPLATE_REPOSITORIES.md`](../../agents/TEMPLATE_REPOSITORIES.md).

## Zero dependencies: local REST demo

```bash
node examples/backend/node/server.mjs
```

Configure `{ type: "rest", url: "http://127.0.0.1:3000/api/templates" }`. The server stores data in memory and is intended for integration testing only.

## PostgreSQL

1. Apply [`sql/postgresql.sql`](sql/postgresql.sql) with your migration tool.
2. Expose list/get/create/update through the REST contract.
3. Map snake_case database columns to the camelCase JSON record.
4. Require the current `version` or `If-Match` on update, increment it transactionally, and return HTTP 409/412 on conflicts.

The browser must call the authorized API; it must never receive database credentials or connect directly to PostgreSQL.

## SAP CAP / OData V4

Copy [`cap/db/schema.cds`](cap/db/schema.cds) and [`cap/srv/template-service.cds`](cap/srv/template-service.cds) into an existing CAP project, then deploy with that project's normal database and authentication configuration. The service aliases fields to the repository's default OData contract.

```javascript
studio.setTemplateRepositories([{
  id: "cap",
  type: "odata",
  modelName: "templates",
  path: "/Templates"
}]);
```

Assign `TemplateViewer` for read-only catalog access and `TemplateEditor` for create/update. Add tenant/owner restrictions appropriate to the host application before production use.

## SAP ABAP / Gateway chooser

Use [`sap/README.md`](sap/README.md) to choose RAP OData V4, classic CDS auto-exposure, or SAP Gateway/SEGW OData V2. It includes the exact DDIC/OData field contract, package and transport boundaries, an optional dry-run XCO installer, an importable SEGW EDMX, and an optional supported Gateway activation report.
