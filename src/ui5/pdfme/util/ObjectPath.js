sap.ui.define([], function () {
  "use strict";

  function tokenize(path) {
    if (Array.isArray(path)) {
      return path.slice();
    }
    return String(path || "")
      .replace(/^\$\./, "")
      .replace(/\[(?:'([^']+)'|"([^"]+)"|(\d+))\]/g, function (_, single, double, index) {
        return "." + (single || double || index);
      })
      .replace(/^\//, "")
      .split(/[./]/)
      .filter(Boolean);
  }

  function get(object, path, defaultValue) {
    if (path === "" || path === undefined || path === null || path === "$" || path === ".") {
      return object;
    }
    var value = object;
    var parts = tokenize(path);
    for (var i = 0; i < parts.length; i += 1) {
      if (value === null || value === undefined || !Object.prototype.hasOwnProperty.call(Object(value), parts[i])) {
        return defaultValue;
      }
      value = value[parts[i]];
    }
    return value;
  }

  function flatten(object, options) {
    var result = [];
    var settings = Object.assign({ maxDepth: 5, includeArrays: true }, options);

    function visit(value, path, depth) {
      if (depth > settings.maxDepth || value === null || value === undefined || value instanceof Date) {
        result.push({ path: path, value: value, kind: "value" });
        return;
      }
      if (Array.isArray(value)) {
        if (settings.includeArrays) {
          result.push({ path: path, value: value, kind: "array" });
        }
        if (value.length && depth < settings.maxDepth) {
          visit(value[0], path ? path + "[0]" : "[0]", depth + 1);
        }
        return;
      }
      if (typeof value === "object") {
        var keys = Object.keys(value);
        if (!keys.length && path) {
          result.push({ path: path, value: value, kind: "object" });
        }
        keys.forEach(function (key) {
          visit(value[key], path ? path + "." + key : key, depth + 1);
        });
        return;
      }
      result.push({ path: path, value: value, kind: typeof value });
    }

    visit(object, "", 0);
    return result.filter(function (entry) { return entry.path; });
  }

  return {
    tokenize: tokenize,
    get: get,
    flatten: flatten
  };
});
