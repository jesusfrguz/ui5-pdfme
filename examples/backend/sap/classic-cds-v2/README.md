# Classic CDS auto-exposure (legacy OData V2 index)

This route is intentionally a **read-only catalog index**. It exposes ID, name, description, status, version and dates, but not tags or the four long JSON payloads. Tags are persisted as `STRING` because their JSON representation can reach 4096 characters. DDIC-based `define view` cannot portably expose `STRING`, `RAWSTRING`, `LCHR` or `LRAW`, while `SSTRING` is too small for either that tag contract or a full template.

It is not a complete template repository. Do not select this route for `get`/`save` of complete templates; use RAP, CAP, REST, or SEGW instead.

The XCO report is a release-sensitive scaffold for SAP S/4HANA 2022+. It creates missing objects but does not compare existing definitions or provide production authorization/validation. Syntax-check and ATC-check it on the exact support package. On older systems, create the DDIC objects manually/in a release-specific transport and activate [`ZPDFME_CDS_TPL.asddls`](ZPDFME_CDS_TPL.asddls).

`@OData.publish: true` creates the backend service `ZPDFME_CDS_TPL_CDS` together with its generated Gateway artifacts. Registration is still required in `/IWFND/MAINT_SERVICE`, or run the optional activation report in the hub after supplying the existing system alias, hub package and hub Workbench request.
