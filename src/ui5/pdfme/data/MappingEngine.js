sap.ui.define(["../util/ObjectPath"], function (ObjectPath) {
  "use strict";

  function asString(value) {
    if (value === undefined || value === null) {
      return "";
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  function getColumnValue(row, column) {
    if (typeof column === "string") {
      return ObjectPath.get(row, column);
    }
    return ObjectPath.get(row, column.path, column.defaultValue);
  }

  function MappingEngine(formatters) {
    this._formatters = Object.assign({
      raw: function (value) { return value; },
      json: function (value) { return JSON.stringify(value === undefined ? null : value); },
      join: function (value, options) { return Array.isArray(value) ? value.join((options && options.separator) || ", ") : value; },
      number: function (value, options) { return new Intl.NumberFormat((options && options.locale) || undefined, options || {}).format(Number(value || 0)); },
      date: function (value, options) { return value ? new Intl.DateTimeFormat((options && options.locale) || undefined, options || {}).format(new Date(value)) : ""; },
      table: function (value, options) {
        var rows = Array.isArray(value) ? value : [];
        var columns = (options && options.columns) || [];
        var matrix = columns.length ? rows.map(function (row) {
          return columns.map(function (column) { return asString(getColumnValue(row, column)); });
        }) : rows.map(function (row) { return Array.isArray(row) ? row : [row]; });
        return JSON.stringify(matrix);
      }
    }, formatters);
  }

  MappingEngine.prototype.registerFormatter = function (name, formatter) {
    if (!name || typeof formatter !== "function") {
      throw new TypeError("Formatter name and function are required");
    }
    this._formatters[name] = formatter;
    return this;
  };

  MappingEngine.prototype._resolveTemplate = function (template, data) {
    return String(template).replace(/\{([^{}]+)\}/g, function (_, path) {
      return asString(ObjectPath.get(data, path.trim(), ""));
    });
  };

  MappingEngine.prototype.resolveField = function (definition, data) {
    var value;
    var formatter;
    var options;

    if (typeof definition === "string") {
      value = ObjectPath.get(data, definition);
    } else if (definition && typeof definition === "object" && !Array.isArray(definition)) {
      if (Object.prototype.hasOwnProperty.call(definition, "value")) {
        value = definition.value;
      } else if (Object.prototype.hasOwnProperty.call(definition, "template")) {
        value = this._resolveTemplate(definition.template, data);
      } else {
        value = ObjectPath.get(data, definition.path, definition.defaultValue);
      }
      formatter = definition.formatter;
      options = definition.options || definition;
    } else {
      value = definition;
    }

    if (formatter) {
      var formatterFunction = typeof formatter === "function" ? formatter : this._formatters[formatter];
      if (!formatterFunction) {
        throw new Error("Unknown PDF mapping formatter: " + formatter);
      }
      value = formatterFunction(value, options, data);
    }
    return asString(value);
  };

  MappingEngine.prototype.map = function (data, fields) {
    var that = this;
    return Object.keys(fields || {}).reduce(function (input, fieldName) {
      input[fieldName] = that.resolveField(fields[fieldName], data);
      return input;
    }, {});
  };

  MappingEngine.prototype.mapInputs = function (data, definition) {
    var config = definition || {};
    var fields = config.fields || config;
    if (!config.repeat) {
      return [this.map(data, fields)];
    }
    var records = ObjectPath.get(data, config.repeat, []);
    if (!Array.isArray(records)) {
      throw new Error("Mapping repeat path must resolve to an array: " + config.repeat);
    }
    return records.map(function (record, index) {
      var scope = Object.assign({}, data, { $item: record, $index: index });
      return this.map(scope, fields);
    }, this);
  };

  return MappingEngine;
});
