"use strict";

const cds = require("@sap/cds");
const { randomUUID } = require("node:crypto");
const { SELECT, INSERT, UPDATE } = cds.ql;

const safeFilename = (value) => String(value || "document.pdf").replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 255) || "document.pdf";
const parsePayload = (value) => {
  const parsed = value ? JSON.parse(value) : {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("payloadJson must contain a JSON object");
  return parsed;
};
const binaryBuffer = async (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value && typeof value[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of value) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  throw new TypeError("Stored PDF binary is not readable");
};

module.exports = class PdfGenerationService extends cds.ApplicationService {
  async init() {
    const { Templates, Jobs } = this.entities;
    const { GenerationJobs } = cds.entities("ui5.pdfme.deferred");
    const queued = cds.queued(this);

    this.before(["CREATE", "UPDATE"], Templates, (request) => {
      const data = request.data;
      if (data.Status && !["draft", "published", "archived"].includes(data.Status)) request.reject(400, "Status must be draft, published, or archived");
      if (data.TemplateJson) {
        const template = JSON.parse(data.TemplateJson);
        if (!Array.isArray(template?.schemas)) request.reject(400, "TemplateJson must contain a pdfme schemas array");
      }
    });

    this.before("UPDATE", Templates, async (request) => {
      const ID = request.data.ID || request.params?.find((parameter) => parameter?.ID)?.ID;
      if (!ID) return request.reject(400, "Template ID is required for updates");
      const current = await SELECT.one.from(Templates).where({ ID });
      if (!current) return request.reject(404, `Template not found: ${ID}`);
      if (current.Status === "published") return request.reject(409, "Published templates are immutable; create a new ID/version");
      request.data.Version = Number(current.Version) + 1;
    });

    this.on("enqueue", async (request) => {
      const { templateID, payloadJson, filename, runAt, idempotencyKey } = request.data;
      if (!templateID) return request.reject(400, "templateID is required");
      parsePayload(payloadJson);
      const template = await SELECT.one.from(Templates).where({ ID: templateID });
      if (!template) return request.reject(404, `Template not found: ${templateID}`);
      if (template.Status !== "published") return request.reject(409, "Only published templates can be queued");
      if (idempotencyKey) {
        const existing = await SELECT.one.from(Jobs).where({ IdempotencyKey: idempotencyKey });
        if (existing) return existing;
      }
      const date = runAt ? new Date(runAt) : new Date();
      if (!Number.isFinite(date.getTime())) return request.reject(400, "runAt must be a valid timestamp");
      const ID = randomUUID();
      await INSERT.into(GenerationJobs).entries({
        ID, TemplateID: templateID, TemplateVersion: template.Version, Status: "QUEUED", RunAt: date,
        PayloadJson: payloadJson || "{}", Filename: safeFilename(filename), IdempotencyKey: idempotencyKey || null,
        RequestedBy: request.user.id, MaxAttempts: 5
      });
      const delay = Math.max(0, date.getTime() - Date.now());
      if (delay > 0) await queued.schedule("RenderRequested", { jobID: ID }).after(delay).as(`pdf-${ID}`);
      else await queued.emit("RenderRequested", { jobID: ID });
      return SELECT.one.from(Jobs).where({ ID });
    });

    this.on("retry", async (request) => {
      const { jobID } = request.data;
      const job = await SELECT.one.from(GenerationJobs).where({ ID: jobID });
      if (!job) return request.reject(404, "Job not found");
      await UPDATE(GenerationJobs).set({ Status: "QUEUED", ErrorMessage: null, Attempts: 0, Result: null }).where({ ID: jobID });
      await queued.emit("RenderRequested", { jobID });
      return SELECT.one.from(Jobs).where({ ID: jobID });
    });

    this.on("download", async (request) => {
      const job = await SELECT.one.from(GenerationJobs).columns("Status", "Result").where({ ID: request.data.jobID });
      if (!job) return request.reject(404, "Job not found");
      if (job.Status !== "DONE" || !job.Result) return request.reject(409, `PDF is not ready (${job.Status})`);
      return (await binaryBuffer(job.Result)).toString("base64");
    });

    this.on("RenderRequested", async (message) => {
      const ID = message.data.jobID;
      const job = await SELECT.one.from(GenerationJobs).where({ ID });
      if (!job || job.Status === "DONE") return;
      const attempt = Number(job.Attempts || 0) + 1;
      await UPDATE(GenerationJobs).set({ Status: "RUNNING", Attempts: attempt, ErrorMessage: null }).where({ ID });
      try {
        const template = await SELECT.one.from(Templates).where({ ID: job.TemplateID });
        if (!template) throw new Error(`Template not found: ${job.TemplateID}`);
        if (Number(template.Version) !== Number(job.TemplateVersion)) throw new Error(`Template version ${job.TemplateVersion} is no longer available`);
        const renderer = await import("ui5-pdfme-deferred-renderer");
        const payload = parsePayload(job.PayloadJson);
        const result = await renderer.renderDeferredPdf({
          record: { id: template.ID, status: template.Status, version: template.Version, templateJson: template.TemplateJson, mappingJson: template.MappingJson },
          payload,
          // Replace payload.data with a server-side loader based on payload.businessObject/businessKey in production.
          loadData: async () => payload.data
        });
        await UPDATE(GenerationJobs).set({
          Status: "DONE", TemplateVersion: result.templateVersion, InputCount: result.inputCount,
          Result: Buffer.from(result.bytes), MimeType: "application/pdf", ErrorMessage: null
        }).where({ ID });
      } catch (error) {
        const retry = attempt < Number(job.MaxAttempts || 5);
        await UPDATE(GenerationJobs).set({ Status: retry ? "QUEUED" : "FAILED", ErrorMessage: String(error.message || error).slice(0, 4000) }).where({ ID });
        if (retry) throw error;
      }
    });

    return super.init();
  }
};
