const fs = require("node:fs");
const vm = require("node:vm");

module.exports = function loadUi5Module(file, dependencies = {}) {
  let moduleValue;
  const source = fs.readFileSync(file, "utf8");
  const sandbox = {
    sap: {
      ui: {
        define(names, factory) {
          moduleValue = factory(...names.map((name) => {
            if (!Object.prototype.hasOwnProperty.call(dependencies, name)) {
              throw new Error(`Missing mocked UI5 dependency '${name}' for ${file}`);
            }
            return dependencies[name];
          }));
        }
      }
    },
    Array,
    Date,
    Error,
    Intl,
    JSON,
    Map,
    Math,
    Object,
    Promise,
    Set,
    String,
    TypeError,
    console,
    globalThis
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return moduleValue;
};
