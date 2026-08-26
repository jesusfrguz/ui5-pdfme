const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("deferred generation manual covers every requested deployment and SAP consumer", () => {
  const manual = read("agents/DEFERRED_GENERATION.md");
  const web = read("docs/deferred/index.html");
  for (const term of ["CAP Node.js", "Docker", "PostgreSQL", "Plain Node.js", "Fiori", "SAP BTP", "ABAP", "Idempotency-Key", "Object Store"]) {
    assert.ok(manual.includes(term), `manual is missing ${term}`);
  }
  for (const id of ["arquitectura", "contrato", "node", "docker", "cap", "fiori", "abap", "seguridad", "codigo"]) {
    assert.match(web, new RegExp(`<section id="${id}">`));
  }
});

test("deferred examples expose a durable job contract and optional database", () => {
  const server = read("examples/deferred/node/src/server.mjs");
  const store = read("examples/deferred/node/src/store.mjs");
  const renderer = read("examples/deferred/renderer/src/index.mjs");
  const compose = read("examples/deferred/docker/compose.yaml");
  const postgres = read("examples/deferred/docker/compose.postgres.yaml");

  assert.match(server, /POST" && url\.pathname === "\/api\/pdf-jobs"/);
  assert.match(server, /statusUrl/);
  assert.match(server, /contentUrl/);
  assert.match(store, /FOR UPDATE SKIP LOCKED/);
  assert.match(store, /idempotency_key varchar\(128\) UNIQUE/);
  assert.match(renderer, /Remote basePdf URLs are not accepted/);
  assert.match(renderer, /generatePdf/);
  assert.match(compose, /pdf-output/);
  assert.match(postgres, /DATABASE_URL/);
});

test("CAP example uses queueing, scheduling, roles, and a UI-free renderer", () => {
  const service = read("examples/deferred/cap/srv/pdf-generation-service.js");
  const model = read("examples/deferred/cap/srv/pdf-generation-service.cds");
  assert.match(service, /cds\.queued\(this\)/);
  assert.match(service, /\.schedule\("RenderRequested"/);
  assert.match(service, /renderDeferredPdf/);
  assert.match(model, /action enqueue/);
  assert.match(model, /event RenderRequested/);
  for (const role of ["PdfViewer", "PdfGenerator", "TemplateEditor"]) assert.ok(model.includes(role));
});

test("memory store claims a scheduled job exactly once", async () => {
  const { MemoryStore } = await import(pathToFileURL(path.join(root, "examples/deferred/node/src/store.mjs")));
  const store = new MemoryStore();
  const template = await store.saveTemplate({ id: "invoice", name: "Invoice", status: "published", template: { schemas: [] }, mapping: {} });
  const job = await store.createJob({ templateId: template.id, templateVersion: template.version, payload: { inputs: [{}] }, filename: "invoice.pdf", runAt: new Date(0).toISOString(), maxAttempts: 3 });
  const claimed = await store.claimNextJob();
  assert.equal(claimed.id, job.id);
  assert.equal(claimed.status, "RUNNING");
  assert.equal(claimed.attempts, 1);
  assert.equal(await store.claimNextJob(), null);
});
