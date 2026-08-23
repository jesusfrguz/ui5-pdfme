sap.ui.define([
  "sap/ui/core/Control",
  "sap/base/i18n/ResourceBundle",
  "sap/ui/core/HTML",
  "sap/m/OverflowToolbar",
  "sap/m/Title",
  "sap/m/ToolbarSpacer",
  "sap/m/Button",
  "sap/m/VBox",
  "sap/m/Text",
  "sap/m/List",
  "sap/m/StandardListItem",
  "sap/m/Dialog",
  "sap/m/MessageToast",
  "./PdfTemplateStudioRenderer",
  "./data/DataResolver",
  "./data/MappingEngine",
  "./pdf/PdfEngine",
  "./util/ObjectPath"
], function (
  Control, ResourceBundle, HTML, OverflowToolbar, Title, ToolbarSpacer, Button, VBox, Text, List,
  StandardListItem, Dialog, MessageToast, PdfTemplateStudioRenderer, DataResolver,
  MappingEngine, PdfEngine, ObjectPath
) {
  "use strict";

  function text(bundle, key) {
    return bundle ? bundle.getText(key) : key;
  }

  var PdfTemplateStudio = Control.extend("ui5.pdfme.PdfTemplateStudio", {
    metadata: {
      properties: {
        title: { type: "string", defaultValue: "" },
        height: { type: "sap.ui.core.CSSSize", defaultValue: "48rem" },
        filename: { type: "string", defaultValue: "document.pdf" },
        language: { type: "string", defaultValue: "" },
        template: { type: "object", defaultValue: null, byValue: true },
        dataSources: { type: "object[]", defaultValue: [], byValue: true },
        mapping: { type: "object", defaultValue: null, byValue: true },
        autoResolve: { type: "boolean", defaultValue: true },
        showDataPanel: { type: "boolean", defaultValue: true }
      },
      aggregations: {
        _toolbar: { type: "sap.m.OverflowToolbar", multiple: false, visibility: "hidden" },
        _dataPanel: { type: "sap.m.VBox", multiple: false, visibility: "hidden" }
      },
      events: {
        templateSave: { parameters: { template: { type: "object" } } },
        templateChange: { parameters: { template: { type: "object" } } },
        fieldInsert: { parameters: { fieldName: { type: "string" }, path: { type: "string" } } },
        dataResolved: { parameters: { data: { type: "object" }, inputs: { type: "object[]" } } },
        generated: { parameters: { bytes: { type: "object" }, blob: { type: "object" } } },
        error: { parameters: { operation: { type: "string" }, error: { type: "object" } } }
      }
    },

    renderer: PdfTemplateStudioRenderer
  });

  PdfTemplateStudio.prototype.init = function () {
    this._bundle = ResourceBundle.create({
      url: sap.ui.require.toUrl("ui5/pdfme/i18n/i18n.properties")
    });
    this._resolver = new DataResolver();
    this._mapper = new MappingEngine();
    this._pdf = new PdfEngine();
    this._loaders = Object.create(null);
    this._autoMappings = Object.create(null);
    this._resolvedData = null;
    this._inputs = null;
    this._autoResolved = false;

    this.setAggregation("_toolbar", new OverflowToolbar({
      content: [
        new Title({ text: text(this._bundle, "studioTitle"), level: "H2" }),
        new ToolbarSpacer(),
        new Button({ icon: "sap-icon://refresh", text: text(this._bundle, "refresh"), press: this.refreshData.bind(this) }),
        new Button({ icon: "sap-icon://save", text: text(this._bundle, "save"), press: this.saveTemplate.bind(this) }),
        new Button({ icon: "sap-icon://show", text: text(this._bundle, "preview"), type: "Emphasized", press: this.preview.bind(this) }),
        new Button({ icon: "sap-icon://download", text: text(this._bundle, "download"), press: this.download.bind(this) }),
        new Button({ icon: "sap-icon://print", text: text(this._bundle, "print"), press: this.print.bind(this) })
      ]
    }));

    this._fieldList = new List({
      growing: true,
      growingThreshold: 50,
      noDataText: text(this._bundle, "noFields"),
      showSeparators: "Inner"
    });
    this.setAggregation("_dataPanel", new VBox({
      width: "100%",
      items: [
        new Title({ text: text(this._bundle, "variablesTitle"), level: "H3" }).addStyleClass("sapUiSmallMarginBegin sapUiTinyMarginTop"),
        new Text({ text: text(this._bundle, "variablesHint"), wrapping: true }).addStyleClass("sapUiSmallMargin"),
        this._fieldList
      ]
    }));
  };

  PdfTemplateStudio.prototype.onBeforeRendering = function () {
    this._destroyDesigner();
  };

  PdfTemplateStudio.prototype.onAfterRendering = function () {
    var template = this.getTemplate() || PdfEngine.createBlankTemplate();
    if (!this.getTemplate()) {
      this.setProperty("template", template, true);
    }
    this._designer = this._pdf.createDesigner(this.getDomRef("designer"), template, {
      lang: this._getPdfLanguage()
    });
    this._designer.onChangeTemplate(function (changedTemplate) {
      this.setProperty("template", changedTemplate, true);
      this.fireTemplateChange({ template: changedTemplate });
    }.bind(this));
    this._designer.onSaveTemplate(function (savedTemplate) {
      this.setProperty("template", savedTemplate, true);
      this.fireTemplateSave({ template: savedTemplate });
    }.bind(this));

    if (this.getAutoResolve() && !this._autoResolved) {
      this._autoResolved = true;
      this.refreshData();
    }
  };

  PdfTemplateStudio.prototype.exit = function () {
    this._destroyDesigner();
    this._closePreview();
  };

  PdfTemplateStudio.prototype._destroyDesigner = function () {
    if (this._designer) {
      this._designer.destroy();
      this._designer = null;
    }
  };

  PdfTemplateStudio.prototype._getPdfLanguage = function () {
    var language = this.getLanguage() || sap.ui.getCore().getConfiguration().getLanguageTag();
    var supported = ["en", "zh", "ja", "ko", "ar", "th", "pl", "it", "de", "es", "fr"];
    var shortLanguage = String(language).toLowerCase().split(/[-_]/)[0];
    return supported.indexOf(shortLanguage) >= 0 ? shortLanguage : "en";
  };

  PdfTemplateStudio.prototype.setTemplate = function (template) {
    this.setProperty("template", template, true);
    if (this._designer && template) {
      this._designer.updateTemplate(template);
    }
    return this;
  };

  PdfTemplateStudio.prototype.setDataSources = function (sources) {
    this._autoResolved = false;
    this._resolvedData = null;
    this._inputs = null;
    this.setProperty("dataSources", sources || [], true);
    return this;
  };

  PdfTemplateStudio.prototype.setMapping = function (mapping) {
    this._inputs = null;
    this.setProperty("mapping", mapping, true);
    return this;
  };

  PdfTemplateStudio.prototype.registerDataProvider = function (type, provider) {
    this._resolver.getRegistry().register(type, provider);
    return this;
  };

  PdfTemplateStudio.prototype.registerLoader = function (name, loader) {
    if (!name || typeof loader !== "function") {
      throw new TypeError("Loader name and function are required");
    }
    this._loaders[name] = loader;
    return this;
  };

  PdfTemplateStudio.prototype.registerFormatter = function (name, formatter) {
    this._mapper.registerFormatter(name, formatter);
    return this;
  };

  PdfTemplateStudio.prototype.configure = function (configuration) {
    var config = configuration || {};
    if (config.template) { this.setTemplate(config.template); }
    if (config.dataSources) { this.setDataSources(config.dataSources); }
    if (config.mapping) { this.setMapping(config.mapping); }
    if (config.filename) { this.setFilename(config.filename); }
    if (config.language) { this.setLanguage(config.language); }
    if (config.autoResolve !== undefined) { this.setAutoResolve(config.autoResolve); }
    return this;
  };

  PdfTemplateStudio.prototype.getResolvedData = function () {
    return this._resolvedData;
  };

  PdfTemplateStudio.prototype.getInputs = function () {
    return this._inputs;
  };

  PdfTemplateStudio.prototype._getMappingDefinition = function () {
    var configured = this.getMapping();
    var template = this._designer ? this._designer.getTemplate() : this.getTemplate();
    var defaultFields = {};
    (template && template.schemas || []).forEach(function (page) {
      page.forEach(function (schema) {
        if (!schema.readOnly) {
          defaultFields[schema.name] = schema.name;
        }
      });
    });
    Object.keys(this._autoMappings).forEach(function (fieldName) {
      defaultFields[fieldName] = this._autoMappings[fieldName];
    }, this);

    if (!configured) {
      return { fields: defaultFields };
    }
    return Object.assign({}, configured, {
      fields: Object.assign(defaultFields, configured.fields || configured)
    });
  };

  PdfTemplateStudio.prototype.refreshData = async function () {
    this.setBusy(true);
    try {
      this._resolvedData = await this._resolver.resolve(this.getDataSources(), {
        owner: this,
        control: this,
        loaders: this._loaders
      });
      this._inputs = this._mapper.mapInputs(this._resolvedData, this._getMappingDefinition());
      this._updateFieldList(this._resolvedData);
      this.fireDataResolved({ data: this._resolvedData, inputs: this._inputs });
      return this._resolvedData;
    } catch (error) {
      this._handleError("resolve", error);
      throw error;
    } finally {
      this.setBusy(false);
    }
  };

  PdfTemplateStudio.prototype._updateFieldList = function (data) {
    this._fieldList.destroyItems();
    ObjectPath.flatten(data, { maxDepth: 6 }).forEach(function (field) {
      var preview = field.kind === "array" ? field.value.length + " entries" : String(field.value === undefined || field.value === null ? "" : field.value);
      if (preview.length > 80) {
        preview = preview.slice(0, 77) + "…";
      }
      this._fieldList.addItem(new StandardListItem({
        title: field.path,
        description: preview,
        icon: field.kind === "array" ? "sap-icon://table-view" : "sap-icon://syntax",
        type: "Active",
        press: function () { this.insertDataField(field.path, field.value); }.bind(this)
      }));
    }, this);
  };

  PdfTemplateStudio.prototype.insertDataField = function (path, sampleValue) {
    var template = this._designer ? this._designer.getTemplate() : this.getTemplate();
    if (!template) {
      template = PdfEngine.createBlankTemplate();
    }
    var pageIndex = this._designer ? this._designer.getPageCursor() : 0;
    template.schemas[pageIndex] = template.schemas[pageIndex] || [];
    var baseName = String(path).replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "") || "field";
    var names = new Set([].concat.apply([], template.schemas).map(function (schema) { return schema.name; }));
    var fieldName = baseName;
    var suffix = 2;
    while (names.has(fieldName)) {
      fieldName = baseName + "_" + suffix;
      suffix += 1;
    }
    var row = template.schemas[pageIndex].length;
    var value = sampleValue === undefined || sampleValue === null ? "" : sampleValue;
    if (Array.isArray(value)) {
      var first = value[0];
      var columns = first && typeof first === "object" && !Array.isArray(first) ? Object.keys(first) : [];
      var matrix = columns.length ? value.map(function (record) {
        return columns.map(function (column) { return String(record[column] === undefined || record[column] === null ? "" : record[column]); });
      }) : value.map(function (entry) { return Array.isArray(entry) ? entry : [String(entry)]; });
      template.schemas[pageIndex].push({
        name: fieldName,
        type: "table",
        position: { x: 20, y: 20 + (row % 10) * 18 },
        width: 170,
        height: 35,
        content: JSON.stringify(matrix),
        showHead: true,
        head: columns.length ? columns : ["Value"],
        headWidthPercentages: new Array(columns.length || 1).fill(100 / (columns.length || 1)),
        tableStyles: { borderWidth: 0.3, borderColor: "#89919a" },
        headStyles: {
          alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1,
          characterSpacing: 0, fontColor: "#ffffff", backgroundColor: "#2980ba",
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
      });
      this._autoMappings[fieldName] = {
        path: path,
        formatter: "table",
        options: { columns: columns }
      };
    } else {
      template.schemas[pageIndex].push({
        name: fieldName,
        type: "text",
        position: { x: 20 + (row % 2) * 90, y: 20 + (row % 20) * 12 },
        width: 75,
        height: 10,
        fontSize: 12,
        content: typeof value === "object" ? JSON.stringify(value) : String(value)
      });
      this._autoMappings[fieldName] = path;
    }
    this.setProperty("template", template, true);
    if (this._designer) {
      this._designer.updateTemplate(template);
    }
    if (this._resolvedData) {
      this._inputs = this._mapper.mapInputs(this._resolvedData, this._getMappingDefinition());
    }
    this.fireFieldInsert({ fieldName: fieldName, path: path });
    return fieldName;
  };

  PdfTemplateStudio.prototype.saveTemplate = function () {
    if (this._designer) {
      this._designer.saveTemplate();
    } else {
      this.fireTemplateSave({ template: this.getTemplate() });
    }
  };

  PdfTemplateStudio.prototype.generate = async function () {
    this.setBusy(true);
    try {
      if (!this._inputs) {
        await this.refreshData();
      }
      var template = this._designer ? this._designer.getTemplate() : this.getTemplate();
      var bytes = await this._pdf.generate(template, this._inputs || [{}]);
      var blob = this._pdf.toBlob(bytes);
      this.fireGenerated({ bytes: bytes, blob: blob });
      return bytes;
    } catch (error) {
      this._handleError("generate", error);
      throw error;
    } finally {
      this.setBusy(false);
    }
  };

  PdfTemplateStudio.prototype.preview = async function () {
    var bytes = await this.generate();
    this._showPreview(bytes);
    return bytes;
  };

  PdfTemplateStudio.prototype.download = async function () {
    var bytes = await this.generate();
    this._pdf.download(bytes, this.getFilename());
    return bytes;
  };

  PdfTemplateStudio.prototype.print = async function () {
    var bytes = await this.generate();
    await this._pdf.print(bytes);
    return bytes;
  };

  PdfTemplateStudio.prototype._showPreview = function (bytes) {
    this._closePreview();
    this._previewUrl = URL.createObjectURL(this._pdf.toBlob(bytes));
    var frame = document.createElement("iframe");
    frame.src = this._previewUrl;
    frame.title = text(this._bundle, "preview");
    frame.className = "ui5PdfmePreviewFrame";
    var html = new HTML();
    html.setDOMContent(frame);
    this._previewDialog = new Dialog({
      title: text(this._bundle, "preview"),
      contentWidth: "92vw",
      contentHeight: "88vh",
      stretchOnPhone: true,
      content: [html],
      endButton: new Button({ text: "OK", press: this._closePreview.bind(this) }),
      afterClose: this._destroyPreview.bind(this)
    });
    this.addDependent(this._previewDialog);
    this._previewDialog.open();
  };

  PdfTemplateStudio.prototype._closePreview = function () {
    if (this._previewDialog && this._previewDialog.isOpen()) {
      this._previewDialog.close();
    } else {
      this._destroyPreview();
    }
  };

  PdfTemplateStudio.prototype._destroyPreview = function () {
    if (this._previewDialog) {
      this._previewDialog.destroy();
      this._previewDialog = null;
    }
    if (this._previewUrl) {
      URL.revokeObjectURL(this._previewUrl);
      this._previewUrl = null;
    }
  };

  PdfTemplateStudio.prototype._handleError = function (operation, error) {
    this.fireError({ operation: operation, error: error });
    MessageToast.show(error && error.message ? error.message : text(this._bundle, "unknownError"));
  };

  return PdfTemplateStudio;
});
