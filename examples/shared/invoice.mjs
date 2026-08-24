const companyLogo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="18" fill="#0a6ed1"/><path d="M22 19h39v12H36v10h21v12H36v18H22z" fill="#fff"/><path d="M52 58h12v13H52z" fill="#69c7ff"/></svg>';

export const invoiceTemplate = {
  basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
  schemas: [[
    { name: "logo", type: "svg", position: { x: 16, y: 14 }, width: 20, height: 20, content: companyLogo, readOnly: true, fixedPosition: true, repeatOnEveryPage: true },
    { name: "title", type: "text", position: { x: 42, y: 15 }, width: 69, height: 14, content: "INVOICE", readOnly: true, fixedPosition: true, repeatOnEveryPage: true, fontSize: 28, fontColor: "#0a6ed1" },
    { name: "company", type: "text", position: { x: 120, y: 18 }, width: 72, height: 10, content: "Company", fixedPosition: true, repeatOnEveryPage: true, alignment: "right", fontSize: 16 },
    { name: "invoiceNumber", type: "text", position: { x: 16, y: 42 }, width: 82, height: 9, content: "Invoice" },
    { name: "customer", type: "text", position: { x: 16, y: 59 }, width: 130, height: 10, content: "Customer" },
    { name: "items", type: "table", position: { x: 16, y: 84 }, width: 178, height: 62, content: "[]", showHead: true, head: ["Item", "Qty", "Price", "Total"], headWidthPercentages: [52, 14, 17, 17], tableStyles: { borderWidth: 0.3, borderColor: "#89919a" }, headStyles: { alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1, characterSpacing: 0, fontColor: "#fff", backgroundColor: "#0a6ed1", borderColor: "", borderWidth: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, bodyStyles: { alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1, characterSpacing: 0, fontColor: "#000", backgroundColor: "", alternateBackgroundColor: "#f5f5f5", borderColor: "#888", borderWidth: { top: .1, right: .1, bottom: .1, left: .1 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, columnStyles: {} },
    { name: "total", type: "text", position: { x: 118, y: 170 }, width: 76, height: 12, content: "$2,315.00", showLabel: true, label: "Total", alignment: "right", fontSize: 17, fontColor: "#0a6ed1" },
    { name: "footer", type: "text", position: { x: 16, y: 257 }, width: 178, height: 18, content: "Protección de datos: sus datos se tratan exclusivamente para gestionar la relación comercial y cumplir las obligaciones legales. Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad contactando con Fiori Labs.", readOnly: true, fixedPosition: true, repeatOnEveryPage: true, alignment: "left", fontSize: 7, lineHeight: 1.2, fontColor: "#5b738b" },
    { name: "footerCredit", type: "text", position: { x: 16, y: 279 }, width: 178, height: 5, content: "Generated with ui5-pdfme", readOnly: true, fixedPosition: true, repeatOnEveryPage: true, alignment: "center", fontSize: 7, fontColor: "#5b738b" }
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
        { description: "PDF template", quantity: 1, unitPrice: 180, amount: 180 },
        { description: "Responsive layout", quantity: 3, unitPrice: 95, amount: 285 },
        { description: "UI5 adapter", quantity: 2, unitPrice: 140, amount: 280 },
        { description: "React adapter", quantity: 2, unitPrice: 110, amount: 220 },
        { description: "JavaScript adapter", quantity: 1, unitPrice: 105, amount: 105 },
        { description: "PDF validation", quantity: 3, unitPrice: 75, amount: 225 },
        { description: "Browser testing", quantity: 4, unitPrice: 65, amount: 260 },
        { description: "Technical documentation", quantity: 2, unitPrice: 90, amount: 180 }
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
