sap.ui.define([
  "@pdfme/ui",
  "@pdfme/generator",
  "@pdfme/schemas",
  "@pdfme/common"
], function (PdfmeUi, PdfmeGenerator, Schemas, Common) {
  "use strict";

  var FIXED_POSITION_VALUE_PREFIX = "\u0000ui5-pdfme-fixed:";
  var FIXED_INPUT_ALIAS = "__ui5PdfmeFixedInputAlias";
  var FIXED_INPUT_NAME = "__ui5PdfmeFixedInputName";

  function formatFieldValueWithLabel(schema, value) {
    var textValue = String(value == null ? "" : value);
    var label = String(schema && schema.label != null ? schema.label : "").trim();
    var dataBound = schema && (schema.readOnly !== true || Boolean(schema[FIXED_INPUT_ALIAS]));
    return schema && schema.type === "text" && dataBound && schema.showLabel === true && label
      ? label + ": " + textValue
      : textValue;
  }

  function wrapFixedPdf(pdf, supportsFieldLabel) {
    if (typeof pdf !== "function") {
      return pdf;
    }
    return function (args) {
      var value = String(args && args.value != null ? args.value : "");
      var match = value.match(/^\u0000ui5-pdfme-fixed:(\d+):(\d+)\u0000/);
      if (!match) {
        return pdf(Object.assign({}, args, {
          value: supportsFieldLabel ? formatFieldValueWithLabel(args && args.schema, value) : value
        }));
      }
      if (Number(match[1]) !== Number(match[2])) {
        return Promise.resolve();
      }
      value = value.slice(match[0].length);
      return pdf(Object.assign({}, args, {
        value: supportsFieldLabel ? formatFieldValueWithLabel(args && args.schema, value) : value
      }));
    };
  }

  function wrapFieldLabelUi(ui, supportsFieldLabel) {
    if (!supportsFieldLabel || typeof ui !== "function") {
      return ui;
    }
    return function (args) {
      var schema = args && args.schema;
      var showLabel = schema && schema.readOnly !== true && schema.showLabel === true && String(schema.label || "").trim();
      return ui(Object.assign({}, args, {
        value: formatFieldValueWithLabel(schema, args && args.value),
        mode: showLabel && args.mode === "designer" ? "viewer" : args.mode
      }));
    };
  }

  function fieldLabelToggle(props) {
    var activeSchema = props.activeSchema;
    var dataBound = activeSchema && activeSchema.readOnly !== true;
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = dataBound ? activeSchema.showLabel === true : true;
    checkbox.disabled = !dataBound;
    checkbox.onchange = function (event) {
      props.changeSchemas([{
        key: "showLabel",
        value: event.target.checked,
        schemaId: activeSchema.id
      }]);
    };
    var container = document.createElement("label");
    var label = document.createElement("span");
    label.textContent = props.i18n("showLabel");
    label.style.marginLeft = "0.5rem";
    container.style.cssText = "display:flex;width:100%;";
    container.style.opacity = dataBound ? "1" : "0.5";
    container.appendChild(checkbox);
    container.appendChild(label);
    props.rootElement.appendChild(container);
  }

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

  function withLockedFieldNames(plugins, isDataBound, isUniqueName, getDataFieldOptions) {
    var protectedPlugins = {};
    Object.keys(plugins || {}).forEach(function (label) {
      var plugin = plugins[label];
      if (!plugin || !plugin.propPanel) {
        protectedPlugins[label] = plugin ? Object.assign({}, plugin, { pdf: wrapFixedPdf(plugin.pdf, false) }) : plugin;
        return;
      }
      var originalSchema = plugin.propPanel.schema;
      var originalDefaultSchema = plugin.propPanel.defaultSchema;
      var supportsFieldLabel = originalDefaultSchema && originalDefaultSchema.type === "text";
      var supportsDataBinding = !originalDefaultSchema || originalDefaultSchema.readOnly !== true;
      var defaultSchema = originalDefaultSchema && originalDefaultSchema.readOnly === undefined
        ? Object.assign({}, originalDefaultSchema, { readOnly: true })
        : originalDefaultSchema;
      protectedPlugins[label] = Object.assign({}, plugin, {
        pdf: wrapFixedPdf(plugin.pdf, supportsFieldLabel),
        ui: wrapFieldLabelUi(plugin.ui, supportsFieldLabel),
        propPanel: Object.assign({}, plugin.propPanel, {
          widgets: Object.assign({}, plugin.propPanel.widgets || {}, supportsFieldLabel ? {
            FieldLabelToggle: fieldLabelToggle
          } : {}),
          defaultSchema: defaultSchema,
          schema: function (props) {
            var dataBound = isDataBound ? isDataBound(props.activeSchema) : false;
            var supportsFixedPosition = props.activeSchema && (props.activeSchema.readOnly === true || props.activeSchema.type === "text");
            var dataOptions = dataBound && getDataFieldOptions ? getDataFieldOptions(props.activeSchema).filter(function (option) {
              return option.value === (props.activeSchema && props.activeSchema.name) || !isUniqueName || isUniqueName(option.value, props.activeSchema);
            }) : [];
            return Object.assign(
              {},
              typeof originalSchema === "function" ? originalSchema(props) : originalSchema || {},
              supportsDataBinding ? {
                editable: {
                  title: props.i18n("editable"),
                  type: "boolean",
                  span: 8,
                  hidden: false
                }
              } : {},
              supportsFieldLabel ? {
                showLabelControl: {
                  type: "boolean",
                  widget: "FieldLabelToggle",
                  bind: false,
                  span: 12,
                  hidden: false
                },
                label: {
                  title: props.i18n("labelText"),
                  type: "string",
                  span: 12,
                  hidden: !dataBound || props.activeSchema.showLabel !== true,
                  props: { title: props.i18n("labelTextHelp"), autoComplete: "off" }
                }
              } : {},
              {
                fixedPosition: {
                  title: props.i18n("fixedPosition"),
                  type: "boolean",
                  span: 12,
                  hidden: !supportsFixedPosition || !props.basePdf || typeof props.basePdf !== "object" || !Array.isArray(props.basePdf.padding),
                  props: { title: props.i18n("fixedPositionHelp") }
                },
                repeatOnEveryPage: {
                  title: props.i18n("repeatOnEveryPage"),
                  type: "boolean",
                  span: 12,
                  hidden: !supportsFixedPosition || props.activeSchema.fixedPosition !== true || !props.basePdf || typeof props.basePdf !== "object" || !Array.isArray(props.basePdf.padding),
                  props: { title: props.i18n("repeatOnEveryPageHelp") }
                },
                name: {
                  title: props.i18n("fieldName"),
                  type: "string",
                  required: true,
                  span: 12,
                  disabled: false,
                  widget: dataBound ? "select" : undefined,
                  rules: [{
                    validator: function (_rule, value) {
                      if (isUniqueName) {
                        return isUniqueName(value, props.activeSchema);
                      }
                      return !(props.schemas || []).some(function (schema) {
                        return schema.name === value && schema.id !== (props.activeSchema && props.activeSchema.id);
                      });
                    },
                    message: props.i18n("validation.uniqueName")
                  }].concat(dataBound ? [{
                    validator: function (_rule, value) {
                      return dataOptions.some(function (option) { return option.value === value; });
                    },
                    message: props.i18n("fieldDataNotFound")
                  }] : []),
                  props: {
                    autoComplete: "off",
                    title: props.i18n(dataBound ? "fieldDataBound" : "fieldIdentifierHelp"),
                    options: dataBound ? dataOptions : undefined,
                    showSearch: dataBound ? true : undefined,
                    optionFilterProp: dataBound ? "label" : undefined,
                    notFoundContent: dataBound ? props.i18n("fieldDataNotFound") : undefined,
                    className: dataBound ? "pdfme-field-data-select" : undefined,
                    prefix: dataBound ? " " : undefined,
                    classNames: dataBound ? { prefix: "pdfme-field-data-icon" } : undefined
                  }
                }
              }
            );
          }
        })
      });
    });
    return protectedPlugins;
  }

  function PdfEngine(options) {
    this._plugins = withLockedFieldNames(
      Object.assign(createDefaultPlugins(), options && options.plugins),
      options && options.isDataBound,
      options && options.isUniqueName,
      options && options.getDataFieldOptions
    );
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

  PdfEngine.createTemplateFromPdf = function (source) {
    var dataPromise = typeof Blob !== "undefined" && source instanceof Blob
      ? source.arrayBuffer()
      : Promise.resolve(source);
    return dataPromise.then(function (data) {
      if (typeof data === "string") {
        if (data.indexOf("data:application/pdf;") !== 0) {
          throw new TypeError("A PDF file is required");
        }
      } else {
        var bytes = data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : null;
        var header = bytes ? String.fromCharCode.apply(null, bytes.subarray(0, Math.min(bytes.length, 1024))) : "";
        if (header.indexOf("%PDF-") === -1) {
          throw new TypeError("A PDF file is required");
        }
      }
      return Common.getB64BasePdf(data).then(function (basePdf) {
        return { basePdf: basePdf, schemas: [[]] };
      });
    });
  };

  function reserveRepeatedFixedFieldMargins(basePdf, fixedSchemas) {
    var pageHeight = Number(basePdf.height);
    if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
      return basePdf.padding;
    }
    var padding = basePdf.padding.map(function (value) { return Number(value) || 0; });
    fixedSchemas.forEach(function (schema) {
      if (schema.repeatOnEveryPage !== true) {
        return;
      }
      var y = Number(schema.position && schema.position.y);
      var height = Number(schema.height);
      if (!Number.isFinite(y) || !Number.isFinite(height) || height < 0) {
        return;
      }
      var top = Math.max(0, Math.min(pageHeight, y));
      var bottom = Math.max(top, Math.min(pageHeight, y + height));
      if ((top + bottom) / 2 <= pageHeight / 2) {
        padding[0] = Math.max(padding[0], bottom);
      } else {
        padding[2] = Math.max(padding[2], pageHeight - top);
      }
    });
    return padding;
  }

  PdfEngine.prepareTemplateForGeneration = function (template) {
    var basePdf = template && template.basePdf;
    if (!basePdf || typeof basePdf !== "object" || !Array.isArray(basePdf.padding) || !template || !Array.isArray(template.schemas)) {
      return template;
    }
    var fixedSchemas = [];
    var schemas = template.schemas.map(function (page, pageIndex) {
      return (Array.isArray(page) ? page : []).filter(function (schema, schemaIndex) {
        var fixed = schema && schema.fixedPosition === true;
        if (fixed) {
          var repeats = schema.repeatOnEveryPage === true;
          var inputAlias = schema.readOnly === true ? null : "__ui5PdfmeFixed_" + pageIndex + "_" + schemaIndex;
          var content = inputAlias ? "{" + inputAlias + "}" : (schema.content || "");
          fixedSchemas.push(Object.assign({}, schema, {
            readOnly: true,
            content: repeats ? content : FIXED_POSITION_VALUE_PREFIX + (pageIndex + 1) + ":{currentPage}\u0000" + content,
            required: false
          }, inputAlias ? {
            __ui5PdfmeFixedInputAlias: inputAlias,
            __ui5PdfmeFixedInputName: schema.name
          } : {}));
        }
        return !fixed;
      });
    });
    if (!fixedSchemas.length) {
      return template;
    }
    var fixedNames = new Set(fixedSchemas.map(function (schema) { return schema.name; }));
    var existingStaticSchemas = Array.isArray(basePdf.staticSchema)
      ? basePdf.staticSchema.filter(function (schema) { return !fixedNames.has(schema.name); })
      : [];
    return Object.assign({}, template, {
      basePdf: Object.assign({}, basePdf, {
        padding: reserveRepeatedFixedFieldMargins(basePdf, fixedSchemas),
        staticSchema: existingStaticSchemas.concat(fixedSchemas)
      }),
      schemas: schemas
    });
  };

  PdfEngine.prepareInputsForGeneration = function (template, inputs) {
    var staticSchemas = template && template.basePdf && Array.isArray(template.basePdf.staticSchema)
      ? template.basePdf.staticSchema
      : [];
    var bindings = staticSchemas.filter(function (schema) {
      return schema && schema[FIXED_INPUT_ALIAS] && schema[FIXED_INPUT_NAME];
    });
    if (!bindings.length || !Array.isArray(inputs)) {
      return inputs;
    }
    return inputs.map(function (input) {
      var prepared = Object.assign({}, input || {});
      bindings.forEach(function (schema) {
        var value = input && input[schema[FIXED_INPUT_NAME]];
        prepared[schema[FIXED_INPUT_ALIAS]] = value == null ? "" : value;
      });
      return prepared;
    });
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
    var preparedTemplate = PdfEngine.prepareTemplateForGeneration(template);
    return PdfmeGenerator.generate({
      template: preparedTemplate,
      inputs: PdfEngine.prepareInputsForGeneration(preparedTemplate, inputs),
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
