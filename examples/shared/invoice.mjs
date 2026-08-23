export const invoiceTemplate = {
  basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
  schemas: [[
    { name: "title", type: "text", position: { x: 16, y: 15 }, width: 95, height: 14, content: "INVOICE", readOnly: true, fontSize: 28, fontColor: "#0a6ed1" },
    { name: "company", type: "text", position: { x: 120, y: 18 }, width: 72, height: 10, content: "Company", alignment: "right", fontSize: 16 },
    { name: "invoiceNumber", type: "text", position: { x: 16, y: 42 }, width: 82, height: 9, content: "Invoice" },
    { name: "customer", type: "text", position: { x: 16, y: 59 }, width: 130, height: 10, content: "Customer" },
    { name: "items", type: "table", position: { x: 16, y: 84 }, width: 178, height: 62, content: "[]", showHead: true, head: ["Item", "Qty", "Price", "Total"], headWidthPercentages: [52, 14, 17, 17], tableStyles: { borderWidth: 0.3, borderColor: "#89919a" }, headStyles: { alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1, characterSpacing: 0, fontColor: "#fff", backgroundColor: "#0a6ed1", borderColor: "", borderWidth: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, bodyStyles: { alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1, characterSpacing: 0, fontColor: "#000", backgroundColor: "", alternateBackgroundColor: "#f5f5f5", borderColor: "#888", borderWidth: { top: .1, right: .1, bottom: .1, left: .1 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, columnStyles: {} },
    { name: "total", type: "text", position: { x: 118, y: 170 }, width: 76, height: 12, content: "Total", alignment: "right", fontSize: 17, fontColor: "#0a6ed1" },
    { name: "footer", type: "text", position: { x: 16, y: 270 }, width: 178, height: 8, content: "Generated with ui5-pdfme", readOnly: true, alignment: "center", fontSize: 9, fontColor: "#5b738b" }
  ]]
};

export const dataSources = [
  {
    id: "order",
    type: "json",
    data: {
      number: "INV-2026-0042",
      customer: "Acme Manufacturing",
      items: [
        { description: "UI integration", quantity: 2, unitPrice: 120, amount: 240 },
        { description: "OData mapping", quantity: 4, unitPrice: 85, amount: 340 },
        { description: "PDF template", quantity: 1, unitPrice: 180, amount: 180 }
      ]
    }
  },
  { id: "brand", type: "json", data: { company: "Fiori Labs" } },
  { id: "totals", type: "function", loader: "totals", dependsOn: ["order"] }
];

export const mapping = {
  fields: {
    company: "brand.company",
    invoiceNumber: { template: "Invoice {order.number}" },
    customer: "order.customer",
    items: { path: "order.items", formatter: "table", options: { columns: ["description", "quantity", "unitPrice", "amount"] } },
    total: { path: "totals.total", formatter: "number", options: { locale: "en-US", style: "currency", currency: "USD" } }
  }
};

export function totalsLoader(_source, context) {
  return { total: context.data.order.items.reduce((sum, item) => sum + item.amount, 0) };
}
