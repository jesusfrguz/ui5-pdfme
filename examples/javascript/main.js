import { WebPdfTemplateStudio } from "ui5-pdfme";
import { dataSources, invoiceTemplate, mapping, totalsLoader } from "../shared/invoice.mjs";

const studio = new WebPdfTemplateStudio("#studio", {
  template: invoiceTemplate,
  dataSources,
  mapping,
  filename: "invoice-javascript.pdf",
  language: "en",
  autoResolve: false
});

studio.registerLoader("totals", totalsLoader);
await studio.refreshData();

document.querySelector("#studio").addEventListener("pdfme:templateSave", ({ detail }) => {
  localStorage.setItem("ui5-pdfme.javascript.template", JSON.stringify(detail.template));
});
