import { Designer } from "@pdfme/ui";
import { generate } from "@pdfme/generator";
import * as schemas from "@pdfme/schemas";
import { checkTemplate } from "@pdfme/common";
import { DataResolver, MappingEngine, flattenData } from "./core.mjs";

const labels = {
  en: { title: "Print form designer", shortTitle: "PDF designer", data: "Data fields", hint: "Select a field to add it to the template", search: "Search fields", empty: "No matching fields", refresh: "Refresh data", save: "Save template", preview: "PDF preview", download: "Download PDF", print: "Print", close: "Close" },
  es: { title: "Diseñador de formularios de impresión", shortTitle: "Editor PDF", data: "Campos de datos", hint: "Selecciona un campo para añadirlo a la plantilla", search: "Buscar campos", empty: "No hay campos coincidentes", refresh: "Actualizar datos", save: "Guardar plantilla", preview: "Vista previa PDF", download: "Descargar PDF", print: "Imprimir", close: "Cerrar" }
};

const icons = {
  data: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h10"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6.2 6.2L4 9m2 6a7 7 0 0 0 12.3 2.8L20 15"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6"/></svg>',
  preview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/></svg>',
  print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5h18v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
};

const styles = `
.pdfme-web-studio{--p:#0a6ed1;--p-hover:#085caf;--text:#172b3f;--muted:#5f7285;--line:#dce3e8;--surface:#fff;--surface-subtle:#f6f8fa;font:14px/1.4 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text);border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--surface);min-height:640px;box-shadow:0 8px 28px #17324d12;position:relative}.pdfme-web-studio *{box-sizing:border-box}.pdfme-web-toolbar{display:flex;align-items:center;gap:16px;min-height:60px;padding:10px 14px 10px 18px;background:#fffc;border-bottom:1px solid var(--line);position:relative;z-index:6;backdrop-filter:blur(12px)}.pdfme-web-title{font-size:17px;font-weight:700;letter-spacing:-.01em;line-height:1.2;margin-right:auto;white-space:nowrap}.pdfme-web-title-short{display:none}.pdfme-web-actions,.pdfme-web-sidebar-actions{display:flex;align-items:center;gap:7px}.pdfme-web-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;border:1px solid #c8d2da;border-radius:9px;background:var(--surface);color:#243b53;padding:7px 11px;cursor:pointer;font:600 13px/1 inherit;white-space:nowrap;transition:background-color .16s,border-color .16s,color .16s,box-shadow .16s,transform .16s}.pdfme-web-button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}.pdfme-web-button:hover{background:#edf6ff;border-color:#7ab7eb;color:#075b9e}.pdfme-web-button:active{transform:translateY(1px)}.pdfme-web-button:focus-visible,.pdfme-web-field:focus-visible,.pdfme-web-search input:focus-visible{outline:3px solid #0a6ed133;outline-offset:2px;border-color:var(--p)}.pdfme-web-button.primary{background:var(--p);color:#fff;border-color:var(--p);box-shadow:0 2px 7px #0a6ed133}.pdfme-web-button.primary:hover{background:var(--p-hover);border-color:var(--p-hover);color:#fff}.pdfme-web-button.icon-only{width:36px;min-height:36px;padding:0}.pdfme-web-data-toggle{display:none}.pdfme-web-layout{display:grid;grid-template-columns:272px minmax(0,1fr);height:calc(100% - 60px);min-height:580px;position:relative;transition:grid-template-columns .2s ease}.pdfme-web-studio.pdfme-web-data-collapsed .pdfme-web-layout{grid-template-columns:0 minmax(0,1fr)}.pdfme-web-sidebar{min-width:0;background:var(--surface-subtle);border-right:1px solid var(--line);padding:16px 14px;overflow:auto;z-index:4;transition:opacity .16s,transform .2s}.pdfme-web-data-collapsed .pdfme-web-sidebar{opacity:0;pointer-events:none;overflow:hidden}.pdfme-web-sidebar-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:3px}.pdfme-web-sidebar-title{min-width:0;margin-right:auto}.pdfme-web-sidebar h2{font-size:15px;line-height:1.3;margin:0}.pdfme-web-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;margin-left:5px;padding:0 6px;border-radius:99px;background:#e5ebf0;color:#526578;font-size:11px;font-weight:700;vertical-align:1px}.pdfme-web-close-data{display:none}.pdfme-web-hint{color:var(--muted);font-size:12px;margin:0 0 12px}.pdfme-web-search{display:flex;align-items:center;gap:7px;height:38px;margin-bottom:12px;padding:0 10px;border:1px solid #cfd8df;border-radius:9px;background:#fff;color:#698095}.pdfme-web-search:focus-within{border-color:var(--p);box-shadow:0 0 0 3px #0a6ed118}.pdfme-web-search svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;flex:0 0 auto}.pdfme-web-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font:inherit}.pdfme-web-search input::placeholder{color:#7a8b9a}.pdfme-web-fields{display:grid;gap:7px}.pdfme-web-field{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;text-align:left;background:#fff;border:1px solid #d7e0e6;border-radius:9px;padding:9px 10px;cursor:pointer;overflow:hidden;color:var(--text);transition:border-color .16s,box-shadow .16s,transform .16s}.pdfme-web-field::after{content:"+";grid-column:2;grid-row:1/3;align-self:center;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:7px;background:#edf3f7;color:#456278;font-size:17px;font-weight:400}.pdfme-web-field:hover{border-color:#83bce9;box-shadow:0 3px 10px #17324d12;transform:translateY(-1px)}.pdfme-web-field:hover::after{background:#dceeff;color:#075b9e}.pdfme-web-field strong,.pdfme-web-field small{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdfme-web-field strong{font-size:12.5px}.pdfme-web-field small{color:var(--muted);font-size:11.5px}.pdfme-web-empty{margin:22px 4px;color:var(--muted);font-size:12px;text-align:center}.pdfme-web-designer{min-width:0;overflow:auto;background:#e9edf0}.pdfme-web-backdrop{display:none}.pdfme-web-busy{cursor:progress}.pdfme-web-busy .pdfme-web-button,.pdfme-web-busy .pdfme-web-field{pointer-events:none}.pdfme-web-busy .pdfme-web-title::after{content:"";display:inline-block;width:12px;height:12px;margin-left:9px;border:2px solid #b8d6ef;border-top-color:var(--p);border-radius:50%;animation:pdfme-web-spin .7s linear infinite;vertical-align:-1px}@keyframes pdfme-web-spin{to{transform:rotate(360deg)}}.pdfme-web-dialog{border:0;border-radius:14px;padding:0;width:min(1100px,94vw);height:min(850px,90vh);box-shadow:0 20px 70px #0005;overflow:hidden}.pdfme-web-dialog::backdrop{background:#10253c88;backdrop-filter:blur(2px)}.pdfme-web-dialog header{display:flex;align-items:center;min-height:58px;padding:10px 14px 10px 18px;border-bottom:1px solid var(--line);font-weight:700}.pdfme-web-dialog header button{margin-left:auto}.pdfme-web-dialog iframe{width:100%;height:calc(100% - 58px);border:0}@media(max-width:1100px){.pdfme-web-toolbar{gap:10px}.pdfme-web-button-label{display:none}.pdfme-web-button{width:38px;padding:0}.pdfme-web-data-toggle{display:inline-flex}}@media(max-width:800px){.pdfme-web-studio{min-height:620px;border-radius:12px}.pdfme-web-toolbar{min-height:58px;padding:9px 10px 9px 14px}.pdfme-web-title{font-size:15px}.pdfme-web-title-full{display:none}.pdfme-web-title-short{display:inline}.pdfme-web-actions{gap:5px}.pdfme-web-layout,.pdfme-web-studio.pdfme-web-data-collapsed .pdfme-web-layout{display:block;height:calc(100% - 58px);min-height:560px}.pdfme-web-sidebar{position:absolute;inset:0 auto 0 0;width:min(320px,88%);border-right:1px solid var(--line);box-shadow:12px 0 32px #172b3f22;transform:translateX(-105%);opacity:0;pointer-events:none}.pdfme-web-studio.pdfme-web-data-open .pdfme-web-sidebar{transform:translateX(0);opacity:1;pointer-events:auto}.pdfme-web-close-data{display:inline-flex}.pdfme-web-backdrop{position:absolute;inset:0;z-index:3;border:0;background:#172b3f52;cursor:pointer}.pdfme-web-data-open .pdfme-web-backdrop{display:block}.pdfme-web-designer{height:100%;min-height:560px}.pdfme-web-dialog{width:96vw;height:92vh}}@media(max-width:440px){.pdfme-web-toolbar{padding-left:12px}.pdfme-web-button{width:36px;min-height:36px}.pdfme-web-actions{gap:4px}}
`;

let studioId = 0;

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
    this.id = ++studioId;
    this.dataPanelId = `pdfme-web-data-${this.id}`;
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
    this.root.innerHTML = `<section class="pdfme-web-studio" aria-busy="false"><header class="pdfme-web-toolbar"><span class="pdfme-web-title"><span class="pdfme-web-title-full">${t.title}</span><span class="pdfme-web-title-short">${t.shortTitle}</span></span><div class="pdfme-web-actions"><button type="button" data-action="toggleData" class="pdfme-web-button pdfme-web-data-toggle" aria-controls="${this.dataPanelId}" aria-expanded="false" title="${t.data}">${icons.data}<span class="pdfme-web-button-label">${t.data}</span></button><button type="button" data-action="save" class="pdfme-web-button" title="${t.save}">${icons.save}<span class="pdfme-web-button-label">${t.save}</span></button><button type="button" data-action="preview" class="pdfme-web-button primary" title="${t.preview}">${icons.preview}<span class="pdfme-web-button-label">${t.preview}</span></button><button type="button" data-action="download" class="pdfme-web-button" title="${t.download}">${icons.download}<span class="pdfme-web-button-label">${t.download}</span></button><button type="button" data-action="print" class="pdfme-web-button" title="${t.print}">${icons.print}<span class="pdfme-web-button-label">${t.print}</span></button></div></header><div class="pdfme-web-layout"><button type="button" data-action="closeData" class="pdfme-web-backdrop" aria-label="${t.close}" tabindex="-1"></button><aside id="${this.dataPanelId}" class="pdfme-web-sidebar" aria-label="${t.data}"><div class="pdfme-web-sidebar-header"><div class="pdfme-web-sidebar-title"><h2>${t.data}<span class="pdfme-web-count">0</span></h2></div><div class="pdfme-web-sidebar-actions"><button type="button" data-action="refreshData" class="pdfme-web-button icon-only" title="${t.refresh}" aria-label="${t.refresh}">${icons.refresh}</button><button type="button" data-action="closeData" class="pdfme-web-button icon-only pdfme-web-close-data" title="${t.close}" aria-label="${t.close}">${icons.close}</button></div></div><p class="pdfme-web-hint">${t.hint}</p><label class="pdfme-web-search">${icons.search}<input type="search" placeholder="${t.search}" aria-label="${t.search}"></label><div class="pdfme-web-fields"></div></aside><main class="pdfme-web-designer"></main></div></section>`;
    this.element = this.root.firstElementChild;
    this.fieldList = this.root.querySelector(".pdfme-web-fields");
    this.fieldCount = this.root.querySelector(".pdfme-web-count");
    this.fieldSearch = this.root.querySelector(".pdfme-web-search input");
    this.dataToggle = this.root.querySelector(".pdfme-web-data-toggle");
    const designerRoot = this.root.querySelector(".pdfme-web-designer");
    this.designer = new Designer({ domContainer: designerRoot, template: this.template, plugins: this.plugins, options: { lang: this.language, ...(this.configuration.designerOptions || {}) } });
    this.designer.onChangeTemplate?.((template) => { this.template = template; this.emit("templateChange", { template }); });
    this.designer.onSaveTemplate?.((template) => { this.template = template; this.emit("templateSave", { template }); });
    this.root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => Promise.resolve(this[button.dataset.action]()).catch((error) => this.handleError(button.dataset.action, error))));
    this.fieldSearch.addEventListener("input", () => this.renderFields(this.fieldSearch.value));
    this.handleKeydown = (event) => { if (event.key === "Escape") this.closeData(); };
    this.root.addEventListener("keydown", this.handleKeydown);
    this.setupResponsiveDesigner();
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
      this.renderFields(this.fieldSearch?.value || "");
      this.emit("dataResolved", { data: this.resolvedData, inputs: this.inputs });
      return this.resolvedData;
    } catch (error) { this.handleError("resolve", error); throw error; }
    finally { this.setBusy(false); }
  }

  renderFields(query = "") {
    const fields = flattenData(this.resolvedData);
    const normalizedQuery = query.trim().toLocaleLowerCase(this.language);
    const visibleFields = normalizedQuery ? fields.filter((field) => `${field.path} ${String(field.value ?? "")}`.toLocaleLowerCase(this.language).includes(normalizedQuery)) : fields;
    this.fieldCount.textContent = String(fields.length);
    if (!visibleFields.length) {
      const empty = document.createElement("p");
      empty.className = "pdfme-web-empty";
      empty.textContent = labels[this.language].empty;
      this.fieldList.replaceChildren(empty);
      return;
    }
    this.fieldList.replaceChildren(...visibleFields.map((field) => {
      const button = document.createElement("button");
      button.type = "button";
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
    if (this.mobileMedia?.matches) this.closeData();
    return name;
  }

  toggleData() {
    const mobile = this.mobileMedia?.matches;
    if (mobile) this.element.classList.toggle("pdfme-web-data-open");
    else this.element.classList.toggle("pdfme-web-data-collapsed");
    const expanded = mobile ? this.element.classList.contains("pdfme-web-data-open") : !this.element.classList.contains("pdfme-web-data-collapsed");
    this.dataToggle?.setAttribute("aria-expanded", String(expanded));
  }

  closeData() {
    this.element.classList.remove("pdfme-web-data-open");
    this.dataToggle?.setAttribute("aria-expanded", "false");
  }

  setupResponsiveDesigner() {
    this.mobileMedia = window.matchMedia("(max-width: 800px)");
    this.handleResponsiveChange = () => {
      this.closeData();
      const sidebar = this.root.querySelector(".pdfme-designer-right-sidebar");
      const toggle = this.root.querySelector(".pdfme-designer-sidebar-toggle");
      if (this.mobileMedia.matches && sidebar && toggle && sidebar.getBoundingClientRect().width > 0) {
        toggle.click();
        this.autoCollapsedDesignerSidebar = true;
      } else if (!this.mobileMedia.matches && this.autoCollapsedDesignerSidebar && sidebar && toggle && sidebar.getBoundingClientRect().width === 0) {
        toggle.click();
        this.autoCollapsedDesignerSidebar = false;
      }
      this.dataToggle?.setAttribute("aria-expanded", String(!this.mobileMedia.matches && !this.element.classList.contains("pdfme-web-data-collapsed")));
    };
    if (this.mobileMedia.addEventListener) this.mobileMedia.addEventListener("change", this.handleResponsiveChange);
    else this.mobileMedia.addListener(this.handleResponsiveChange);
    this.responsiveFrame = requestAnimationFrame(() => this.handleResponsiveChange());
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

  setBusy(busy) { this.element?.classList.toggle("pdfme-web-busy", busy); this.element?.setAttribute("aria-busy", String(busy)); }
  handleError(operation, error) { this.emit("error", { operation, error }); }
  destroy() {
    cancelAnimationFrame(this.responsiveFrame);
    this.root.removeEventListener("keydown", this.handleKeydown);
    if (this.mobileMedia && this.handleResponsiveChange) {
      if (this.mobileMedia.removeEventListener) this.mobileMedia.removeEventListener("change", this.handleResponsiveChange);
      else this.mobileMedia.removeListener(this.handleResponsiveChange);
    }
    this.designer?.destroy();
    this.root.replaceChildren();
  }
}
