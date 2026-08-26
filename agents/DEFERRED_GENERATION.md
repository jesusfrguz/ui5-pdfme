# Deferred PDF generation

Use this guide when PDF creation must survive navigation, browser closure, request timeouts, a scheduled start, or high-volume batch processing. The browser designer remains responsible for authoring templates; a trusted Node.js worker resolves data, applies the same mapping contract, and invokes `generatePdf` without UI.

Runnable reference implementations live in [`examples/deferred`](../examples/deferred/README.md).

## Choose a deployment

| Deployment | Queue | Template storage | Recommended for |
| --- | --- | --- | --- |
| SAP CAP Node.js | CAP persistent event queue | CAP database/HANA | BTP applications already using CAP and XSUAA |
| Docker | Embedded polling worker | Memory or PostgreSQL | Kyma, Kubernetes, Docker hosts and portable deployments |
| Plain Node.js | Embedded polling worker | Memory or PostgreSQL | A VM, Windows/Linux service, or an existing Node host |
| ABAP caller | SAP background job calls one of the services above | Service-owned | ECC/S/4HANA initiated documents |

Memory mode is for local development only. It loses templates and job state when the process restarts. PostgreSQL and the CAP queue use durable records.

## Common job contract

The plain Node/Docker API exposes:

```http
POST /api/pdf-jobs
Authorization: Bearer <token>
Idempotency-Key: sales-order-5001-v3
Content-Type: application/json

{
  "templateId": "sales-order",
  "filename": "order-5001.pdf",
  "runAt": "2026-08-27T02:00:00Z",
  "payload": {
    "data": {
      "order": { "number": "5001", "customer": "ACME" }
    }
  }
}
```

`runAt` is optional and defaults to now. Instead of `payload.data`, a production application should normally send an authorized business reference such as `businessObject` and `businessKey`; replace the marked `loadData` extension point with code that reads SAP through a configured destination.

Successful submission returns `202 Accepted`:

```json
{
  "id": "1db8b789-0fb8-44b9-a9b0-4a7dc6507f10",
  "status": "QUEUED",
  "statusUrl": "/api/pdf-jobs/1db8b789-0fb8-44b9-a9b0-4a7dc6507f10",
  "contentUrl": "/api/pdf-jobs/1db8b789-0fb8-44b9-a9b0-4a7dc6507f10/content"
}
```

Poll `statusUrl`. Terminal states are `DONE` and `FAILED`; `contentUrl` returns HTTP 409 until the state is `DONE`. `Idempotency-Key` prevents duplicate jobs after a client retry.

## Plain Node.js

From the repository:

```bash
cd examples/deferred/node
npm install
npm start
```

With no `DATABASE_URL`, the service uses memory. Copy `.env.example` values into the process manager or service environment; the example intentionally does not load `.env` files itself.

For PostgreSQL:

```bash
set DATABASE_URL=postgresql://pdfme:secret@localhost:5432/pdfme
npm start
```

The service creates its reference tables and queue index on startup. Production systems should move that SQL into their normal migration mechanism. Files are written beneath `PDF_OUTPUT_DIR` and only the resolved server path is stored in the job record.

Configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `3001` | HTTP port |
| `API_TOKEN` | empty | Static development bearer token; use OAuth/XSUAA in production |
| `DATABASE_URL` | empty | Enables PostgreSQL templates and durable jobs |
| `PDF_OUTPUT_DIR` | `./output` | Generated file directory |
| `WORKER_ENABLED` | `true` | Allows API-only and worker-only process separation |
| `MAX_ATTEMPTS` | `3` | Job attempts before `FAILED` |
| `POLL_INTERVAL_MS` | `1000` | Queue polling interval |
| `BODY_LIMIT_BYTES` | `5000000` | Maximum JSON request size |
| `CORS_ORIGIN` | empty | One allowed browser origin; prefer a same-origin approuter |

Run API and workers independently by starting one instance with `WORKER_ENABLED=false` and one or more internal instances with `WORKER_ENABLED=true`. PostgreSQL claiming uses `FOR UPDATE SKIP LOCKED`, so only one worker owns a job.

## Docker

Memory mode:

```bash
cd examples/deferred/docker
docker compose up --build
```

Durable PostgreSQL mode:

```bash
docker compose -f compose.yaml -f compose.postgres.yaml up --build
```

Copy `.env.example` to `.env` and replace both secrets before exposing the service. The base compose file persists generated PDFs in `pdf-output`; the PostgreSQL override adds `postgres-data` and supplies `DATABASE_URL` to the worker.

The image runs as a non-root user and exposes port 3001. For Kyma/Kubernetes, translate the environment variables, health check `/health`, PDF volume/Object Store binding, Secret and Deployment into the corresponding manifests. Scale replicas only with PostgreSQL enabled.

## CAP Node.js on SAP BTP

The reference application is [`examples/deferred/cap`](../examples/deferred/cap/README.md). Locally:

```bash
cd examples/deferred/cap
npm install
npm run watch
```

It exposes OData V4 at `/odata/v4/pdf-generation`, stores templates/jobs in CAP entities, and queues `RenderRequested` with the CAP persistent event queue. `runAt` uses queue scheduling. The development profile stores the generated binary in SQLite/HANA for a compact runnable example.

For BTP, generate deployment descriptors with the installed CAP version:

```bash
npx cds add hana
npx cds add xsuaa
npx cds add mta
npm install
npx cds build --production
mbt build
cf deploy mta_archives/*.mtar
```

Map `PdfViewer`, `PdfGenerator`, and `TemplateEditor` scopes to role collections. Replace mocked authentication and the inline `payload.data` loader. For large or long-retained output, store the PDF in SAP Object Store or Document Management and persist only the object key, checksum, media type, retention date and owning tenant in `GenerationJobs`.

CAP persistent queues are the default here. Do not replace them with `cds.spawn` for important documents: detached in-memory work can be lost on a crash and every scaled application instance may run it.

## Create or publish a template

The Node/Docker API accepts the same template/mapping objects as the studio:

```http
PUT /api/templates/sales-order
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Sales order",
  "status": "published",
  "template": { "basePdf": { "width": 210, "height": 297, "padding": [10,10,10,10] }, "schemas": [[]] },
  "mapping": { "fields": { "orderNumber": "order.number" } },
  "metadata": { "dataContractVersion": "1" }
}
```

In production, publish immutable versions rather than updating a record already referenced by a job. A queued job must retain `templateVersion`; reprocessing should use that exact version.

## Fiori consumption

### REST service behind an approuter

Configure a destination and route `/pdf-api/*` to the Node/Docker service. Keep OAuth tokens in the approuter/destination; do not embed the example `API_TOKEN` in browser code.

```javascript
async function requestPdf(order) {
  const response = await fetch("/pdf-api/api/pdf-jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `sales-order-${order.SalesOrder}-${order.ChangedAt}`
    },
    body: JSON.stringify({
      templateId: "sales-order",
      filename: `order-${order.SalesOrder}.pdf`,
      payload: { data: { order } }
    })
  });
  if (!response.ok) throw new Error((await response.json()).error);
  return response.json();
}

async function waitForPdf(job, signal) {
  while (!signal?.aborted) {
    const response = await fetch(`/pdf-api${job.statusUrl}`, { signal });
    const state = await response.json();
    if (state.status === "DONE") return `/pdf-api${job.contentUrl}`;
    if (state.status === "FAILED") throw new Error(state.errorMessage || "PDF generation failed");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new DOMException("Cancelled", "AbortError");
}
```

Use a UI5 busy indicator only during submission. After `202`, show the job in a message popover or job list so the user may navigate away. Open the final URL or fetch it as a Blob for download.

### CAP OData V4 action

With a propagated OData V4 model named `pdfJobs`:

```javascript
var action = this.getView().getModel("pdfJobs").bindContext("/enqueue(...)");
action.setParameter("templateID", "sales-order");
action.setParameter("payloadJson", JSON.stringify({ data: { order: order } }));
action.setParameter("filename", "order-" + order.SalesOrder + ".pdf");
action.setParameter("runAt", null);
action.setParameter("idempotencyKey", "sales-order-" + order.SalesOrder);
await action.execute();
var job = action.getBoundContext().getObject();
```

Read `/Jobs(<job-id>)` until terminal status. The example `download` OData action returns `Edm.Binary`; decode the returned base64 to a Blob. A production CAP application may instead expose an authorized media endpoint or a short-lived Object Store URL.

## ABAP consumption

Create an SM59 HTTP destination for classic ABAP, or a Communication Arrangement/destination appropriate to ABAP Cloud. Point it to the API gateway/approuter, not directly to the database or an internal worker port.

Classic ABAP request outline:

```abap
DATA: lo_client TYPE REF TO if_http_client,
      lv_body   TYPE string,
      lv_result TYPE string.

cl_http_client=>create_by_destination(
  EXPORTING destination = 'Z_PDFME_API'
  IMPORTING client      = lo_client ).

lo_client->request->set_method( if_http_request=>co_request_method_post ).
lo_client->request->set_header_field( name = 'Content-Type' value = 'application/json' ).
lo_client->request->set_header_field(
  name  = 'Idempotency-Key'
  value = |billing-{ lv_vbeln }-{ lv_template_version }| ).

lv_body = /ui2/cl_json=>serialize( data = VALUE ty_job_request(
  templateId = 'billing-document'
  filename   = |invoice-{ lv_vbeln }.pdf|
  payload    = VALUE #( businessObject = 'BillingDocument' businessKey = lv_vbeln ) ) ).
lo_client->request->set_cdata( lv_body ).
lo_client->send( ).
lo_client->receive( ).

IF lo_client->response->get_status( )-code <> 202.
  RAISE EXCEPTION TYPE zcx_pdf_generation.
ENDIF.
lv_result = lo_client->response->get_cdata( ).
```

Deserialize the returned job ID, commit it with the SAP business record, and let a background job poll status. Do not hold a dialog work process in a sleep loop. When `DONE`, download `contentUrl` as `xstring` and store it through ArchiveLink, DMS/GOS or the application's approved document repository. Treat `FAILED` as an application-log entry with retry or operator handling.

For ABAP-originated jobs, prefer sending only `businessObject`/`businessKey`. The Node/CAP data loader then calls an allowlisted SAP API with a technical destination and rechecks authorization/tenant context.

## Security and operations

- Accept only published, authorized and versioned templates.
- Never execute arbitrary source URLs, loaders, formatters or plugins supplied in a job request.
- The reference renderer rejects remote `basePdf` URLs; use an embedded PDF data URI or an approved server-side asset loader.
- Bound request size, mapped input count, image size, generation time, retries and output retention.
- Partition templates, jobs and object keys by tenant/owner. Never rely on UI filters for authorization.
- Use XSUAA/OAuth2, mTLS or a gateway in production. The static bearer token is a local/isolated deployment convenience.
- Keep job payloads free of secrets. Minimize or encrypt personal data and delete it according to retention policy.
- Record job ID, template ID/version, business key, requester, timestamps, checksum and final state in application logs; never log the complete payload or PDF.
- Monitor queue age, failure rate, render duration, output size, dead letters and storage capacity.

## Validation

1. Publish a template and enqueue a job with representative data.
2. Confirm the request returns before generation completes and survives client navigation.
3. Restart the worker while a PostgreSQL/CAP job is queued and confirm it resumes.
4. Run two workers and prove one PDF is produced for one idempotency key.
5. Verify `runAt`, retry exhaustion, `FAILED`, download authorization and retention cleanup.
6. Generate long tables, images, Unicode fonts and multi-document `mapping.repeat` inputs.
7. Confirm the output begins with `%PDF-` and can be opened by an independent PDF reader.
