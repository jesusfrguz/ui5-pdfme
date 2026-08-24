sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "../model/ExampleTemplateSeeder"
], function (Controller, ExampleTemplateSeeder) {
  "use strict";

  var TEMPLATE_STORAGE_KEY = "ui5-pdfme.demo.templates";
  var COMPANY_LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="18" fill="#0a6ed1"/><path d="M22 19h39v12H36v10h21v12H36v18H22z" fill="#fff"/><path d="M52 58h12v13H52z" fill="#69c7ff"/></svg>';

  function createDemoTable(name, position, width, height, content, head, headWidthPercentages) {
    return {
      name: name,
      type: "table",
      position: position,
      width: width,
      height: height,
      content: content,
      showHead: true,
      head: head,
      headWidthPercentages: headWidthPercentages,
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
    };
  }

  function createInvoiceTemplate() {
    return {
      basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
      schemas: [[
        {
          name: "logo",
          type: "svg",
          position: { x: 15, y: 14 },
          width: 20,
          height: 20,
          content: COMPANY_LOGO,
          readOnly: true,
          fixedPosition: true,
          repeatOnEveryPage: true
        },
        {
          name: "documentTitle",
          type: "text",
          position: { x: 41, y: 14 },
          width: 64,
          height: 14,
          content: "FACTURA",
          readOnly: true,
          fixedPosition: true,
          repeatOnEveryPage: true,
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
          fixedPosition: true,
          repeatOnEveryPage: true,
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
          height: 58.3456,
          content: "[[\"Consultoría SAP UI5\",\"2\",\"95,00 €\",\"190,00 €\"],[\"Integración OData\",\"5\",\"80,00 €\",\"400,00 €\"],[\"Diseño de plantilla PDF\",\"1\",\"150,00 €\",\"150,00 €\"],[\"Diseño adaptable\",\"3\",\"75,00 €\",\"225,00 €\"],[\"Adaptador UI5\",\"2\",\"110,00 €\",\"220,00 €\"],[\"Adaptador React\",\"2\",\"90,00 €\",\"180,00 €\"],[\"Adaptador JavaScript\",\"1\",\"85,00 €\",\"85,00 €\"],[\"Validación PDF\",\"3\",\"60,00 €\",\"180,00 €\"],[\"Pruebas de navegador\",\"4\",\"50,00 €\",\"200,00 €\"],[\"Documentación técnica\",\"2\",\"70,00 €\",\"140,00 €\"]]",
          showHead: true,
          head: ["Concepto", "Cantidad", "Precio", "Importe"],
          headWidthPercentages: [50, 15, 17.5, 17.5],
          tableStyles: { borderWidth: 0.3, borderColor: "#89919a" },
          headStyles: {
            alignment: "left", verticalAlignment: "middle", fontSize: 10, lineHeight: 1,
            characterSpacing: 0, fontColor: "#223548", backgroundColor: "#e5f0fa",
            borderColor: "", borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 2, right: 3, bottom: 2, left: 3 }
          },
          bodyStyles: {
            alignment: "left", verticalAlignment: "middle", fontSize: 10, lineHeight: 1,
            characterSpacing: 0, fontColor: "#000000", backgroundColor: "",
            alternateBackgroundColor: "#f5f5f5", borderColor: "#888888",
            borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
            padding: { top: 1.5, right: 3, bottom: 1.5, left: 3 }
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
          position: { x: 15, y: 257 },
          width: 180,
          height: 18,
          content: "Protección de datos: sus datos se tratan exclusivamente para gestionar la relación comercial y cumplir las obligaciones legales. Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad contactando con Fiori Labs.",
          readOnly: true,
          fixedPosition: true,
          repeatOnEveryPage: true,
          alignment: "left",
          fontSize: 7,
          lineHeight: 1.2,
          fontColor: "#5b738b"
        },
        {
          name: "footerCredit",
          type: "text",
          position: { x: 15, y: 279 },
          width: 180,
          height: 5,
          content: "Documento generado con ui5-pdfme",
          readOnly: true,
          fixedPosition: true,
          repeatOnEveryPage: true,
          alignment: "center",
          fontSize: 7,
          fontColor: "#5b738b"
        }
      ]]
    };
  }

  function createInvoiceMapping() {
    return {
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
    };
  }

  function createShippingLabelTemplate() {
    return {
      basePdf: { width: 105, height: 148, padding: [8, 8, 8, 8] },
      schemas: [[
        { name: "labelTitle", type: "text", position: { x: 8, y: 8 }, width: 60, height: 10, content: "ETIQUETA DE ENVÍO", readOnly: true, fontSize: 18, fontColor: "#0a6ed1" },
        { name: "brandName", type: "text", position: { x: 70, y: 9 }, width: 27, height: 8, content: "Empresa", fontSize: 10, alignment: "right" },
        { name: "shipmentNumber", type: "text", position: { x: 8, y: 25 }, width: 89, height: 8, content: "Envío", fontSize: 13 },
        { name: "recipientLabel", type: "text", position: { x: 8, y: 42 }, width: 35, height: 6, content: "DESTINATARIO", readOnly: true, fontSize: 9, fontColor: "#5b738b" },
        { name: "recipient", type: "text", position: { x: 8, y: 50 }, width: 89, height: 10, content: "Cliente", fontSize: 16 },
        { name: "address", type: "text", position: { x: 8, y: 62 }, width: 89, height: 18, content: "Dirección", fontSize: 12 },
        createDemoTable("contents", { x: 8, y: 88 }, 89, 30, "[[\"Producto\",\"1\"]]", ["Contenido", "Uds."], [78, 22]),
        { name: "labelFooter", type: "text", position: { x: 8, y: 132 }, width: 89, height: 6, content: "Manipular con cuidado", readOnly: true, alignment: "center", fontSize: 9, fontColor: "#5b738b" }
      ]]
    };
  }

  function createShippingLabelMapping() {
    return {
      fields: {
        brandName: "branding.companyName",
        shipmentNumber: { template: "Envío asociado a {order.number}" },
        recipient: "order.customer.name",
        address: "order.customer.address",
        contents: { path: "order.items", formatter: "table", options: { columns: ["description", "quantity"] } }
      }
    };
  }

  function createPurchaseOrderTemplate() {
    return {
      basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] },
      schemas: [[
        { name: "purchaseTitle", type: "text", position: { x: 15, y: 14 }, width: 110, height: 14, content: "PEDIDO DE COMPRA", readOnly: true, fontSize: 24, fontColor: "#354a5f" },
        { name: "brandName", type: "text", position: { x: 130, y: 17 }, width: 63, height: 9, content: "Empresa", fontSize: 15, alignment: "right" },
        { name: "purchaseNumber", type: "text", position: { x: 15, y: 40 }, width: 90, height: 9, content: "Pedido", fontSize: 14 },
        { name: "purchaseDate", type: "text", position: { x: 115, y: 40 }, width: 78, height: 9, content: "Fecha", alignment: "right" },
        { name: "supplier", type: "text", position: { x: 15, y: 58 }, width: 178, height: 10, content: "Proveedor", fontSize: 15 },
        { name: "deliveryAddress", type: "text", position: { x: 15, y: 70 }, width: 178, height: 12, content: "Dirección de entrega" },
        createDemoTable("purchaseItems", { x: 15, y: 94 }, 178, 64, "[[\"Servicio\",\"1\",\"100,00 €\"]]", ["Concepto", "Cantidad", "Importe"], [65, 15, 20]),
        { name: "purchaseTotal", type: "text", position: { x: 115, y: 174 }, width: 78, height: 10, content: "Total", alignment: "right", fontSize: 16, fontColor: "#0a6ed1" },
        { name: "purchaseFooter", type: "text", position: { x: 15, y: 272 }, width: 178, height: 8, content: "Pedido generado con ui5-pdfme", readOnly: true, fixedPosition: true, repeatOnEveryPage: true, alignment: "center", fontSize: 9, fontColor: "#5b738b" }
      ]]
    };
  }

  function createPurchaseOrderMapping() {
    return {
      fields: {
        brandName: "branding.companyName",
        purchaseNumber: { template: "Pedido {order.number}" },
        purchaseDate: { path: "order.date", formatter: "date", options: { locale: "es-ES" } },
        supplier: "order.customer.name",
        deliveryAddress: "order.customer.address",
        purchaseItems: { path: "order.items", formatter: "table", options: { columns: ["description", "quantity", "amount"] } },
        purchaseTotal: { path: "totals.total", formatter: "number", options: { locale: "es-ES", style: "currency", currency: "EUR" } }
      }
    };
  }

  function createExampleTemplateRecords() {
    return [
      {
        id: "invoice-demo",
        name: "Factura de demostración",
        description: "Factura A4 con cliente, detalle de conceptos, impuestos y total.",
        tags: ["factura", "ventas", "a4"],
        status: "published",
        version: "7",
        updatedAt: "2026-08-24T08:00:00Z",
        metadata: { exampleRevision: 1 },
        template: createInvoiceTemplate(),
        mapping: createInvoiceMapping()
      },
      {
        id: "shipping-label-demo",
        name: "Etiqueta de envío",
        description: "Etiqueta compacta con destinatario, dirección y contenido del paquete.",
        tags: ["logística", "envío", "a6"],
        status: "published",
        version: "2",
        updatedAt: "2026-08-24T08:05:00Z",
        template: createShippingLabelTemplate(),
        mapping: createShippingLabelMapping()
      },
      {
        id: "purchase-order-demo",
        name: "Pedido de compra",
        description: "Pedido A4 con proveedor, dirección de entrega, posiciones e importe.",
        tags: ["compras", "pedido", "a4"],
        status: "draft",
        version: "2",
        updatedAt: "2026-08-24T08:10:00Z",
        metadata: { exampleRevision: 1 },
        template: createPurchaseOrderTemplate(),
        mapping: createPurchaseOrderMapping()
      }
    ];
  }

  function createExampleRepository() {
    var records = createExampleTemplateRecords();
    try {
      ExampleTemplateSeeder.seed(localStorage, TEMPLATE_STORAGE_KEY, records);
      return { id: "examples", name: "Plantillas de ejemplo", type: "localStorage", storageKey: TEMPLATE_STORAGE_KEY, default: true };
    } catch (ignore) {
      return { id: "examples", name: "Plantillas de ejemplo", type: "memory", records: records, default: true };
    }
  }

  return Controller.extend("ui5.pdfme.demokit.controller.App", {
    onInit: function () {
      var studio = this.getView().byId("studio");

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

      studio.setTemplate(createInvoiceTemplate());
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
              { description: "Diseño de plantilla PDF", quantity: 1, unitPrice: 150, amount: 150 },
              { description: "Diseño adaptable", quantity: 3, unitPrice: 75, amount: 225 },
              { description: "Adaptador UI5", quantity: 2, unitPrice: 110, amount: 220 },
              { description: "Adaptador React", quantity: 2, unitPrice: 90, amount: 180 },
              { description: "Adaptador JavaScript", quantity: 1, unitPrice: 85, amount: 85 },
              { description: "Validación PDF", quantity: 3, unitPrice: 60, amount: 180 },
              { description: "Pruebas de navegador", quantity: 4, unitPrice: 50, amount: 200 },
              { description: "Documentación técnica", quantity: 2, unitPrice: 70, amount: 140 }
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
      studio.setMapping(createInvoiceMapping());
      studio.setTemplateRepositories([createExampleRepository()]);
    },

    onAfterRendering: function () {
      if (!this._initialCatalogOpened) {
        this._initialCatalogOpened = true;
        this.getView().byId("studio").openTemplateCatalog();
      }
    },

    onError: function (event) {
      console.error(event.getParameter("operation"), event.getParameter("error"));
    }
  });
});
