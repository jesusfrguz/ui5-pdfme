# RAP OData V4

Use this route for a new repository on a modern SAP S/4HANA/ABAP stack. The quickest supported route is the ADT **Generate ABAP Repository Objects → OData Web API Service** wizard. The optional report in `docs/downloads/sap/zui5_pdfme_install.prog.abap` provides a repeatable XCO skeleton for SAP S/4HANA 2022+.

## Install

1. Download/import the report as temporary program `ZUI5_PDFME_INSTALL`.
2. Syntax-check and ATC-check it against the target release/SP.
3. Run it with the RAP option, the target package and a modifiable Workbench request. Leave **Apply** and **Publish** clear.
4. Review the dry-run plan and any already-existing object. Existing objects are preserved; compare their fields/types manually.
5. Run with **Apply**. Select **Publish** only for a local development endpoint.
6. In ADT, verify every generated object and the binding `$metadata`.

Expected objects: `ZPDFME_ID`, `ZPDFME_NAME`, `ZPDFME_DESC`, `ZPDFME_TAGS`, `ZPDFME_STATUS`, `ZPDFME_JSON`, `ZPDFME_TPL`, `ZPDFME_I_TPL`, `ZPDFME_C_TPL`, `ZBP_PDFME_I_TPL`, `ZPDFME_TPL_SRVD`, and `ZPDFME_TPL_O4`.

## Required production work

The report intentionally creates a CRUD skeleton, not an authorization-free production service. Before deployment:

- add DCL and business authorization checks;
- enforce the ID pattern, status enum, tag rules and 5,000,000-character request limit;
- increment `Version` server-side and define the RAP ETag policy;
- make audit fields read-only/backend-owned;
- disallow delete or add a protected lifecycle if the application does not need delete;
- confirm all four JSON fields are `Edm.String` without a restrictive `MaxLength` in `$metadata`;
- run create/read/update conflict tests with the propagated SAPUI5 OData V4 model.

Client configuration:

```javascript
studio.setTemplateRepositories([{
  id: "sap-rap",
  type: "odata",
  modelName: "templates",
  path: "/Templates",
  updateGroupId: "templates"
}]);
```

Use the propagated model so the host application owns destinations, authentication, CSRF, batches and dynamic ETags.

