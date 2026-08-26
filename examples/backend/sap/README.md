# SAP backend chooser

All routes use the same repository fields, but they are not interchangeable. Choose the route that matches the ABAP/BTP release and the required operations.

| Route | Protocol | Complete JSON payloads | Create/update | Fast path |
| --- | --- | --- | --- | --- |
| RAP | OData V4 | Yes; verify `Edm.String` in `$metadata` | XCO/ADT scaffold; hardening required | ADT RAP Web API wizard or the optional XCO report |
| CAP on BTP | OData V4 | Yes (`LargeString`) | Included handlers and ETag/version logic | [`../cap/README.md`](../cap/README.md) |
| SAP Gateway / SEGW | OData V2 | Yes (`Edm.String` mapped to ABAP `STRING`) | Not included; implement in `DPC_EXT` | Import the included EDMX, generate, implement, activate |
| Classic CDS auto-exposure | OData V2 | **No**: catalog headers only | Read-only in this kit | Activate `@OData.publish: true`, then register the generated service |
| REST | JSON HTTP | Yes | Included contract/demo | [`../README.md`](../README.md) |

Recommended order for new work:

1. Use RAP V4 in a modern ABAP stack.
2. Use CAP V4 when the service belongs in SAP BTP.
3. Use the framework-neutral REST contract when SAP-specific metadata is not useful.
4. Use SEGW V2 for an existing Gateway landscape that cannot use RAP.
5. Keep classic CDS auto-exposure only for a legacy, read-only catalog index.

## Downloads

- [Optional XCO scaffold report](../../../docs/downloads/sap/zui5_pdfme_install.prog.abap) — SAP S/4HANA 2022+ baseline, dry-run by default. It asks for a transportable package and a modifiable Workbench request, creates only missing objects, never overwrites/deletes/releases, and can attempt local RAP V4 publication only when explicitly selected. It does not compare existing definitions and its multi-step generation is not atomic.
- [Gateway V2 EDMX](../../../docs/downloads/sap/template-repository-v2.edmx) — import into an existing/new SEGW project.
- [Optional Gateway V2 activation report](../../../docs/downloads/sap/zui5_pdfme_activate_v2.prog.abap) — runs in the hub after the backend service exists; asks for hub package/request and a pre-existing system alias.

The XCO report is not a cross-release Add-On. Syntax-check and ATC-check it in the target system because XCO generation capabilities vary by release/support package. For deterministic, unattended installation across a controlled system matrix, ship a certified transport or Add-On for each supported release.

## Package and transport boundary

- RAP/XCO: one transportable backend package and a modifiable Workbench request whose target matches the package. XCO does not use `$TMP` for this operation.
- Classic CDS: DDIC/DDLS plus generated IWSV/IWMO belong to the backend package/request.
- SEGW: DDIC, IWPR, MPC/DPC classes, IWSV and IWMO belong to the backend package/request.
- Distributed Gateway: hub IWSG/IWOM activation can require a second hub package/request. The alias, RFC destination, trust and authorizations are landscape configuration and must pre-exist; some settings may require a Customizing request.
- CAP: no ABAP package or Workbench request. Use the CAP project's Git/CI/CD and BTP deployment model.

## Contract

| Property | REST/JavaScript | OData | ABAP/CAP storage | Rule |
| --- | --- | --- | --- | --- |
| `id` / `ID` | string | `Edm.String(128)`, key | `CHAR(128)` / `String(128)` | 1–128; `^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$` |
| `name` / `Name` | string | `Edm.String(160)` | `CHAR(160)` / `String(160)` | trimmed, 1–160 |
| `description` / `Description` | string | `Edm.String(1024)` | `CHAR(1024)` / `String(1024)` | 0–1024 |
| `tags` / `Tags` | JSON array | JSON text in `Edm.String(4096)` | ABAP `STRING` / CAP `String(4096)` | max 32 unique values; each 1–64; validate the 4096-character limit in ABAP |
| `status` / `Status` | enum string | `Edm.String(20)` | `CHAR(20)` / `String(20)` | `draft`, `published`, `archived` |
| `version` / `Version` | normalized decimal string | `Edm.Int32` | `INT4` / `Integer` | 1–2,147,483,647 |
| four `*Json` payloads | JSON values | JSON text in unbounded `Edm.String` | ABAP `STRING` / CAP `LargeString` | validate JSON; total request reference limit 5,000,000 characters |
| `createdAt`, `updatedAt` | RFC 3339 | `Edm.DateTimeOffset` (V4) / `Edm.DateTime` (V2) | backend-owned audit fields | never trust client-supplied audit values |

`repositoryId` is runtime-only and is never stored. `dataSources` is opt-in and must never contain credentials.

## RAP / OData V4

See [`rap/README.md`](rap/README.md). The optional report scaffolds a table, data elements, interface/projection views, behavior definitions, a behavior pool, service definition and OData V4 UI binding. It deliberately leaves production authorization, DCL, validation, server-side version increment, ETag policy and read-only audit behavior as required work; verify the resulting `$metadata` before connecting a client.

## Classic CDS / OData V2

See [`classic-cds-v2/README.md`](classic-cds-v2/README.md). This is a read-only catalog index. DDIC-based CDS views cannot portably expose the long `STRING` JSON payload fields, so it is not a complete template repository.

## SAP Gateway / SEGW OData V2

See [`gateway-segw-v2/README.md`](gateway-segw-v2/README.md). SAP documents a GUI project/import/generation workflow and does not provide a universal released API for end-to-end SEGW project creation. The kit automates only what has a supported boundary: DDIC generation on modern XCO systems, an importable EDMX, and optional hub activation after the backend service exists.
