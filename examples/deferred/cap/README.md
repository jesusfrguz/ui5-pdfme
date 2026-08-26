# CAP deferred PDF generation

This example exposes a template catalog and asynchronous generation jobs through OData V4. It uses the shared renderer in `../renderer`, CAP persistent event queues, mocked local users and in-memory SQLite.

```bash
npm install
npm run watch
```

Open `/odata/v4/pdf-generation/$metadata`. Local users are:

- `viewer` / `viewer`: job/template reads and downloads.
- `generator` / `generator`: enqueue and retry.
- `editor` / `editor`: template writes plus generation.

Create a published template in `Templates`, then call `POST /odata/v4/pdf-generation/enqueue`. The action accepts `templateID`, `payloadJson`, `filename`, optional `runAt`, and optional `idempotencyKey`.

The compact example stores the generated PDF in `GenerationJobs.Result` and returns it through the `download` action. On SAP BTP, add HANA/XSUAA/MTA with the CAP generators, assign the three roles, replace mocked auth, implement the marked server-side SAP data loader, and move large results to Object Store or Document Management.

See [`agents/DEFERRED_GENERATION.md`](../../../agents/DEFERRED_GENERATION.md) for deployment and Fiori/ABAP consumption.
