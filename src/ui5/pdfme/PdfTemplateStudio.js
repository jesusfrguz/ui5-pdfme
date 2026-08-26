sap.ui.define([
  "sap/ui/core/Control",
  "sap/base/i18n/ResourceBundle",
  "sap/ui/core/HTML",
  "sap/m/OverflowToolbar",
  "sap/m/OverflowToolbarLayoutData",
  "sap/m/Title",
  "sap/m/ToolbarSpacer",
  "sap/m/ToolbarSeparator",
  "sap/m/Button",
  "sap/m/ToggleButton",
  "sap/m/VBox",
  "sap/m/Text",
  "sap/m/List",
  "sap/m/StandardListItem",
  "sap/m/Dialog",
  "sap/m/SearchField",
  "sap/m/Select",
  "sap/ui/core/Item",
  "sap/m/Input",
  "sap/m/TextArea",
  "sap/m/Label",
  "sap/m/MessageToast",
  "./PdfTemplateStudioRenderer",
  "./data/DataResolver",
  "./data/MappingEngine",
  "./pdf/PdfEngine",
  "./util/ObjectPath",
  "./template/TemplateStore"
], function (
  Control, ResourceBundle, HTML, OverflowToolbar, OverflowToolbarLayoutData, Title, ToolbarSpacer, ToolbarSeparator,
  Button, ToggleButton, VBox, Text, List, StandardListItem, Dialog,
  SearchField, Select, Item, Input, TextArea, Label, MessageToast,
  PdfTemplateStudioRenderer, DataResolver, MappingEngine, PdfEngine, ObjectPath, TemplateStore
) {
  "use strict";

  function text(bundle, key) {
    return bundle ? bundle.getText(key) : key;
  }

  function defaultHelpUrl(language) {
    var locale = language === "es" ? "es" : "en";
    return "https://jesusfrguz.github.io/ui5-pdfme/guide/?lang=" + locale;
  }

  function canonicalDataPath(path) {
    return String(path === undefined || path === null ? "" : path)
      .replace(/\[(?:'([^']+)'|"([^"]+)"|(\d+))\]/g, function (_match, single, double, index) {
        return "." + (single || double || index);
      })
      .replace(/^\$\.?/, "")
      .replace(/^\.|\.$/g, "");
  }

  function pathsFromDefinition(definition) {
    if (typeof definition === "string") {
      return [definition];
    }
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      return [];
    }
    if (definition.variables && typeof definition.variables === "object") {
      var variableDefinitions = Array.isArray(definition.variables)
        ? definition.variables
        : Object.keys(definition.variables).map(function (name) { return definition.variables[name]; });
      return [].concat.apply([], variableDefinitions.map(pathsFromDefinition));
    }
    if (typeof definition.path === "string") {
      return [definition.path];
    }
    if (typeof definition.template !== "string") {
      return [];
    }
    var paths = [];
    var matcher = /\{([^{}]+)\}/g;
    var match;
    while ((match = matcher.exec(definition.template))) {
      paths.push(match[1].trim());
    }
    return paths;
  }

  function multiVariableNames(schema) {
    var names = [];
    var matcher = /\{([^{}]+)\}/g;
    var match;
    while ((match = matcher.exec(String(schema.text || "")))) {
      var name = match[1].trim();
      if (name && names.indexOf(name) === -1) {
        names.push(name);
      }
    }
    return names.length ? names : (schema.variables || []).filter(function (name, index, variables) {
      return name && variables.indexOf(name) === index;
    });
  }

  function dataFieldOptions(mapping, autoMappings, resolvedData) {
    var options = new Map();
    var add = function (name, definition) {
      if (!name || options.has(name)) {
        return;
      }
      var paths = pathsFromDefinition(definition === undefined ? name : definition);
      options.set(name, {
        value: name,
        label: paths.length && !(paths.length === 1 && paths[0] === name)
          ? name + " — " + paths.join(", ")
          : name
      });
    };
    var configured = mapping && (mapping.fields || (!Object.prototype.hasOwnProperty.call(mapping, "repeat") ? mapping : {})) || {};
    Object.keys(configured).forEach(function (name) { add(name, configured[name]); });
    Object.keys(autoMappings || {}).forEach(function (name) { add(name, autoMappings[name]); });
    ObjectPath.flatten(resolvedData, { maxDepth: 6 }).forEach(function (field) { add(field.path); });
    return Array.from(options.values());
  }

  function defaultFieldMappings(template, configuredFields) {
    var defaults = {};
    (template && template.schemas || []).forEach(function (page) {
      page.forEach(function (schema) {
        if (schema.readOnly) {
          return;
        }
        if (schema.type === "multiVariableText") {
          defaults[schema.name] = {
            variables: multiVariableNames(schema).reduce(function (variables, name) {
              variables[name] = Object.prototype.hasOwnProperty.call(configuredFields, name) ? configuredFields[name] : name;
              return variables;
            }, {})
          };
        } else {
          defaults[schema.name] = schema.name;
        }
      });
    });
    return defaults;
  }

  function includedDataPaths(template, mappingDefinition) {
    var definition = mappingDefinition || {};
    var fields = definition.fields || definition;
    var repeat = typeof definition.repeat === "string" ? definition.repeat : "";
    var schemaNames = new Set([].concat.apply([], template && template.schemas || []).map(function (schema) {
      return schema.name;
    }));
    var included = new Set();
    schemaNames.forEach(function (name) {
      pathsFromDefinition(fields && fields[name]).forEach(function (path) {
        var expandedPath = repeat && /^\$item(?:\.|$)/.test(path)
          ? repeat + "[0]" + path.slice("$item".length)
          : path;
        included.add(canonicalDataPath(expandedPath));
      });
    });
    return included;
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
        templateRepositories: { type: "object[]", defaultValue: [], byValue: true },
        persistDataSources: { type: "boolean", defaultValue: false },
        applyStoredDataSources: { type: "boolean", defaultValue: false },
        autoResolve: { type: "boolean", defaultValue: true },
        showDataPanel: { type: "boolean", defaultValue: true },
        showHelp: { type: "boolean", defaultValue: true },
        helpUrl: { type: "string", defaultValue: "" }
      },
      aggregations: {
        _toolbar: { type: "sap.m.OverflowToolbar", multiple: false, visibility: "hidden" },
        _dataPanel: { type: "sap.m.VBox", multiple: false, visibility: "hidden" }
      },
      events: {
        templateSave: { parameters: { template: { type: "object" } } },
        templateChange: { parameters: { template: { type: "object" } } },
        templatesListed: { parameters: { templates: { type: "object[]" } } },
        templateLoaded: { parameters: { record: { type: "object" } } },
        templatePersisted: { parameters: { record: { type: "object" } } },
        fieldInsert: { parameters: { fieldName: { type: "string" }, path: { type: "string" } } },
        dataResolved: { parameters: { data: { type: "object" }, inputs: { type: "object[]" } } },
        generated: { parameters: { bytes: { type: "object" }, blob: { type: "object" } } },
        help: { parameters: { url: { type: "string" } } },
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
    this._pdf = new PdfEngine({
      isDataBound: this._isDataBoundField.bind(this),
      isUniqueName: this._isUniqueFieldName.bind(this),
      getDataFieldOptions: this._getDataFieldOptions.bind(this)
    });
    this._templateStore = new TemplateStore([], { context: { owner: this, control: this } });
    this._loaders = Object.create(null);
    this._autoMappings = Object.create(null);
    this._resolvedData = null;
    this._inputs = null;
    this._autoResolved = false;

    this._dataPanelToggle = new ToggleButton({
      icon: "sap-icon://menu2",
      tooltip: text(this._bundle, "hideDataPanel"),
      pressed: true,
      press: function (event) {
        this.setShowDataPanel(event.getParameter("pressed"));
      }.bind(this),
      layoutData: new OverflowToolbarLayoutData({ priority: "NeverOverflow" })
    }).addStyleClass("ui5PdfmeDataPanelToggle");

    this._fullscreenToggle = new ToggleButton({
      icon: "sap-icon://full-screen",
      tooltip: text(this._bundle, "enterFullscreen"),
      press: function () {
        this.toggleFullscreen().catch(function (error) {
          this._syncFullscreenButton();
          this._handleError("fullscreen", error);
        }.bind(this));
      }.bind(this),
      layoutData: new OverflowToolbarLayoutData({ priority: "NeverOverflow" })
    });
    this._helpButton = new Button({
      icon: "sap-icon://sys-help",
      tooltip: text(this._bundle, "help"),
      visible: this.getShowHelp(),
      press: this.openHelp.bind(this),
      layoutData: new OverflowToolbarLayoutData({ priority: "NeverOverflow" })
    });
    this._fullscreenChange = this._syncFullscreenButton.bind(this);
    this._fullscreenResize = function () {
      cancelAnimationFrame(this._fullscreenFrame);
      this._fullscreenFrame = requestAnimationFrame(this._syncFullscreenButton.bind(this));
    }.bind(this);
    this._fullscreenKeydown = function (event) {
      if (event.key === "Escape") {
        clearTimeout(this._fullscreenSyncTimer);
        this._fullscreenSyncTimer = setTimeout(this._syncFullscreenButton.bind(this), 250);
      }
    }.bind(this);
    document.addEventListener("fullscreenchange", this._fullscreenChange);
    document.addEventListener("keydown", this._fullscreenKeydown);
    window.addEventListener("resize", this._fullscreenResize);

    this._studioTitle = new Title({ text: this._getStudioTitleText(), level: "H2" });
    this.setAggregation("_toolbar", new OverflowToolbar({
      content: [
        this._dataPanelToggle,
        this._studioTitle,
        new ToolbarSpacer(),
        new Button({ icon: "sap-icon://documents", text: text(this._bundle, "templates"), press: this.openTemplateCatalog.bind(this) }),
        new Button({ icon: "sap-icon://save", text: text(this._bundle, "save"), press: this.saveTemplate.bind(this) }),
        new ToolbarSeparator(),
        new Button({ icon: "sap-icon://show", text: text(this._bundle, "preview"), type: "Emphasized", press: this.preview.bind(this) }),
        new Button({ icon: "sap-icon://download", text: text(this._bundle, "download"), press: this.download.bind(this) }),
        new Button({ icon: "sap-icon://print", text: text(this._bundle, "print"), press: this.print.bind(this) }),
        new ToolbarSeparator(),
        this._helpButton,
        this._fullscreenToggle
      ]
    }).addStyleClass("ui5PdfmeStudioToolbar"));

    this._fieldList = new List({
      growing: true,
      growingThreshold: 50,
      noDataText: text(this._bundle, "noFields"),
      showSeparators: "Inner"
    });
    this.setAggregation("_dataPanel", new VBox({
      width: "100%",
      items: [
        new OverflowToolbar({
          content: [
            new Title({ text: text(this._bundle, "variablesTitle"), level: "H3" }),
            new ToolbarSpacer(),
            new Button({
              icon: "sap-icon://refresh",
              type: "Transparent",
              tooltip: text(this._bundle, "refresh"),
              press: this.refreshData.bind(this)
            }),
            new Button({
              icon: "sap-icon://decline",
              type: "Transparent",
              tooltip: text(this._bundle, "hideDataPanel"),
              press: function () { this.setShowDataPanel(false); }.bind(this)
            })
          ]
        }).addStyleClass("ui5PdfmeDataPanelHeader"),
        new Text({ text: text(this._bundle, "variablesHint"), wrapping: true }).addStyleClass("ui5PdfmeDataPanelHint sapUiSmallMargin"),
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
      lang: this._getPdfLanguage(),
      labels: {
        fieldName: text(this._bundle, "fieldIdentifier"),
        fieldIdentifierHelp: text(this._bundle, "fieldIdentifierHelp"),
        fieldDataBound: text(this._bundle, "fieldDataBound"),
        fieldDataNotFound: text(this._bundle, "fieldDataNotFound"),
        editable: text(this._bundle, "valueFromData"),
        showLabel: text(this._bundle, "showLabel"),
        labelText: text(this._bundle, "labelText"),
        labelTextHelp: text(this._bundle, "labelTextHelp"),
        fixedPosition: text(this._bundle, "fixedPosition"),
        fixedPositionHelp: text(this._bundle, "fixedPositionHelp"),
        repeatOnEveryPage: text(this._bundle, "repeatOnEveryPage"),
        repeatOnEveryPageHelp: text(this._bundle, "repeatOnEveryPageHelp")
      }
    });
    this._designer.onChangeTemplate(function (changedTemplate) {
      this.setProperty("template", changedTemplate, true);
      if (this._resolvedData) {
        this._updateFieldList(this._resolvedData);
      }
      this._queueFieldListIndicatorSync();
      this.fireTemplateChange({ template: changedTemplate });
    }.bind(this));
    this._designer.onSaveTemplate(function (savedTemplate) {
      this.setProperty("template", savedTemplate, true);
      this.fireTemplateSave({ template: savedTemplate });
    }.bind(this));

    this._setupFieldListIndicators();
    this._setupResponsivePanels();
    this._syncFullscreenButton();

    if (this.getAutoResolve() && !this._autoResolved) {
      this._autoResolved = true;
      this.refreshData();
    }
  };

  PdfTemplateStudio.prototype.exit = function () {
    if (this._responsiveFrame) {
      cancelAnimationFrame(this._responsiveFrame);
    }
    if (this._responsiveMedia && this._handleResponsiveChange) {
      if (this._responsiveMedia.removeEventListener) {
        this._responsiveMedia.removeEventListener("change", this._handleResponsiveChange);
      } else {
        this._responsiveMedia.removeListener(this._handleResponsiveChange);
      }
    }
    document.removeEventListener("fullscreenchange", this._fullscreenChange);
    document.removeEventListener("keydown", this._fullscreenKeydown);
    window.removeEventListener("resize", this._fullscreenResize);
    cancelAnimationFrame(this._fullscreenFrame);
    clearTimeout(this._fullscreenSyncTimer);
    if (document.fullscreenElement === this.getDomRef() && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    this._destroyDesigner();
    this._closePreview();
    if (this._templateCatalogDialog) { this._templateCatalogDialog.destroy(); this._templateCatalogDialog = null; }
    if (this._templateSaveDialog) { this._templateSaveDialog.destroy(); this._templateSaveDialog = null; }
    if (this._helpDialog) { this._helpDialog.destroy(); this._helpDialog = null; }
  };

  PdfTemplateStudio.prototype._destroyDesigner = function () {
    this._destroyPaletteEnhancements();
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

  PdfTemplateStudio.prototype._getStudioTitleText = function () {
    return this.getTitle() || this._activeTemplateRecord && this._activeTemplateRecord.name || text(this._bundle, "studioTitle");
  };

  PdfTemplateStudio.prototype._updateStudioTitle = function () {
    var studioTitle = this._getStudioTitleText();
    if (this._studioTitle) {
      this._studioTitle.setText(studioTitle);
    }
    if (this.getDomRef()) {
      this.getDomRef().setAttribute("aria-label", studioTitle);
    }
  };

  PdfTemplateStudio.prototype.setTitle = function (title) {
    this.setProperty("title", title || "", true);
    this._updateStudioTitle();
    return this;
  };

  PdfTemplateStudio.prototype.setTemplate = function (template) {
    this.setProperty("template", template, true);
    if (this._designer && template) {
      this._designer.updateTemplate(template);
      this._queueFieldListIndicatorSync();
    }
    if (this._resolvedData) {
      this._updateFieldList(this._resolvedData);
    }
    return this;
  };

  PdfTemplateStudio.prototype._applyNewTemplate = function (template) {
    this._activeTemplateRecord = null;
    this._autoMappings = Object.create(null);
    this._inputs = null;
    this.setTemplate(template);
    this._updateStudioTitle();
    this.fireTemplateChange({ template: template });
    return template;
  };

  PdfTemplateStudio.prototype.startBlankTemplate = function () {
    return this._applyNewTemplate(PdfEngine.createBlankTemplate());
  };

  PdfTemplateStudio.prototype.importPdfTemplate = function (source) {
    this.setBusy(true);
    return PdfEngine.createTemplateFromPdf(source).then(function (template) {
      return this._applyNewTemplate(template);
    }.bind(this)).catch(function (error) {
      this._handleError("importPdfTemplate", error);
      throw error;
    }.bind(this)).finally(function () { this.setBusy(false); }.bind(this));
  };

  PdfTemplateStudio.prototype._choosePdfTemplate = function (onLoaded) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) { input.remove(); return; }
      this.importPdfTemplate(file).then(function (template) {
        if (typeof onLoaded === "function") { onLoaded(template); }
      }).catch(function () {}).finally(function () { input.remove(); });
    }.bind(this), { once: true });
    input.click();
    return input;
  };

  PdfTemplateStudio.prototype.setShowDataPanel = function (show) {
    var visible = Boolean(show);
    this.setProperty("showDataPanel", visible, true);
    if (this._dataPanelToggle) {
      this._dataPanelToggle.setPressed(visible);
      this._dataPanelToggle.setTooltip(text(this._bundle, visible ? "hideDataPanel" : "showDataPanel"));
    }
    var root = this.getDomRef();
    var panel = this.getDomRef("dataPanel");
    if (root) {
      root.classList.toggle("ui5PdfmeStudioDataPanelHidden", !visible);
    }
    if (panel) {
      panel.setAttribute("aria-hidden", String(!visible));
    }
    return this;
  };

  PdfTemplateStudio.prototype.setShowHelp = function (show) {
    var visible = Boolean(show);
    this.setProperty("showHelp", visible, true);
    if (this._helpButton) {
      this._helpButton.setVisible(visible);
    }
    return this;
  };

  PdfTemplateStudio.prototype._getHelpUrl = function () {
    return this.getHelpUrl() || defaultHelpUrl(this._getPdfLanguage());
  };

  PdfTemplateStudio.prototype.openHelp = function () {
    var url = this._getHelpUrl();
    if (this._helpDialog) {
      this._helpDialog.open();
      this.fireHelp({ url: url });
      return this._helpDialog;
    }
    var steps = ["helpStep1", "helpStep2", "helpStep3", "helpStep4", "helpStep5"];
    var content = new VBox({
      items: [new Text({ text: text(this._bundle, "helpIntro"), wrapping: true })].concat(steps.map(function (key, index) {
        return new Text({ text: String(index + 1) + ". " + text(this._bundle, key), wrapping: true });
      }.bind(this)))
    }).addStyleClass("sapUiSmallMargin ui5PdfmeHelpContent");
    this._helpDialog = new Dialog({
      title: text(this._bundle, "helpTitle"),
      contentWidth: "36rem",
      content: [content],
      beginButton: new Button({
        text: text(this._bundle, "openGuide"),
        type: "Emphasized",
        press: function () { window.open(url, "_blank", "noopener,noreferrer"); }
      }),
      endButton: new Button({ text: text(this._bundle, "close"), press: function () { this._helpDialog.close(); }.bind(this) })
    }).addStyleClass("ui5PdfmeHelpDialog");
    this.addDependent(this._helpDialog);
    this._helpDialog.open();
    this.fireHelp({ url: url });
    return this._helpDialog;
  };

  PdfTemplateStudio.prototype.toggleFullscreen = function () {
    var root = this.getDomRef();
    if (document.fullscreenElement === root) {
      return document.exitFullscreen().then(function () { return false; });
    }
    if (!root || !root.requestFullscreen) {
      return Promise.reject(new Error(text(this._bundle, "fullscreenUnavailable")));
    }
    return root.requestFullscreen().then(function () { return true; });
  };

  PdfTemplateStudio.prototype._syncFullscreenButton = function () {
    if (!this._fullscreenToggle) {
      return;
    }
    var active = document.fullscreenElement === this.getDomRef();
    this._fullscreenToggle.setPressed(active);
    this._fullscreenToggle.setIcon(active ? "sap-icon://exit-full-screen" : "sap-icon://full-screen");
    this._fullscreenToggle.setTooltip(text(this._bundle, active ? "exitFullscreen" : "enterFullscreen"));
  };

  PdfTemplateStudio.prototype.setDataSources = function (sources) {
    this._autoResolved = false;
    this._resolvedData = null;
    this._inputs = null;
    this.setProperty("dataSources", sources || [], true);
    return this;
  };

  PdfTemplateStudio.prototype.setTemplateRepositories = function (repositories) {
    var sources = repositories || [];
    this.setProperty("templateRepositories", sources, true);
    if (this._templateStore) {
      this._templateStore.configure(sources);
    }
    if (this._templateCatalogDialog) {
      this._templateCatalogDialog.destroy();
      this._templateCatalogDialog = null;
      this._templateCatalogList = null;
      this._templateCatalogSearch = null;
      this._templateCatalogStatus = null;
      this._templateCatalogRepository = null;
    }
    return this;
  };

  PdfTemplateStudio.prototype.registerTemplateRepositoryProvider = function (type, provider) {
    this._templateStore.register(type, provider);
    return this;
  };

  PdfTemplateStudio.prototype.setMapping = function (mapping) {
    this._inputs = null;
    this.setProperty("mapping", mapping, true);
    if (this._resolvedData) {
      this._updateFieldList(this._resolvedData);
    }
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
    if (config.templateRepository || config.templateRepositories) { this.setTemplateRepositories(config.templateRepositories || config.templateRepository); }
    if (config.filename) { this.setFilename(config.filename); }
    if (config.language) { this.setLanguage(config.language); }
    if (config.autoResolve !== undefined) { this.setAutoResolve(config.autoResolve); }
    if (config.showDataPanel !== undefined) { this.setShowDataPanel(config.showDataPanel); }
    if (config.showHelp !== undefined) { this.setShowHelp(config.showHelp); }
    if (config.helpUrl !== undefined) { this.setHelpUrl(config.helpUrl || ""); }
    if (config.persistDataSources !== undefined) { this.setPersistDataSources(config.persistDataSources); }
    if (config.applyStoredDataSources !== undefined) { this.setApplyStoredDataSources(config.applyStoredDataSources); }
    return this;
  };

  PdfTemplateStudio.prototype._setupFieldListIndicators = function () {
    var designer = this.getDomRef("designer");
    if (!designer) {
      return;
    }
    if (this._fieldListIndicatorObserver) {
      this._fieldListIndicatorObserver.disconnect();
    }
    this._fieldListIndicatorObserver = new MutationObserver(function () {
      this._queueFieldListIndicatorSync();
    }.bind(this));
    this._fieldListIndicatorObserver.observe(designer, { childList: true, subtree: true });
    this._queueFieldListIndicatorSync();
  };

  PdfTemplateStudio.prototype._queueFieldListIndicatorSync = function () {
    if (this._fieldListIndicatorFrame) {
      cancelAnimationFrame(this._fieldListIndicatorFrame);
    }
    this._fieldListIndicatorFrame = requestAnimationFrame(function () {
      var designer = this.getDomRef("designer");
      var template = this._designer ? this._designer.getTemplate() : this.getTemplate();
      var pageIndex = this._designer ? this._designer.getPageCursor() : 0;
      var schemas = template && template.schemas && template.schemas[pageIndex] || [];
      var rows = designer ? designer.querySelectorAll(".pdfme-designer-list-view li > div") : [];
      Array.prototype.forEach.call(rows, function (row, index) {
        var schema = schemas[index];
        var fixed = Boolean(schema && schema.fixedPosition === true && (schema.readOnly === true || schema.type === "text"));
        row.classList.toggle("pdfme-field-fixed-position", fixed);
        row.classList.toggle("pdfme-field-repeat-on-every-page", fixed && schema.repeatOnEveryPage === true);
      });
    }.bind(this));
  };

  PdfTemplateStudio.prototype._setupResponsivePanels = function () {
    if (!this._responsiveMedia) {
      this._responsiveMedia = window.matchMedia("(max-width: 50rem)");
      this._handleResponsiveChange = this._syncResponsivePanels.bind(this);
      if (this._responsiveMedia.addEventListener) {
        this._responsiveMedia.addEventListener("change", this._handleResponsiveChange);
      } else {
        this._responsiveMedia.addListener(this._handleResponsiveChange);
      }
    }
    if (this._responsiveFrame) {
      cancelAnimationFrame(this._responsiveFrame);
    }
    this._responsiveFrame = requestAnimationFrame(function () {
      this._enhanceDesignerPalette();
      this._syncResponsivePanels();
    }.bind(this));
  };

  PdfTemplateStudio.prototype._enhanceDesignerPalette = function () {
    var designer = this.getDomRef("designer");
    var palette = designer && designer.querySelector(".pdfme-designer-left-sidebar");
    if (this._barcodeGroup) {
      return;
    }
    if (!palette) {
      this._observeDesignerPalette(designer);
      return;
    }

    var barcodeTypes = [
      { selector: ".pdfme-designer-plugin-qrcode", plugin: "QRCode", label: "QR Code", kind: "matrix" },
      { selector: ".pdfme-designer-plugin-code128", plugin: "Code128", label: "Code 128", kind: "linear" },
      { selector: ".pdfme-designer-plugin-ean13", plugin: "EAN13", label: "EAN-13", kind: "linear" },
      { selector: ".pdfme-designer-plugin-gs1datamatrix", plugin: "DataMatrix", label: "Data Matrix", kind: "matrix" },
      { selector: ".pdfme-designer-plugin-pdf417", plugin: "PDF417", label: "PDF417", kind: "stacked" }
    ];
    var entries = barcodeTypes.map(function (type) {
      var sourceButton = palette.querySelector(type.selector);
      if (!sourceButton) {
        return null;
      }
      var wrapper = sourceButton;
      while (wrapper.parentElement && wrapper.parentElement !== palette) {
        wrapper = wrapper.parentElement;
      }
      if (wrapper.parentElement !== palette) {
        return null;
      }
      var sourceLabel = sourceButton.querySelector("[title]");
      return {
        button: sourceButton,
        wrapper: wrapper,
        plugin: type.plugin,
        label: sourceLabel && sourceLabel.getAttribute("title") || type.label,
        kind: type.kind
      };
    }).filter(Boolean);
    if (entries.length < 2) {
      this._observeDesignerPalette(palette);
      return;
    }
    if (this._paletteObserver) {
      this._paletteObserver.disconnect();
      this._paletteObserver = null;
    }

    var groupWrapper = document.createElement("div");
    groupWrapper.className = "ui5PdfmeBarcodeGroup";
    var groupButton = document.createElement("button");
    groupButton.type = "button";
    groupButton.className = "ant-btn ui5PdfmeBarcodeGroupButton";
    groupButton.title = text(this._bundle, "barcodes");
    groupButton.setAttribute("aria-label", text(this._bundle, "barcodes"));
    groupButton.setAttribute("aria-haspopup", "menu");
    groupButton.setAttribute("aria-expanded", "false");
    groupButton.setAttribute("aria-controls", this.getId() + "-barcode-popover");
    var groupIcon = document.createElement("span");
    groupIcon.className = "ui5PdfmeBarcodeIcon";
    groupIcon.setAttribute("aria-hidden", "true");
    groupButton.appendChild(groupIcon);
    groupWrapper.appendChild(groupButton);
    palette.insertBefore(groupWrapper, entries[0].wrapper);

    var popover = document.createElement("div");
    popover.id = this.getId() + "-barcode-popover";
    popover.className = "ui5PdfmeBarcodePopover";
    popover.setAttribute("role", "menu");
    popover.setAttribute("aria-label", text(this._bundle, "barcodes"));
    popover.hidden = true;
    var popoverTitle = document.createElement("div");
    popoverTitle.className = "ui5PdfmeBarcodePopoverTitle";
    popoverTitle.textContent = text(this._bundle, "barcodesHint");
    popover.appendChild(popoverTitle);

    entries.forEach(function (entry) {
      entry.wrapper.classList.add("ui5PdfmeBarcodeSource");
      var item = document.createElement("button");
      item.type = "button";
      item.className = "ui5PdfmeBarcodeItem";
      item.setAttribute("role", "menuitem");
      var preview = document.createElement("span");
      preview.className = "ui5PdfmeBarcodePreview ui5PdfmeBarcodePreview-" + entry.kind;
      preview.setAttribute("aria-hidden", "true");
      var label = document.createElement("span");
      label.textContent = entry.label;
      item.append(preview, label);
      item.addEventListener("click", function () {
        this._insertPalettePlugin(entry.plugin);
        this._closeBarcodePopover();
      }.bind(this));
      popover.appendChild(item);
    }, this);
    document.body.appendChild(popover);

    groupButton.addEventListener("click", function (event) {
      event.stopPropagation();
      if (popover.hidden) {
        this._openBarcodePopover();
      } else {
        this._closeBarcodePopover();
      }
    }.bind(this));
    groupButton.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        this._openBarcodePopover();
      }
    }.bind(this));
    popover.addEventListener("keydown", function (event) {
      var items = Array.prototype.slice.call(popover.querySelectorAll(".ui5PdfmeBarcodeItem"));
      var index = items.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        this._closeBarcodePopover();
        groupButton.focus();
      } else if (event.key === "ArrowDown" && items.length) {
        event.preventDefault();
        items[(index + 1) % items.length].focus();
      } else if (event.key === "ArrowUp" && items.length) {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
      }
    }.bind(this));

    this._barcodeGroup = { button: groupButton, wrapper: groupWrapper, popover: popover, palette: palette };
    this._barcodeDocumentPress = function (event) {
      if (!groupButton.contains(event.target) && !popover.contains(event.target)) {
        this._closeBarcodePopover();
      }
    }.bind(this);
    this._barcodeViewportChange = this._closeBarcodePopover.bind(this);
    document.addEventListener("pointerdown", this._barcodeDocumentPress);
    window.addEventListener("resize", this._barcodeViewportChange);
    palette.addEventListener("scroll", this._barcodeViewportChange);
  };

  PdfTemplateStudio.prototype._observeDesignerPalette = function (target) {
    if (!target || this._paletteObserver) {
      return;
    }
    this._paletteObserver = new MutationObserver(function () {
      this._enhanceDesignerPalette();
    }.bind(this));
    this._paletteObserver.observe(target, { childList: true, subtree: true });
  };

  PdfTemplateStudio.prototype._insertPalettePlugin = function (pluginName) {
    var plugin = this._pdf.getPlugins()[pluginName];
    var defaultSchema = plugin && plugin.propPanel && plugin.propPanel.defaultSchema;
    if (!defaultSchema) {
      return null;
    }
    var template = this._designer ? this._designer.getTemplate() : this.getTemplate();
    if (!template) {
      template = PdfEngine.createBlankTemplate();
    }
    var pageIndex = this._designer ? this._designer.getPageCursor() : 0;
    template.schemas[pageIndex] = template.schemas[pageIndex] || [];
    var schema = JSON.parse(JSON.stringify(defaultSchema));
    var baseName = String(schema.type || pluginName).replace(/[^A-Za-z0-9_]/g, "_") || "field";
    var names = new Set([].concat.apply([], template.schemas).map(function (item) { return item.name; }));
    var name = baseName;
    var suffix = 2;
    while (names.has(name)) {
      name = baseName + "_" + suffix;
      suffix += 1;
    }
    var basePdf = template.basePdf && typeof template.basePdf === "object" ? template.basePdf : {};
    var pageWidth = Number(basePdf.width) || 210;
    var pageHeight = Number(basePdf.height) || 297;
    var padding = Array.isArray(basePdf.padding) ? basePdf.padding : [0, 0, 0, 0];
    var row = template.schemas[pageIndex].length;
    var width = Number(schema.width) || 40;
    var height = Number(schema.height) || 20;
    schema.name = name;
    schema.position = {
      x: Math.max(padding[3] || 0, Math.round((pageWidth - width) * 50) / 100),
      y: Math.max(padding[0] || 0, Math.min(pageHeight - height - (padding[2] || 0), Math.round((pageHeight / 2 - height / 2 + row % 3 * 6) * 100) / 100))
    };
    template.schemas[pageIndex].push(schema);
    this.setProperty("template", template, true);
    if (this._designer) {
      this._designer.updateTemplate(template);
    }
    this.fireTemplateChange({ template: template });
    return name;
  };

  PdfTemplateStudio.prototype._openBarcodePopover = function () {
    if (!this._barcodeGroup) {
      return;
    }
    var button = this._barcodeGroup.button;
    var popover = this._barcodeGroup.popover;
    var buttonRect = button.getBoundingClientRect();
    popover.hidden = false;
    popover.style.visibility = "hidden";
    var popoverRect = popover.getBoundingClientRect();
    var left = buttonRect.right + 8;
    if (left + popoverRect.width > window.innerWidth - 8) {
      left = Math.max(8, buttonRect.left - popoverRect.width - 8);
    }
    var top = Math.min(Math.max(8, buttonRect.top), Math.max(8, window.innerHeight - popoverRect.height - 8));
    popover.style.left = Math.round(left) + "px";
    popover.style.top = Math.round(top) + "px";
    popover.style.visibility = "";
    button.setAttribute("aria-expanded", "true");
    var firstItem = popover.querySelector(".ui5PdfmeBarcodeItem");
    if (firstItem) {
      firstItem.focus();
    }
  };

  PdfTemplateStudio.prototype._closeBarcodePopover = function () {
    if (!this._barcodeGroup) {
      return;
    }
    this._barcodeGroup.popover.hidden = true;
    this._barcodeGroup.button.setAttribute("aria-expanded", "false");
  };

  PdfTemplateStudio.prototype._destroyPaletteEnhancements = function () {
    if (this._fieldListIndicatorObserver) {
      this._fieldListIndicatorObserver.disconnect();
      this._fieldListIndicatorObserver = null;
    }
    if (this._fieldListIndicatorFrame) {
      cancelAnimationFrame(this._fieldListIndicatorFrame);
      this._fieldListIndicatorFrame = null;
    }
    if (this._paletteObserver) {
      this._paletteObserver.disconnect();
      this._paletteObserver = null;
    }
    if (!this._barcodeGroup) {
      return;
    }
    document.removeEventListener("pointerdown", this._barcodeDocumentPress);
    window.removeEventListener("resize", this._barcodeViewportChange);
    this._barcodeGroup.palette.removeEventListener("scroll", this._barcodeViewportChange);
    this._barcodeGroup.popover.remove();
    this._barcodeGroup.wrapper.remove();
    this._barcodeGroup = null;
    this._barcodeDocumentPress = null;
    this._barcodeViewportChange = null;
  };

  PdfTemplateStudio.prototype._syncResponsivePanels = function () {
    var sidebar = this.getDomRef("designer") && this.getDomRef("designer").querySelector(".pdfme-designer-right-sidebar");
    var sidebarToggle = this.getDomRef("designer") && this.getDomRef("designer").querySelector(".pdfme-designer-sidebar-toggle");
    if (this._responsiveMedia.matches) {
      if (this.getShowDataPanel()) {
        this._autoHiddenDataPanel = true;
        this.setShowDataPanel(false);
      }
      if (sidebar && sidebarToggle && sidebar.getBoundingClientRect().width > 0) {
        sidebarToggle.click();
        this._autoCollapsedDesignerSidebar = true;
      }
    } else {
      if (this._autoHiddenDataPanel) {
        this._autoHiddenDataPanel = false;
        this.setShowDataPanel(true);
      }
      if (this._autoCollapsedDesignerSidebar && sidebar && sidebarToggle && sidebar.getBoundingClientRect().width === 0) {
        sidebarToggle.click();
        this._autoCollapsedDesignerSidebar = false;
      }
    }
  };

  PdfTemplateStudio.prototype.getResolvedData = function () {
    return this._resolvedData;
  };

  PdfTemplateStudio.prototype.getInputs = function () {
    return this._inputs;
  };

  PdfTemplateStudio.prototype._isDataBoundField = function (schema) {
    if (!schema || schema.readOnly === true || !schema.name) {
      return false;
    }
    return true;
  };

  PdfTemplateStudio.prototype._isUniqueFieldName = function (name, activeSchema) {
    if (!name) {
      return true;
    }
    var template = this._designer ? this._designer.getTemplate() : this.getTemplate();
    var matches = (template && template.schemas || []).reduce(function (count, page) {
      return count + page.filter(function (schema) { return schema.name === name; }).length;
    }, 0);
    return name === (activeSchema && activeSchema.name) ? matches <= 1 : matches === 0;
  };

  PdfTemplateStudio.prototype._getDataFieldOptions = function () {
    return dataFieldOptions(this.getMapping(), this._autoMappings, this._resolvedData);
  };

  PdfTemplateStudio.prototype._getMappingDefinition = function () {
    var configured = this.getMapping();
    var template = this._designer ? this._designer.getTemplate() : this.getTemplate();
    var configuredFields = configured && (configured.fields || configured) || {};
    var defaultFields = defaultFieldMappings(template, configuredFields);
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
    var template = this._designer ? this._designer.getTemplate() : this.getTemplate();
    var includedPaths = includedDataPaths(template, this._getMappingDefinition());
    ObjectPath.flatten(data, { maxDepth: 6 }).forEach(function (field) {
      var preview = field.kind === "array" ? field.value.length + " entries" : String(field.value === undefined || field.value === null ? "" : field.value);
      var included = includedPaths.has(canonicalDataPath(field.path));
      if (preview.length > 80) {
        preview = preview.slice(0, 77) + "…";
      }
      this._fieldList.addItem(new StandardListItem({
        title: field.path,
        description: preview,
        icon: field.kind === "array" ? "sap-icon://table-view" : "sap-icon://syntax",
        info: text(this._bundle, included ? "fieldIncluded" : "fieldNotIncluded"),
        infoState: included ? "Success" : "None",
        type: "Active",
        press: function () { this.insertDataField(field.path, field.value); }.bind(this)
      }).addStyleClass(included ? "ui5PdfmeFieldIncluded" : "ui5PdfmeFieldNotIncluded"));
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
      this._updateFieldList(this._resolvedData);
    }
    this.fireFieldInsert({ fieldName: fieldName, path: path });
    if (this._responsiveMedia && this._responsiveMedia.matches) {
      this.setShowDataPanel(false);
    }
    return fieldName;
  };

  PdfTemplateStudio.prototype.listTemplates = function (query) {
    return this._templateStore.list(query || {}).then(function (records) {
      this.fireTemplatesListed({ templates: records });
      return records;
    }.bind(this));
  };

  PdfTemplateStudio.prototype.getTemplateRecord = function (recordId, options) {
    return this._templateStore.get(recordId, options || {});
  };

  PdfTemplateStudio.prototype.loadTemplate = function (recordId, options) {
    var promise = recordId && recordId.template ? Promise.resolve(recordId) : this.getTemplateRecord(recordId, options);
    return promise.then(function (record) {
      this._activeTemplateRecord = record;
      this._autoMappings = Object.create(null);
      this.setTemplate(record.template);
      this.setMapping(record.mapping || null);
      if (this.getApplyStoredDataSources() && record.dataSources) { this.setDataSources(record.dataSources); }
      this._updateStudioTitle();
      this.fireTemplateLoaded({ record: record });
      return record;
    }.bind(this));
  };

  PdfTemplateStudio.prototype.saveTemplateRecord = function (metadata, options) {
    var previous = this._activeTemplateRecord || {};
    var input = Object.assign({}, previous, metadata || {}, {
      id: metadata && metadata.id !== undefined ? metadata.id : previous.id || "",
      name: metadata && metadata.name || previous.name || text(this._bundle, "untitledTemplate"),
      template: this._designer ? this._designer.getTemplate() : this.getTemplate(),
      mapping: metadata && metadata.mapping || this.getMapping() || previous.mapping || null
    });
    if (this.getPersistDataSources()) { input.dataSources = this.getDataSources(); } else { delete input.dataSources; }
    this.setBusy(true);
    return this._templateStore.save(input, {
      repositoryId: options && options.repositoryId || metadata && metadata.repositoryId || previous.repositoryId
    }).then(function (record) {
      this._activeTemplateRecord = record;
      this._updateStudioTitle();
      this.fireTemplatePersisted({ record: record });
      MessageToast.show(text(this._bundle, "templateSaved"));
      return record;
    }.bind(this)).catch(function (error) {
      this._handleError("saveTemplate", error);
      throw error;
    }.bind(this)).finally(function () { this.setBusy(false); }.bind(this));
  };

  PdfTemplateStudio.prototype._refreshTemplateCatalog = function () {
    if (!this._templateCatalogList) { return Promise.resolve([]); }
    this._templateCatalogList.setBusy(true);
    return this.listTemplates({
      search: this._templateCatalogSearch.getValue(),
      status: this._templateCatalogStatus.getSelectedKey(),
      repositoryId: this._templateCatalogRepository.getSelectedKey()
    }).then(function (records) {
      this._templateCatalogList.destroyItems();
      records.forEach(function (record) {
        var item = new StandardListItem({
          title: record.name,
          description: record.description || (record.tags || []).join(", "),
          info: record.status + " · v" + record.version,
          icon: "sap-icon://document-text",
          type: "Active"
        });
        item.data("templateRecord", record);
        this._templateCatalogList.addItem(item);
      }, this);
      return records;
    }.bind(this)).catch(function (error) {
      this._handleError("listTemplates", error);
      throw error;
    }.bind(this)).finally(function () { this._templateCatalogList.setBusy(false); }.bind(this));
  };

  PdfTemplateStudio.prototype.openTemplateCatalog = function () {
    var repositories = this.getTemplateRepositories() || [];
    if (this._templateCatalogDialog) {
      this._templateCatalogDialog.open();
      this._refreshTemplateCatalog();
      return this._templateCatalogDialog;
    }
    this._templateCatalogSearch = new SearchField({
      width: "100%",
      placeholder: text(this._bundle, "searchTemplates"),
      liveChange: this._refreshTemplateCatalog.bind(this),
      search: this._refreshTemplateCatalog.bind(this)
    });
    this._templateCatalogStatus = new Select({
      selectedKey: "",
      change: this._refreshTemplateCatalog.bind(this),
      items: [
        new Item({ key: "", text: text(this._bundle, "allStatuses") }),
        new Item({ key: "draft", text: text(this._bundle, "statusDraft") }),
        new Item({ key: "published", text: text(this._bundle, "statusPublished") }),
        new Item({ key: "archived", text: text(this._bundle, "statusArchived") })
      ]
    });
    this._templateCatalogRepository = new Select({ selectedKey: "", change: this._refreshTemplateCatalog.bind(this) });
    this._templateCatalogRepository.addItem(new Item({ key: "", text: text(this._bundle, "allRepositories") }));
    repositories.forEach(function (source) { this._templateCatalogRepository.addItem(new Item({ key: source.id, text: source.name || source.id })); }, this);
    this._templateCatalogList = new List({
      growing: true,
      growingThreshold: 50,
      noDataText: text(this._bundle, "noTemplates"),
      itemPress: function (event) {
        var summary = event.getParameter("listItem").data("templateRecord");
        this.loadTemplate(summary.id, { repositoryId: summary.repositoryId }).then(function () { this._templateCatalogDialog.close(); }.bind(this)).catch(function () {});
      }.bind(this)
    }).addStyleClass("ui5PdfmeTemplateCatalogList");
    var creationToolbar = new OverflowToolbar({ content: [
      new Button({
        text: text(this._bundle, "blankTemplate"),
        icon: "sap-icon://document",
        type: "Emphasized",
        press: function () {
          this.startBlankTemplate();
          this._templateCatalogDialog.close();
        }.bind(this)
      }),
      new Button({
        text: text(this._bundle, "loadPdf"),
        icon: "sap-icon://upload",
        press: function () {
          this._choosePdfTemplate(function () { this._templateCatalogDialog.close(); }.bind(this));
        }.bind(this)
      })
    ] }).addStyleClass("ui5PdfmeTemplateCreationToolbar");
    this._templateCatalogDialog = new Dialog({
      title: text(this._bundle, "templates"),
      contentWidth: "64rem",
      contentHeight: "70vh",
      stretchOnPhone: true,
      subHeader: new OverflowToolbar({ content: [this._templateCatalogSearch, this._templateCatalogStatus, this._templateCatalogRepository, new Button({ icon: "sap-icon://refresh", tooltip: text(this._bundle, "refreshTemplates"), press: this._refreshTemplateCatalog.bind(this) })] }),
      content: [creationToolbar, this._templateCatalogList],
      beginButton: new Button({ text: text(this._bundle, "saveAs"), icon: "sap-icon://save", type: "Emphasized", enabled: repositories.length > 0, press: this.openTemplateSaveDialog.bind(this) }),
      endButton: new Button({ text: text(this._bundle, "close"), press: function () { this._templateCatalogDialog.close(); }.bind(this) })
    }).addStyleClass("ui5PdfmeTemplateCatalogDialog");
    this.addDependent(this._templateCatalogDialog);
    this._templateCatalogDialog.open();
    this._refreshTemplateCatalog();
    return this._templateCatalogDialog;
  };

  PdfTemplateStudio.prototype.openTemplateSaveDialog = function () {
    var repositories = this.getTemplateRepositories() || [];
    if (!repositories.length) { MessageToast.show(text(this._bundle, "noTemplateRepositories")); return null; }
    var active = this._activeTemplateRecord || {};
    var nameInput = new Input({ value: active.name || "", required: true, placeholder: text(this._bundle, "templateName") });
    var descriptionInput = new TextArea({ value: active.description || "", rows: 3 });
    var tagsInput = new Input({ value: (active.tags || []).join(", ") });
    var statusSelect = new Select({ selectedKey: active.status || "draft", items: [
      new Item({ key: "draft", text: text(this._bundle, "statusDraft") }),
      new Item({ key: "published", text: text(this._bundle, "statusPublished") }),
      new Item({ key: "archived", text: text(this._bundle, "statusArchived") })
    ] });
    var repositorySelect = new Select({ selectedKey: active.repositoryId || repositories[0].id });
    repositories.forEach(function (source) { repositorySelect.addItem(new Item({ key: source.id, text: source.name || source.id })); });
    var form = new VBox({ items: [
      new Label({ text: text(this._bundle, "templateName"), labelFor: nameInput }), nameInput,
      new Label({ text: text(this._bundle, "templateDescription"), labelFor: descriptionInput }), descriptionInput,
      new Label({ text: text(this._bundle, "templateTags"), labelFor: tagsInput }), tagsInput,
      new Label({ text: text(this._bundle, "templateStatus"), labelFor: statusSelect }), statusSelect,
      new Label({ text: text(this._bundle, "templateRepository"), labelFor: repositorySelect }), repositorySelect
    ] }).addStyleClass("ui5PdfmeTemplateSaveForm");
    var dialog = new Dialog({
      title: text(this._bundle, "saveAs"),
      contentWidth: "32rem",
      stretchOnPhone: true,
      content: [form],
      beginButton: new Button({
        text: text(this._bundle, "save"),
        type: "Emphasized",
        press: function () {
          if (!nameInput.getValue().trim()) { nameInput.setValueState("Error"); return; }
          this.saveTemplateRecord({
            name: nameInput.getValue().trim(),
            description: descriptionInput.getValue(),
            tags: tagsInput.getValue().split(",").map(function (tag) { return tag.trim(); }).filter(Boolean),
            status: statusSelect.getSelectedKey(),
            repositoryId: repositorySelect.getSelectedKey()
          }).then(function () {
            dialog.close();
            if (this._templateCatalogDialog && this._templateCatalogDialog.isOpen()) { this._refreshTemplateCatalog(); }
          }.bind(this)).catch(function () {});
        }.bind(this)
      }),
      endButton: new Button({ text: text(this._bundle, "cancel"), press: function () { dialog.close(); } }),
      afterClose: function () { dialog.destroy(); if (this._templateSaveDialog === dialog) { this._templateSaveDialog = null; } }.bind(this)
    });
    this._templateSaveDialog = dialog;
    this.addDependent(dialog);
    dialog.open();
    return dialog;
  };

  PdfTemplateStudio.prototype.saveTemplate = function () {
    if (this._designer) {
      this._designer.saveTemplate();
    } else {
      this.fireTemplateSave({ template: this.getTemplate() });
    }
    if (this._templateStore.repositories.length) {
      if (this._activeTemplateRecord && this._activeTemplateRecord.id) {
        this.saveTemplateRecord().catch(function () {});
      } else {
        this.openTemplateSaveDialog();
      }
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
