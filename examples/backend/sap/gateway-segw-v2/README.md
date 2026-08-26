# SAP Gateway / SEGW OData V2

Use this route when a legacy on-premise Gateway landscape needs the complete repository and RAP is unavailable. The supplied EDMX keeps the long JSON payloads as unbounded `Edm.String`, which SEGW can map to ABAP `STRING`.

The EDMX and optional DDIC generation are scaffolding only. They do not contain a `DPC_EXT` implementation and are not a functional repository backend by themselves. List, detail, create, and update become available only after the project is generated and its data-provider extension is implemented and verified; delete is outside the repository contract and the EDMX marks the entity set as non-deletable.

## Supported workflow

1. Create/reuse a backend package and modifiable Workbench request.
2. Create the DDIC table/data elements from the contract. On SAP S/4HANA 2022+, the optional XCO report can create only the missing DDIC objects.
3. In SEGW, create a project in that package/request and import [`template-repository-v2.edmx`](../../../../docs/downloads/sap/template-repository-v2.edmx).
4. Map/bind the entity to DDIC where useful, then generate MPC/MPC_EXT, DPC/DPC_EXT, IWSV and IWMO artifacts. In SEGW leave Max Length blank/0 for the four unbounded JSON properties and bind them to ABAP `STRING`; bind `Tags` to the `ZPDFME_TAGS` `STRING` data element while enforcing 4096 characters in `DPC_EXT`.
5. Implement `GET_ENTITYSET`, `GET_ENTITY`, `CREATE_ENTITY` and `UPDATE_ENTITY` in `DPC_EXT`. Keep the generated base classes untouched.
6. In a distributed hub, use a separate hub package/request and a pre-existing system alias. Register in `/IWFND/MAINT_SERVICE` or use the optional activation report.
7. Verify `$metadata`, CSRF token handling, create/read/update, paging, filtering and ETag conflict behavior.

## DPC_EXT rules

- Lists should select only header fields; do not load four long JSON fields for catalog pages.
- Detail reads return all JSON fields as text.
- Parse/validate every JSON field and reject malformed/oversized input before persistence.
- Validate ID/name/description/tags/status/version using the common contract.
- Ignore client audit values, set timestamps/users in the backend and increment `Version` transactionally.
- Derive and check ETags dynamically; return HTTP 412 on stale updates.
- Apply tenant/owner/authorization filters in every operation.
- Do not persist credentials inside `DataSourcesJson`.

There is no universal released SAP API that safely creates an IWPR project, imports its model and generates MPC/DPC across the supported 7.40/7.50 landscape. The explicit SEGW step is therefore part of this option. If installation must be unattended, build and certify a transport or Add-On for each target release.

HTTP-client configuration requires the V2 switch:

```javascript
templateRepositories: [{
  id: "sap-gateway",
  type: "odata",
  odataVersion: 2,
  url: "/sap/opu/odata/sap/ZPDFME_TPL_SRV/Templates",
  requireEtag: true,
  fetch: sapGatewayFetch
}]
```

The plain HTTP client can use `list` and `get` directly. Writes require an application-provided `sapGatewayFetch` wrapper that keeps the authenticated session, obtains or refreshes `X-CSRF-Token`, and retries only according to the application's policy. Before an update, read the current record and pass its dynamic `__metadata.etag` through the normalized record; `requireEtag: true` prevents an update without that ETag. A static token or ETag in repository configuration is not sufficient.

For SAPUI5/Fiori list/detail/create/update, prefer a propagated `sap.ui.model.odata.v2.ODataModel`. It keeps session, CSRF-token and dynamic-ETag handling under the application's established UI5 model rather than duplicating those responsibilities in a custom HTTP wrapper.
