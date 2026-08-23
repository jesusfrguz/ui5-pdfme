sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  var STORAGE_KEY = "ui5-pdfme.demo.invoice-template";

  function createInvoiceTemplate() {
    return {
      basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
      schemas: [[
        {
          name: "documentTitle",
          type: "text",
          position: { x: 15, y: 14 },
          width: 90,
          height: 14,
          content: "FACTURA",
          readOnly: true,
          fontSize: 26,
          fontColor: "#0a6ed1"
        },
        {
          name: "brandName",
          type: "text",
          position: { x: 125, y: 16 },
          width: 68,
          height: 9,
          content: "Empresa",
          fontSize: 16,
          alignment: "right"
        },
        {
          name: "invoiceNumber",
          type: "text",
          position: { x: 15, y: 38 },
          width: 80,
          height: 8,
          content: "N.º factura"
        },
        {
          name: "issueDate",
          type: "text",
          position: { x: 110, y: 38 },
          width: 83,
          height: 8,
          content: "Fecha",
          alignment: "right"
        },
        {
          name: "customerName",
          type: "text",
          position: { x: 15, y: 55 },
          width: 100,
          height: 8,
          content: "Cliente",
          fontSize: 14
        },
        {
          name: "customerAddress",
          type: "text",
          position: { x: 15, y: 65 },
          width: 150,
          height: 12,
          content: "Dirección"
        },
        {
          name: "items",
          type: "table",
          position: { x: 15, y: 88 },
          width: 180,
          height: 60,
          content: "[[\"Consultoría SAP UI5\",\"2\",\"95,00 €\",\"190,00 €\"]]",
          showHead: true,
          head: ["Concepto", "Cantidad", "Precio", "Importe"],
          headWidthPercentages: [50, 15, 17.5, 17.5],
          tableStyles: { borderWidth: 0.3, borderColor: "#89919a" },
          headStyles: {
            alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1,
            characterSpacing: 0, fontColor: "#223548", backgroundColor: "#e5f0fa",
            borderColor: "", borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 5, right: 5, bottom: 5, left: 5 }
          },
          bodyStyles: {
            alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1,
            characterSpacing: 0, fontColor: "#000000", backgroundColor: "",
            alternateBackgroundColor: "#f5f5f5", borderColor: "#888888",
            borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
            padding: { top: 5, right: 5, bottom: 5, left: 5 }
          },
          columnStyles: {}
        },
        {
          name: "subtotal",
          type: "text",
          position: { x: 120, y: 168 },
          width: 73,
          height: 8,
          content: "Subtotal",
          alignment: "right"
        },
        {
          name: "tax",
          type: "text",
          position: { x: 120, y: 178 },
          width: 73,
          height: 8,
          content: "IVA",
          alignment: "right"
        },
        {
          name: "total",
          type: "text",
          position: { x: 120, y: 190 },
          width: 73,
          height: 10,
          content: "Total",
          alignment: "right",
          fontSize: 16,
          fontColor: "#0a6ed1"
        },
        {
          name: "footer",
          type: "text",
          position: { x: 15, y: 272 },
          width: 180,
          height: 8,
          content: "Documento generado con ui5-pdfme",
          readOnly: true,
          alignment: "center",
          fontSize: 9,
          fontColor: "#5b738b"
        }
      ]]
    };
  }

  return Controller.extend("ui5.pdfme.demokit.controller.App", {
    onInit: function () {
      var studio = this.getView().byId("studio");
      var savedTemplate;
      try {
        savedTemplate = JSON.parse(localStorage.getItem(STORAGE_KEY));
      } catch (ignore) {
        savedTemplate = null;
      }

      studio.registerLoader("calculateTotals", function (_source, context) {
        var subtotal = context.data.order.items.reduce(function (sum, item) {
          return sum + item.quantity * item.unitPrice;
        }, 0);
        return {
          subtotal: subtotal,
          tax: subtotal * 0.21,
          total: subtotal * 1.21
        };
      });

      studio.setTemplate(savedTemplate || createInvoiceTemplate());
      studio.setDataSources([
        {
          id: "order",
          type: "json",
          data: {
            number: "F-2026-0042",
            date: "2026-08-23T00:00:00Z",
            customer: { name: "Industrias Ejemplo S.L.", address: "Calle Mayor 12, Madrid" },
            items: [
              { description: "Consultoría SAP UI5", quantity: 2, unitPrice: 95, amount: 190 },
              { description: "Integración OData", quantity: 5, unitPrice: 80, amount: 400 },
              { description: "Diseño de plantilla PDF", quantity: 1, unitPrice: 150, amount: 150 }
            ]
          }
        },
        {
          id: "branding",
          type: "json",
          data: { companyName: "Northwind Fiori Labs" }
        },
        {
          id: "totals",
          type: "function",
          loader: "calculateTotals",
          dependsOn: ["order"]
        }
      ]);
      studio.setMapping({
        fields: {
          brandName: "branding.companyName",
          invoiceNumber: { template: "Factura {order.number}" },
          issueDate: { path: "order.date", formatter: "date", options: { locale: "es-ES" } },
          customerName: "order.customer.name",
          customerAddress: "order.customer.address",
          items: {
            path: "order.items",
            formatter: "table",
            options: { columns: ["description", "quantity", "unitPrice", "amount"] }
          },
          subtotal: { path: "totals.subtotal", formatter: "number", options: { locale: "es-ES", style: "currency", currency: "EUR" } },
          tax: { path: "totals.tax", formatter: "number", options: { locale: "es-ES", style: "currency", currency: "EUR" } },
          total: { path: "totals.total", formatter: "number", options: { locale: "es-ES", style: "currency", currency: "EUR" } }
        }
      });
    },

    onTemplateSave: function (event) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event.getParameter("template")));
      MessageToast.show("Plantilla guardada localmente");
    },

    onError: function (event) {
      console.error(event.getParameter("operation"), event.getParameter("error"));
    }
  });
});
