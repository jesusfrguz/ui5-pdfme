import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { PdfTemplateStudio } from "ui5-pdfme/react";
import { dataSources, invoiceTemplate, mapping, totalsLoader } from "../shared/invoice.mjs";

function App() {
  const studio = useRef(null);
  useEffect(() => {
    studio.current?.registerLoader("totals", totalsLoader).refreshData();
  }, []);
  return <main className="shell"><PdfTemplateStudio ref={studio} template={invoiceTemplate} dataSources={dataSources} mapping={mapping} filename="invoice-react.pdf" language="en" autoResolve={false} /></main>;
}

createRoot(document.getElementById("root")).render(<App />);
