import { TemplateStore } from "./template-repository.mjs";

const catalogLabels = {
  en: { title: "Templates", search: "Search templates", allStatuses: "All statuses", allSources: "All sources", refresh: "Refresh", empty: "No templates match the filters.", open: "Open", updated: "Updated", source: "Source", loading: "Loading templates…", error: "Templates could not be loaded." },
  es: { title: "Plantillas", search: "Buscar plantillas", allStatuses: "Todos los estados", allSources: "Todos los orígenes", refresh: "Actualizar", empty: "No hay plantillas que coincidan con los filtros.", open: "Abrir", updated: "Actualizada", source: "Origen", loading: "Cargando plantillas…", error: "No se pudieron cargar las plantillas." }
};

const catalogStyles = `
.pdfme-template-catalog{--tc-brand:#0a6ed1;--tc-text:#172b3f;--tc-muted:#5f7285;--tc-line:#dce3e8;display:flex;flex-direction:column;min-height:18rem;color:var(--tc-text);font:14px/1.4 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff}.pdfme-template-catalog *{box-sizing:border-box}.pdfme-template-catalog-toolbar{display:grid;grid-template-columns:minmax(14rem,1fr) minmax(10rem,.28fr) minmax(10rem,.28fr) auto;gap:.65rem;padding:1rem;border-bottom:1px solid var(--tc-line);background:#f8fafb}.pdfme-template-catalog-control{min-height:2.5rem;width:100%;border:1px solid #c8d2da;border-radius:.55rem;background:#fff;color:var(--tc-text);padding:.5rem .7rem;font:inherit}.pdfme-template-catalog-control:focus{outline:3px solid #0a6ed122;border-color:var(--tc-brand)}.pdfme-template-catalog-refresh{width:2.5rem;padding:0;border:1px solid #c8d2da;border-radius:.55rem;background:#fff;color:var(--tc-brand);cursor:pointer;font-size:1.2rem}.pdfme-template-catalog-refresh:hover{background:#edf6ff}.pdfme-template-catalog-summary{display:flex;align-items:center;min-height:2.5rem;padding:.55rem 1rem;color:var(--tc-muted);font-size:.82rem;border-bottom:1px solid var(--tc-line)}.pdfme-template-catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));align-content:start;align-items:start;flex:1 1 auto;min-height:0;gap:.85rem;padding:1rem;overflow:auto}.pdfme-template-card{display:flex;flex-direction:column;min-height:12rem;padding:1rem;border:1px solid var(--tc-line);border-radius:.8rem;background:#fff;box-shadow:0 .2rem .7rem #17324d0b}.pdfme-template-card:hover{border-color:#89bce7;box-shadow:0 .4rem 1.2rem #17324d16}.pdfme-template-card-top{display:flex;align-items:flex-start;gap:.6rem}.pdfme-template-card h3{min-width:0;margin:0;font-size:1rem;line-height:1.3;overflow-wrap:anywhere}.pdfme-template-status{margin-left:auto;padding:.16rem .45rem;border-radius:99px;background:#edf3f7;color:#456278;font-size:.69rem;font-weight:700;text-transform:uppercase}.pdfme-template-description{margin:.55rem 0;color:var(--tc-muted);font-size:.83rem}.pdfme-template-tags{display:flex;flex-wrap:wrap;gap:.35rem;margin:.2rem 0 .7rem}.pdfme-template-tag{padding:.13rem .4rem;border-radius:.35rem;background:#eef7ff;color:#075b9e;font-size:.7rem}.pdfme-template-meta{display:grid;gap:.18rem;margin-top:auto;color:var(--tc-muted);font-size:.72rem}.pdfme-template-open{align-self:flex-end;margin-top:.75rem;min-height:2.25rem;padding:.4rem .75rem;border:1px solid var(--tc-brand);border-radius:.5rem;background:var(--tc-brand);color:#fff;font:600 .8rem/1 inherit;cursor:pointer}.pdfme-template-open:hover{background:#085caf}.pdfme-template-empty{grid-column:1/-1;margin:3rem auto;color:var(--tc-muted);text-align:center}.pdfme-template-catalog[aria-busy=true] .pdfme-template-catalog-grid{opacity:.55}.pdfme-template-catalog-error{color:#bb0000}@media(max-width:700px){.pdfme-template-catalog-toolbar{grid-template-columns:1fr auto}.pdfme-template-catalog-search{grid-column:1/-1}.pdfme-template-catalog-grid{grid-template-columns:1fr}.pdfme-template-source-filter{display:none}}`;

function ensureCatalogStyles() {
  if (document.querySelector("style[data-pdfme-template-catalog]")) return;
  const style = document.createElement("style");
  style.dataset.pdfmeTemplateCatalog = "true";
  style.textContent = catalogStyles;
  document.head.append(style);
}

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function formatDate(value, language) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export class WebTemplateCatalog {
  constructor(target, configuration = {}) {
    this.root = typeof target === "string" ? document.querySelector(target) : target;
    if (!(this.root instanceof HTMLElement)) throw new TypeError("A target HTMLElement or selector is required");
    this.configure(configuration, false);
    this.render();
    if (configuration.autoLoad !== false) this.refresh().catch(() => {});
  }

  configure(configuration = {}, refresh = true) {
    this.configuration = { ...(this.configuration || {}), ...configuration };
    this.language = catalogLabels[this.configuration.language] ? this.configuration.language : "en";
    if (configuration.store) this.store = configuration.store;
    else if (configuration.repositories || !this.store) this.store = new TemplateStore(configuration.repositories || [], { context: { fetch: configuration.fetch, storage: configuration.storage, signal: configuration.signal } });
    if (refresh && this.element) this.refresh();
    return this;
  }

  render() {
    ensureCatalogStyles();
    const labels = catalogLabels[this.language];
    this.root.replaceChildren();
    this.element = document.createElement("section");
    this.element.className = "pdfme-template-catalog";
    this.element.setAttribute("aria-label", labels.title);
    this.element.setAttribute("aria-busy", "false");
    const toolbar = document.createElement("div");
    toolbar.className = "pdfme-template-catalog-toolbar";
    this.search = document.createElement("input");
    this.search.type = "search";
    this.search.placeholder = labels.search;
    this.search.setAttribute("aria-label", labels.search);
    this.search.className = "pdfme-template-catalog-control pdfme-template-catalog-search";
    this.status = document.createElement("select");
    this.status.className = "pdfme-template-catalog-control";
    this.status.setAttribute("aria-label", labels.allStatuses);
    this.status.append(option("", labels.allStatuses), option("draft", "Draft"), option("published", "Published"), option("archived", "Archived"));
    this.repository = document.createElement("select");
    this.repository.className = "pdfme-template-catalog-control pdfme-template-source-filter";
    this.repository.setAttribute("aria-label", labels.allSources);
    this.repository.append(option("", labels.allSources), ...(this.store?.repositories || []).map((source) => option(source.id, source.name || source.id)));
    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "pdfme-template-catalog-refresh";
    refreshButton.title = labels.refresh;
    refreshButton.setAttribute("aria-label", labels.refresh);
    refreshButton.textContent = "↻";
    this.summary = document.createElement("div");
    this.summary.className = "pdfme-template-catalog-summary";
    this.grid = document.createElement("div");
    this.grid.className = "pdfme-template-catalog-grid";
    toolbar.append(this.search, this.status, this.repository, refreshButton);
    this.element.append(toolbar, this.summary, this.grid);
    this.root.append(this.element);
    let timer;
    this.search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => this.refresh(), 180); });
    this.status.addEventListener("change", () => this.refresh());
    this.repository.addEventListener("change", () => this.refresh());
    refreshButton.addEventListener("click", () => this.refresh());
  }

  query() { return { search: this.search?.value || "", status: this.status?.value || "", repositoryId: this.repository?.value || "" }; }

  async refresh() {
    const labels = catalogLabels[this.language];
    this.element?.setAttribute("aria-busy", "true");
    this.summary.textContent = labels.loading;
    try {
      this.records = await this.store.list(this.query());
      this.renderRecords();
      this.emit("templatesListed", { templates: this.records, query: this.query() });
      return this.records;
    } catch (error) {
      this.summary.textContent = labels.error;
      this.summary.classList.add("pdfme-template-catalog-error");
      this.grid.replaceChildren();
      this.emit("error", { operation: "listTemplates", error });
      throw error;
    } finally { this.element?.setAttribute("aria-busy", "false"); }
  }

  renderRecords() {
    const labels = catalogLabels[this.language];
    this.summary.classList.remove("pdfme-template-catalog-error");
    this.summary.textContent = `${this.records.length} ${labels.title.toLocaleLowerCase(this.language)}`;
    if (!this.records.length) {
      const empty = document.createElement("p");
      empty.className = "pdfme-template-empty";
      empty.textContent = labels.empty;
      this.grid.replaceChildren(empty);
      return;
    }
    this.grid.replaceChildren(...this.records.map((record) => this.card(record)));
  }

  card(record) {
    const labels = catalogLabels[this.language];
    const card = document.createElement("article");
    card.className = "pdfme-template-card";
    const top = document.createElement("div");
    top.className = "pdfme-template-card-top";
    const name = document.createElement("h3");
    name.textContent = record.name;
    const status = document.createElement("span");
    status.className = "pdfme-template-status";
    status.textContent = record.status;
    top.append(name, status);
    const description = document.createElement("p");
    description.className = "pdfme-template-description";
    description.textContent = record.description || "—";
    const tags = document.createElement("div");
    tags.className = "pdfme-template-tags";
    tags.append(...record.tags.map((tag) => { const item = document.createElement("span"); item.className = "pdfme-template-tag"; item.textContent = tag; return item; }));
    const meta = document.createElement("div");
    meta.className = "pdfme-template-meta";
    const updated = document.createElement("span");
    updated.textContent = `${labels.updated}: ${formatDate(record.updatedAt, this.language)}`;
    const source = document.createElement("span");
    source.textContent = `${labels.source}: ${record.repositoryId} · v${record.version}`;
    meta.append(updated, source);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "pdfme-template-open";
    open.textContent = labels.open;
    open.addEventListener("click", () => this.open(record));
    card.append(top, description, tags, meta, open);
    return card;
  }

  async open(summary) {
    this.element?.setAttribute("aria-busy", "true");
    try {
      const record = summary.template ? summary : await this.store.get(summary.id, { repositoryId: summary.repositoryId });
      this.emit("templateOpen", { template: record });
      return record;
    } catch (error) { this.emit("error", { operation: "getTemplate", error }); throw error; }
    finally { this.element?.setAttribute("aria-busy", "false"); }
  }

  emit(name, detail) {
    this.root.dispatchEvent(new CustomEvent(`pdfme:${name}`, { detail }));
    this.configuration[`on${name[0].toUpperCase()}${name.slice(1)}`]?.(detail);
  }

  destroy() { this.root.replaceChildren(); }
}
