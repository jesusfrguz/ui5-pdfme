sap.ui.define([], function () {
  "use strict";

  function DataProviderRegistry() {
    this._providers = Object.create(null);
  }

  DataProviderRegistry.prototype.register = function (type, provider) {
    if (!type || !provider || (typeof provider !== "function" && typeof provider.resolve !== "function")) {
      throw new TypeError("A provider type and a resolve function are required");
    }
    this._providers[type] = provider;
    return this;
  };

  DataProviderRegistry.prototype.unregister = function (type) {
    delete this._providers[type];
    return this;
  };

  DataProviderRegistry.prototype.has = function (type) {
    return Boolean(this._providers[type]);
  };

  DataProviderRegistry.prototype.get = function (type) {
    var provider = this._providers[type];
    if (!provider) {
      throw new Error("Unknown PDF data provider: " + type);
    }
    return provider;
  };

  DataProviderRegistry.prototype.list = function () {
    return Object.keys(this._providers);
  };

  DataProviderRegistry.prototype.resolve = function (source, context) {
    var provider = this.get(source.type);
    var resolver = typeof provider === "function" ? provider : provider.resolve.bind(provider);
    return Promise.resolve(resolver(source, context || {}));
  };

  return DataProviderRegistry;
});
