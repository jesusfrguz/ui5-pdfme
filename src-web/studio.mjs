import { Designer } from "@pdfme/ui";
import { generate } from "@pdfme/generator";
import * as schemas from "@pdfme/schemas";
import { checkTemplate } from "@pdfme/common";
import { DataResolver, MappingEngine, flattenData } from "./core.mjs";

const labels = {
  en: { title: "Print form designer", data: "Data fields", hint: "Click a field to add it to the template", refresh: "Refresh data", save: "Save template", preview: "PDF preview", download: "Download PDF", print: "Print", close: "Close" },
  es: { title: "Diseñador de formularios de impresión", data: "Campos de datos", hint: "Selecciona un campo para añadirlo a la plantilla", refresh: "Actualizar datos", save: "Guardar plantilla", preview: "Vista previa PDF", download: "Descargar PDF", print: "Imprimir", close: "Cerrar" }
};

const styles = `
.pdfme-web-studio{--p:#0a6ed1;--b:#d9d9d9;--bg:#f5f6f7;font:14px/1.4 Arial,sans-serif;color:#1d2d3e;border:1px solid var(--b);border-radius:12px;overflow:hidden;background:#fff;min-height:640px}.pdfme-web-toolbar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fff;border-bottom:1px solid var(--b);position:sticky;top:0;z-index:3}.pdfme-web-title{font-size:18px;font-weight:700;margin-right:auto}.pdfme-web-button{border:1px solid #bcc3ca;border-radius:8px;background:#fff;color:#17324d;padding:8px 11px;cursor:pointer;font-weight:600}.pdfme-web-button:hover{background:#eaf3fc;border-color:var(--p)}.pdfme-web-button.primary{background:var(--p);color:#fff;border-color:var(--p)}.pdfme-web-layout{display:grid;grid-template-columns:minmax(220px,290px) minmax(0,1fr);height:calc(100% - 58px);min-height:580px}.pdfme-web-sidebar{background:var(--bg);border-right:1px solid var(--b);padding:16px;overflow:auto}.pdfme-web-sidebar h3{margin:0 0 4px}.pdfme-web-hint{color:#526b82;margin:0 0 14px}.pdfme-web-fields{display:grid;gap:7px}.pdfme-web-field{text-align:left;background:#fff;border:1px solid #d6dadd;border-radius:8px;padding:9px;cursor:pointer;overflow:hidden}.pdfme-web-field:hover{border-color:var(--p);box-shadow:0 1px 5px #0a6ed122}.pdfme-web-field strong,.pdfme-web-field small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdfme-web-field small{color:#60778b;margin-top:2px}.pdfme-web-designer{min-width:0;overflow:auto;background:#e9edf0}.pdfme-web-busy{opacity:.58;pointer-events:none}.pdfme-web-dialog{border:0;border-radius:12px;padding:0;width:min(1100px,94vw);height:min(850px,90vh);box-shadow:0 20px 70px #0005}.pdfme-web-dialog::backdrop{background:#10253c88}.pdfme-web-dialog header{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--b);font-weight:700}.pdfme-web-dialog header button{margin-left:auto}.pdfme-web-dialog iframe{width:100%;height:calc(100% - 58px);border:0}@media(max-width:800px){.pdfme-web-layout{grid-template-columns:1fr}.pdfme-web-sidebar{max-height:230px;border-right:0;border-bottom:1px solid var(--b)}.pdfme-web-toolbar{flex-wrap:wrap}.pdfme-web-title{width:100%}}
`;

export function createBlankTemplate() {
  return { basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] }, schemas: [[]] };
}

export function createDefaultPlugins() {
  return {
    Text: schemas.text, MultiVariableText: schemas.multiVariableText, Table: schemas.table,
    List: schemas.list, Image: schemas.image, Signature: schemas.signature, SVG: schemas.svg,
    Line: schemas.line, Rectangle: schemas.rectangle, Ellipse: schemas.ellipse, Date: schemas.date,
    DateTime: schemas.dateTime, Time: schemas.time, Select: schemas.select,
    RadioGroup: schemas.radioGroup, Checkbox: schemas.checkbox, CircleMark: schemas.circleMark,
    QRCode: schemas.barcodes.qrcode, Code128: schemas.barcodes.code128,
    EAN13: schemas.barcodes.ean13, DataMatrix: schemas.barcodes.gs1datamatrix, PDF417: schemas.barcodes.pdf417
  };
}

function ensureStyles() {
  if (document.querySelector("style[data-pdfme-web]")) return;
  const style = document.createElement("style");
  style.dataset.pdfmeWeb = "true";
  style.textContent = styles;
  document.head.append(style);
}

function uniqueName(template, path) {
  const base = String(path).replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "") || "field";
  const names = new Set((template.schemas || []).flat().map(({ name }) => name));
  let name = base;
  let suffix = 2;
  while (names.has(name)) name = `${base}_${suffix++}`;
  return name;
}

export class WebPdfTemplateStudio {
  constructor(target, configuration = {}) {
    this.root = typeof target === "string" ? document.querySelector(target) : target;
    if (!(this.root instanceof HTMLElement)) throw new TypeError("A target HTMLElement or selector is required");
    this.resolver = new DataResolver();
    this.mapper = new MappingEngine();
    this.loaders = {};
    this.autoMappings = {};
    this.plugins = { ...createDefaultPlugins(), ...(configuration.plugins || {}) };
    this.configure({ template: createBlankTemplate(), dataSources: [], mapping: null, filename: "document.pdf", language: "en", autoResolve: true, ...configuration }, false);
    this.render();
    if (this.configuration.autoResolve) this.refreshData().catch(() => {});
  }

  configure(configuration = {}, refresh = true) {
    this.configuration = { ...(this.configuration || {}), ...configuration };
    if (configuration.template) this.template = structuredClone(configuration.template);
    if (configuration.dataSources) this.dataSources = configuration.dataSources;
    if (Object.hasOwn(configuration, "mapping")) this.mapping = configuration.mapping;
    this.filename = this.configuration.filename || "document.pdf";
    this.language = labels[this.configuration.language] ? this.configuration.language : "en";
    this.inputs = null;
    if (refresh && this.designer && configuration.template) this.designer.updateTemplate(this.template);
    if (refresh && this.designer && configuration.dataSources && this.configuration.autoResolve) this.refreshData().catch(() => {});
    return this;
  }

  render() {
    ensureStyles();
    const t = labels[this.language];
    this.root.innerHTML = `<section class="pdfme-web-studio"><div class="pdfme-web-toolbar"><span class="pdfme-web-title">${t.title}</span><button data-action="refreshData" class="pdfme-web-button">${t.refresh}</button><button data-action="save" class="pdfme-web-button">${t.save}</button><button data-action="preview" class="pdfme-web-button primary">${t.preview}</button><button data-action="download" class="pdfme-web-button">${t.download}</button><button data-action="print" class="pdfme-web-button">${t.print}</button></div><div class="pdfme-web-layout"><aside class="pdfme-web-sidebar"><h3>${t.data}</h3><p class="pdfme-web-hint">${t.hint}</p><div class="pdfme-web-fields"></div></aside><main class="pdfme-web-designer"></main></div></section>`;
    this.element = this.root.firstElementChild;
    this.fieldList = this.root.querySelector(".pdfme-web-fields");
    const designerRoot = this.root.querySelector(".pdfme-web-designer");
    this.designer = new Designer({ domContainer: designerRoot, template: this.template, plugins: this.plugins, options: { lang: this.language, ...(this.configuration.designerOptions || {}) } });
    this.designer.onChangeTemplate?.((template) => { this.template = template; this.emit("templateChange", { template }); });
    this.designer.onSaveTemplate?.((template) => { this.template = template; this.emit("templateSave", { template }); });
    this.root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => this[button.dataset.action]().catch?.((error) => this.handleError(button.dataset.action, error))));
  }

  emit(name, detail) {
    this.root.dispatchEvent(new CustomEvent(`pdfme:${name}`, { detail }));
    this.configuration[`on${name[0].toUpperCase()}${name.slice(1)}`]?.(detail);
  }

  registerDataProvider(type, provider) { this.resolver.registry.register(type, provider); return this; }
  registerLoader(name, loader) { this.loaders[name] = loader; return this; }
  registerFormatter(name, formatter) { this.mapper.registerFormatter(name, formatter); return this; }
  getTemplate() { return this.designer?.getTemplate() || this.template; }
  getResolvedData() { return this.resolvedData; }
  getInputs() { return this.inputs; }

  mappingDefinition() {
    const defaults = {};
    (this.getTemplate()?.schemas || []).flat().forEach((schema) => { if (!schema.readOnly) defaults[schema.name] = schema.name; });
    Object.assign(defaults, this.autoMappings);
    if (!this.mapping) return { fields: defaults };
    return { ...this.mapping, fields: { ...defaults, ...(this.mapping.fields || this.mapping) } };
  }

  async refreshData() {
    this.setBusy(true);
    try {
      this.resolvedData = await this.resolver.resolve(this.dataSources || [], { loaders: this.loaders, fetch: this.configuration.fetch, signal: this.configuration.signal });
      this.inputs = this.mapper.mapInputs(this.resolvedData, this.mappingDefinition());
      this.renderFields();
      this.emit("dataResolved", { data: this.resolvedData, inputs: this.inputs });
      return this.resolvedData;
    } catch (error) { this.handleError("resolve", error); throw error; }
    finally { this.setBusy(false); }
  }

  renderFields() {
    this.fieldList.replaceChildren(...flattenData(this.resolvedData).map((field) => {
      const button = document.createElement("button");
      button.className = "pdfme-web-field";
      const preview = field.kind === "array" ? `${field.value.length} entries` : String(field.value ?? "");
      const name = document.createElement("strong");
      const sample = document.createElement("small");
      name.textContent = field.path;
      sample.textContent = preview.slice(0, 90);
      button.append(name, sample);
      button.addEventListener("click", () => this.insertDataField(field.path, field.value));
      return button;
    }));
  }

  insertDataField(path, sampleValue) {
    const template = this.getTemplate() || createBlankTemplate();
    const page = this.designer?.getPageCursor?.() || 0;
    template.schemas[page] ||= [];
    const name = uniqueName(template, path);
    const row = template.schemas[page].length;
    if (Array.isArray(sampleValue)) {
      const first = sampleValue[0];
      const columns = first && typeof first === "object" && !Array.isArray(first) ? Object.keys(first) : [];
      const matrix = columns.length ? sampleValue.map((record) => columns.map((column) => String(record[column] ?? ""))) : sampleValue.map((value) => [String(value)]);
      template.schemas[page].push({ name, type: "table", position: { x: 20, y: 20 + (row % 10) * 18 }, width: 170, height: 35, content: JSON.stringify(matrix), showHead: true, head: columns.length ? columns : ["Value"], headWidthPercentages: new Array(columns.length || 1).fill(100 / (columns.length || 1)), tableStyles: { borderWidth: 0.3, borderColor: "#89919a" }, headStyles: { alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1, characterSpacing: 0, fontColor: "#fff", backgroundColor: "#0a6ed1", borderColor: "", borderWidth: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, bodyStyles: { alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1, characterSpacing: 0, fontColor: "#000", backgroundColor: "", alternateBackgroundColor: "#f5f5f5", borderColor: "#888", borderWidth: { top: .1, right: .1, bottom: .1, left: .1 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, columnStyles: {} });
      this.autoMappings[name] = { path, formatter: "table", options: { columns } };
    } else {
      template.schemas[page].push({ name, type: "text", position: { x: 20 + (row % 2) * 90, y: 20 + (row % 20) * 12 }, width: 75, height: 10, fontSize: 12, content: typeof sampleValue === "object" ? JSON.stringify(sampleValue) : String(sampleValue ?? "") });
      this.autoMappings[name] = path;
    }
    this.template = template;
    this.designer?.updateTemplate(template);
    if (this.resolvedData) this.inputs = this.mapper.mapInputs(this.resolvedData, this.mappingDefinition());
    this.emit("fieldInsert", { fieldName: name, path });
    return name;
  }

  save() { this.designer?.saveTemplate?.(); return Promise.resolve(this.getTemplate()); }

  async generate() {
    this.setBusy(true);
    try {
      if (!this.inputs) await this.refreshData();
      const template = this.getTemplate();
      checkTemplate(template);
      const bytes = await generate({ template, inputs: this.inputs || [{}], plugins: this.plugins, options: this.configuration.generatorOptions || {} });
      this.emit("generated", { bytes, blob: new Blob([bytes], { type: "application/pdf" }) });
      return bytes;
    } catch (error) { this.handleError("generate", error); throw error; }
    finally { this.setBusy(false); }
  }

  async preview() {
    const bytes = await this.generate();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const dialog = document.createElement("dialog");
    dialog.className = "pdfme-web-dialog";
    dialog.innerHTML = `<header>${labels[this.language].preview}<button class="pdfme-web-button">${labels[this.language].close}</button></header><iframe title="PDF preview"></iframe>`;
    dialog.querySelector("iframe").src = url;
    const close = () => { URL.revokeObjectURL(url); dialog.remove(); };
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", close, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    return bytes;
  }

  async download() {
    const bytes = await this.generate();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const anchor = Object.assign(document.createElement("a"), { href: url, download: this.filename });
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return bytes;
  }

  async print() {
    const bytes = await this.generate();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const frame = Object.assign(document.createElement("iframe"), { src: url, hidden: true });
    document.body.append(frame);
    frame.addEventListener("load", () => { frame.contentWindow?.print(); setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 30000); }, { once: true });
    return bytes;
  }

  setBusy(busy) { this.element?.classList.toggle("pdfme-web-busy", busy); }
  handleError(operation, error) { this.emit("error", { operation, error }); }
  destroy() { this.designer?.destroy(); this.root.replaceChildren(); }
}
