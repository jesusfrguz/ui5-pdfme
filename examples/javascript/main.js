import { TemplateStore, WebPdfTemplateStudio } from "ui5-pdfme";
import { dataSources, invoiceTemplate, mapping, totalsLoader } from "../shared/invoice.mjs";

const templateRepositories = [{ id: "browser", name: "This browser", type: "localStorage", storageKey: "ui5-pdfme.javascript.templates", default: true }];
const templateStore = new TemplateStore(templateRepositories);
if (!(await templateStore.list()).length) {
  await templateStore.save({ id: "invoice-demo", name: "Invoice demo", description: "Starter invoice persisted in this browser", tags: ["invoice", "demo"], status: "published", template: invoiceTemplate, mapping });
}

const studio = new WebPdfTemplateStudio("#studio", {
  template: invoiceTemplate,
  templateRepositories,
  dataSources,
  mapping,
  filename: "invoice-javascript.pdf",
  language: "en",
  autoResolve: false
});

studio.registerLoader("totals", totalsLoader);
await studio.refreshData();

document.querySelector("#studio").addEventListener("pdfme:templateSaved", ({ detail }) => console.info("Template persisted", detail.record));
