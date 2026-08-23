sap.ui.define([
  "./DataProviderRegistry",
  "./providers/JsonProvider",
  "./providers/RestProvider",
  "./providers/FunctionProvider",
  "./providers/Ui5ModelProvider"
], function (DataProviderRegistry, JsonProvider, RestProvider, FunctionProvider, Ui5ModelProvider) {
  "use strict";

  function createDefaultRegistry() {
    return new DataProviderRegistry()
      .register("json", JsonProvider)
      .register("rest", RestProvider)
      .register("function", FunctionProvider)
      .register("ui5-model", Ui5ModelProvider)
      .register("odata", Ui5ModelProvider);
  }

  function DataResolver(registry) {
    this._registry = registry || createDefaultRegistry();
  }

  DataResolver.createDefaultRegistry = createDefaultRegistry;

  DataResolver.prototype.getRegistry = function () {
    return this._registry;
  };

  DataResolver.prototype.resolve = async function (sources, context) {
    var pending = (sources || []).slice();
    var result = {};
    var ids = new Set();
    var runtime = Object.assign({}, context, { data: result });

    pending.forEach(function (source) {
      if (!source || !source.id || !source.type) {
        throw new Error("Each data source requires a unique id and a type");
      }
      if (ids.has(source.id)) {
        throw new Error("Duplicate data source id: " + source.id);
      }
      ids.add(source.id);
    });

    while (pending.length) {
      var ready = pending.filter(function (source) {
        return (source.dependsOn || []).every(function (dependency) {
          return Object.prototype.hasOwnProperty.call(result, dependency);
        });
      });
      if (!ready.length) {
        throw new Error("Circular or missing data-source dependency: " + pending.map(function (item) { return item.id; }).join(", "));
      }

      await Promise.all(ready.map(async function (source) {
        try {
          result[source.id] = await this._registry.resolve(source, runtime);
        } catch (error) {
          if (source.optional) {
            result[source.id] = source.defaultValue;
            return;
          }
          error.message = "Data source '" + source.id + "': " + error.message;
          throw error;
        }
      }, this));

      var completed = new Set(ready);
      pending = pending.filter(function (source) { return !completed.has(source); });
    }

    return result;
  };

  return DataResolver;
});
