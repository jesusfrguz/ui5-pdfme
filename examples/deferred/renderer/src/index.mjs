import { DataResolver, MappingEngine, generatePdf } from "ui5-pdfme";

const MAX_INPUTS = 10_000;

export function parseJson(value, fallback = null) {
  if (value == null || value === "") return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}

export function validatePublishedTemplate(record) {
  if (!record || typeof record !== "object") throw new TypeError("Template record is required");
  if (record.status && record.status !== "published") throw new Error(`Template ${record.id || ""} is not published`);
  const template = parseJson(record.template ?? record.templateJson);
  if (!template || !Array.isArray(template.schemas)) throw new TypeError("TemplateJson must contain a pdfme schemas array");

  // Deferred workers must never turn a user-controlled URL into an outbound request.
  if (typeof template.basePdf === "string" && !template.basePdf.startsWith("data:application/pdf;")) {
    throw new Error("Remote basePdf URLs are not accepted by the deferred renderer");
  }
  return {
    template,
    mapping: parseJson(record.mapping ?? record.mappingJson, {}) || {},
    version: Number(record.version ?? 1)
  };
}

export async function createInputs({ mapping, payload, dataSources, loaders, formatters, fetch: fetchImpl, loadData }) {
  if (Array.isArray(payload?.inputs)) {
    if (!payload.inputs.length || payload.inputs.length > MAX_INPUTS) throw new Error(`inputs must contain 1 to ${MAX_INPUTS} records`);
    return payload.inputs;
  }

  let data = payload?.data;
  if (data == null && typeof loadData === "function") data = await loadData(payload);
  if (data == null && Array.isArray(dataSources)) {
    data = await new DataResolver().resolve(dataSources, { loaders, fetch: fetchImpl });
  }
  if (data == null) throw new Error("The job requires data, inputs, or a configured backend data loader");

  const inputs = new MappingEngine(formatters).mapInputs(data, mapping || {});
  if (!inputs.length || inputs.length > MAX_INPUTS) throw new Error(`mapping produced an invalid number of inputs (${inputs.length})`);
  return inputs;
}

export async function renderDeferredPdf({ record, payload = {}, dataSources, loaders, formatters, fetch, loadData, generatorOptions }) {
  const { template, mapping, version } = validatePublishedTemplate(record);
  const inputs = await createInputs({ mapping, payload, dataSources, loaders, formatters, fetch, loadData });
  const bytes = await generatePdf({ template, inputs, options: generatorOptions || payload.generatorOptions || {} });
  if (!(bytes instanceof Uint8Array) || bytes.length < 5 || Buffer.from(bytes).subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("The renderer did not produce a valid PDF byte stream");
  }
  return { bytes, templateVersion: version, inputCount: inputs.length };
}
