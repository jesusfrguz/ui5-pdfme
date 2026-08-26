# SAP backend selection

Read [TEMPLATE_REPOSITORIES.md](TEMPLATE_REPOSITORIES.md) first. The bilingual implementation guide is available in [Spanish](../docs/sap/index.html) and [English](../docs/sap/en.html); source/download artifacts are under [`examples/backend/sap`](../examples/backend/sap) and [`docs/downloads/sap`](../docs/downloads/sap).

## Decision

| Landscape | Route | Contract coverage |
| --- | --- | --- |
| Modern AS ABAP / S/4HANA | RAP OData V4 | Complete; preferred for new ABAP services |
| SAP BTP, Node.js/Java | CAP OData V4 | Complete; runnable quickstart included |
| Legacy Gateway/ECC/S/4 | SEGW OData V2 | Full contract is possible, but this kit still requires DPC_EXT implementation |
| Existing classic CDS/SADL | `@OData.publish: true` V2 | Read-only catalog index; no long JSON payloads |
| Framework-neutral backend | REST | Complete; OpenAPI, Node and PostgreSQL examples included |

Do not create new classic CDS or SEGW V4 when RAP is available. Classic DDIC-based CDS views cannot portably expose the four ABAP `STRING` JSON payloads, so that path must never be presented as a full template repository.

## Installation boundary

- The optional XCO report is a scaffold targeting an SAP S/4HANA 2022+ baseline and must be syntax/ATC checked on the exact release/SP. Dry-run is the default. It creates only missing objects, does not compare existing definitions, uses multiple non-atomic PUT operations, and never deletes, overwrites or releases a request.
- It requires a transportable package and a compatible modifiable Workbench request; do not use `$TMP` for XCO generation.
- SEGW project/model/class generation remains a documented GUI import/generation step because SAP does not expose a universal released API across legacy releases. Use the EDMX and implement only `*_EXT` classes.
- The Gateway activation report runs after the backend service exists and requires a pre-existing system alias plus the hub package/request.
- A distributed landscape may need separate backend and hub Workbench requests. Alias/RFC/trust/ICF/authorizations are landscape configuration and may also require Customizing.
- CAP has no ABAP package/request. Use the project's Git/CI/CD and BTP deployment workflow.

## Verification

1. Compare the service `$metadata` with the exact types/lengths in [TEMPLATE_REPOSITORIES.md](TEMPLATE_REPOSITORIES.md).
2. Verify that Tags maps to ABAP `STRING` with a backend-enforced 4096-character limit, and that `TemplateJson`, `MappingJson`, `MetadataJson`, and `DataSourcesJson` are unbounded `Edm.String` properties for a complete OData route.
3. Test summary list without LOB payloads, full detail, create, update, server-side version increment, and stale-ETag conflict.
4. For HTTP OData V2 configure `odataVersion: 2`. Plain HTTP writes also require an application CSRF-aware `fetch` wrapper and a dynamic record ETag (`requireEtag: true`); in UI5/Fiori prefer the propagated V2/V4 model.
5. Apply authorization, tenant/owner filters, JSON/size validation, and audit ownership in the backend.
