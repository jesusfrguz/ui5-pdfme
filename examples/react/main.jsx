import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { PdfTemplateStudio } from "ui5-pdfme/react";
import { dataSources, invoiceTemplate, mapping, totalsLoader } from "../shared/invoice.mjs";

const templateRepositories = [{
  id: "demo",
  name: "React demo",
  type: "memory",
  records: [{ id: "invoice", name: "Invoice", description: "Shared React invoice", tags: ["invoice"], status: "published", template: invoiceTemplate, mapping }]
}];

function App() {
  const studio = useRef(null);
  useEffect(() => {
    studio.current?.registerLoader("totals", totalsLoader).refreshData();
  }, []);
  return <main className="shell"><PdfTemplateStudio ref={studio} template={invoiceTemplate} templateRepositories={templateRepositories} dataSources={dataSources} mapping={mapping} filename="invoice-react.pdf" language="en" autoResolve={false} /></main>;
}

createRoot(document.getElementById("root")).render(<App />);
