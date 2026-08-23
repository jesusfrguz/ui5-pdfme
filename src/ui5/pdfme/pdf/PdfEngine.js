sap.ui.define([
  "@pdfme/ui",
  "@pdfme/generator",
  "@pdfme/schemas",
  "@pdfme/common"
], function (PdfmeUi, PdfmeGenerator, Schemas, Common) {
  "use strict";

  function createDefaultPlugins() {
    return {
      Text: Schemas.text,
      MultiVariableText: Schemas.multiVariableText,
      Table: Schemas.table,
      List: Schemas.list,
      Image: Schemas.image,
      Signature: Schemas.signature,
      SVG: Schemas.svg,
      Line: Schemas.line,
      Rectangle: Schemas.rectangle,
      Ellipse: Schemas.ellipse,
      Date: Schemas.date,
      DateTime: Schemas.dateTime,
      Time: Schemas.time,
      Select: Schemas.select,
      RadioGroup: Schemas.radioGroup,
      Checkbox: Schemas.checkbox,
      CircleMark: Schemas.circleMark,
      QRCode: Schemas.barcodes.qrcode,
      Code128: Schemas.barcodes.code128,
      EAN13: Schemas.barcodes.ean13,
      DataMatrix: Schemas.barcodes.gs1datamatrix,
      PDF417: Schemas.barcodes.pdf417
    };
  }

  function PdfEngine(options) {
    this._plugins = Object.assign(createDefaultPlugins(), options && options.plugins);
    this._options = Object.assign({}, options && options.generatorOptions);
  }

  PdfEngine.createBlankTemplate = function () {
    return {
      basePdf: {
        width: 210,
        height: 297,
        padding: [12, 12, 12, 12]
      },
      schemas: [[]]
    };
  };

  PdfEngine.prototype.getPlugins = function () {
    return this._plugins;
  };

  PdfEngine.prototype.validateTemplate = function (template) {
    Common.checkTemplate(template);
    return true;
  };

  PdfEngine.prototype.createDesigner = function (container, template, options) {
    if (!container) {
      throw new Error("A rendered DOM container is required to create the PDF designer");
    }
    return new PdfmeUi.Designer({
      domContainer: container,
      template: template || PdfEngine.createBlankTemplate(),
      plugins: this._plugins,
      options: options || {}
    });
  };

  PdfEngine.prototype.generate = function (template, inputs, options) {
    this.validateTemplate(template);
    return PdfmeGenerator.generate({
      template: template,
      inputs: inputs,
      plugins: this._plugins,
      options: Object.assign({}, this._options, options)
    });
  };

  PdfEngine.prototype.toBlob = function (pdfBytes) {
    return new Blob([pdfBytes], { type: "application/pdf" });
  };

  PdfEngine.prototype.download = function (pdfBytes, filename) {
    var url = URL.createObjectURL(this.toBlob(pdfBytes));
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "document.pdf";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  PdfEngine.prototype.print = function (pdfBytes) {
    var url = URL.createObjectURL(this.toBlob(pdfBytes));
    var frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = url;
    document.body.appendChild(frame);
    return new Promise(function (resolve, reject) {
      frame.onload = function () {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          setTimeout(function () {
            frame.remove();
            URL.revokeObjectURL(url);
          }, 30000);
        }
      };
      frame.onerror = function () {
        frame.remove();
        URL.revokeObjectURL(url);
        reject(new Error("The generated PDF could not be opened for printing"));
      };
    });
  };

  return PdfEngine;
});
