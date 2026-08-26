import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderDeferredPdf } from "ui5-pdfme-deferred-renderer";
import { config } from "./config.mjs";
import { createStore } from "./store.mjs";

const store = await createStore(config.databaseUrl);
await store.initialize();
await mkdir(config.outputDir, { recursive: true });

function authorized(request) {
  if (!config.apiToken) return true;
  const supplied = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const expected = Buffer.from(config.apiToken);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > config.bodyLimit) throw Object.assign(new Error("Payload too large"), { status: 413 });
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function headers(extra = {}) {
  return { "content-type": "application/json; charset=utf-8", ...(config.corsOrigin ? { "access-control-allow-origin": config.corsOrigin } : {}), ...extra };
}
function send(response, status, body, extra = {}) {
  response.writeHead(status, headers(extra));
  response.end(body == null ? "" : JSON.stringify(body));
}
const safeId = (value) => /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/.test(value || "");
const safeFilename = (value) => String(value || "document.pdf").replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 255) || "document.pdf";

async function processOneJob() {
  const job = await store.claimNextJob();
  if (!job) return false;
  try {
    const record = await store.getTemplate(job.templateId);
    if (!record) throw new Error(`Template not found: ${job.templateId}`);
    if (Number(record.version) !== Number(job.templateVersion)) throw new Error(`Template version ${job.templateVersion} is no longer available`);
    const result = await renderDeferredPdf({ record, payload: job.payload });
    const resultPath = path.resolve(config.outputDir, `${job.id}.pdf`);
    if (path.dirname(resultPath) !== config.outputDir) throw new Error("Invalid output path");
    await writeFile(resultPath, result.bytes);
    await store.completeJob(job.id, { resultPath, templateVersion: result.templateVersion, inputCount: result.inputCount });
  } catch (error) {
    const retry = job.attempts < job.maxAttempts;
    await store.failJob(job.id, String(error?.message || error).slice(0, 4000), retry);
  }
  return true;
}

let workerBusy = false;
const workerTimer = config.workerEnabled ? setInterval(async () => {
  if (workerBusy) return;
  workerBusy = true;
  try { while (await processOneJob()) {} }
  catch (error) { console.error("Deferred worker error", error); }
  finally { workerBusy = false; }
}, config.pollInterval) : null;
workerTimer?.unref();

const server = createServer(async (request, response) => {
  try {
    if (!authorized(request)) return send(response, 401, { error: "Unauthorized" }, { "www-authenticate": "Bearer" });
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (request.method === "OPTIONS" && config.corsOrigin) return send(response, 204, null, { "access-control-allow-methods": "GET,POST,PUT,OPTIONS", "access-control-allow-headers": "authorization,content-type,idempotency-key" });
    if (request.method === "GET" && url.pathname === "/health") return send(response, 200, { status: "UP", storage: config.databaseUrl ? "postgresql" : "memory", worker: config.workerEnabled });

    if (request.method === "GET" && url.pathname === "/api/templates") return send(response, 200, { items: await store.listTemplates() });
    const templateMatch = url.pathname.match(/^\/api\/templates\/([^/]+)$/);
    if (templateMatch && request.method === "GET") {
      const record = await store.getTemplate(decodeURIComponent(templateMatch[1]));
      return record ? send(response, 200, record) : send(response, 404, { error: "Template not found" });
    }
    if (templateMatch && request.method === "PUT") {
      const id = decodeURIComponent(templateMatch[1]);
      const input = await readJson(request);
      if (!safeId(id)) return send(response, 400, { error: "Invalid template id" });
      if (typeof input.name !== "string" || !input.name.trim() || !["draft", "published", "archived"].includes(input.status) || !Array.isArray(input.template?.schemas)) {
        return send(response, 400, { error: "name, a valid status, and template.schemas are required" });
      }
      const current = await store.getTemplate(id);
      if (current?.status === "published") return send(response, 409, { error: "Published templates are immutable; publish a new template id/version" });
      return send(response, 200, await store.saveTemplate({ id, name: input.name.trim(), status: input.status, template: input.template, mapping: input.mapping || {}, metadata: input.metadata || {} }));
    }

    if (request.method === "POST" && url.pathname === "/api/pdf-jobs") {
      const input = await readJson(request);
      if (!safeId(input.templateId)) return send(response, 400, { error: "A valid templateId is required" });
      const template = await store.getTemplate(input.templateId);
      if (!template) return send(response, 404, { error: "Template not found" });
      if (template.status !== "published") return send(response, 409, { error: "Only published templates can be queued" });
      if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) return send(response, 400, { error: "payload must be a JSON object" });
      const idempotencyKey = String(request.headers["idempotency-key"] || input.idempotencyKey || "").slice(0, 128) || null;
      const existing = await store.findJobByIdempotencyKey(idempotencyKey);
      if (existing) return send(response, 200, existing);
      const runAt = input.runAt ? new Date(input.runAt) : new Date();
      if (!Number.isFinite(runAt.getTime())) return send(response, 400, { error: "runAt must be an RFC 3339 timestamp" });
      const job = await store.createJob({ templateId: input.templateId, templateVersion: template.version, payload: input.payload, filename: safeFilename(input.filename), runAt: runAt.toISOString(), maxAttempts: config.maxAttempts, idempotencyKey, requestedBy: request.headers["x-user-id"] || null });
      return send(response, 202, { ...job, statusUrl: `/api/pdf-jobs/${job.id}`, contentUrl: `/api/pdf-jobs/${job.id}/content` }, { location: `/api/pdf-jobs/${job.id}` });
    }
    const contentMatch = url.pathname.match(/^\/api\/pdf-jobs\/([0-9a-f-]+)\/content$/i);
    if (contentMatch && request.method === "GET") {
      const job = await store.getJob(contentMatch[1]);
      const resultPath = await store.getResultPath(contentMatch[1]);
      if (!job) return send(response, 404, { error: "Job not found" });
      if (job.status !== "DONE" || !resultPath) return send(response, 409, { error: "PDF is not ready", status: job.status });
      const bytes = await readFile(resultPath);
      response.writeHead(200, { "content-type": "application/pdf", "content-length": bytes.length, "content-disposition": `attachment; filename="${safeFilename(job.filename)}"`, ...(config.corsOrigin ? { "access-control-allow-origin": config.corsOrigin } : {}) });
      return response.end(bytes);
    }
    const jobMatch = url.pathname.match(/^\/api\/pdf-jobs\/([0-9a-f-]+)$/i);
    if (jobMatch && request.method === "GET") {
      const job = await store.getJob(jobMatch[1]);
      return job ? send(response, 200, job) : send(response, 404, { error: "Job not found" });
    }
    return send(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 400, { error: error.message || "Request failed" });
  }
});

server.listen(config.port, config.host, () => console.log(`Deferred PDF API: http://${config.host}:${config.port}`));
async function shutdown() {
  if (workerTimer) clearInterval(workerTimer);
  server.close();
  await store.close();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
