sap.ui.define([], function () {
  "use strict";

  function getModel(source, context) {
    if (source.model) {
      return source.model;
    }
    var owner = context.owner || context.control;
    if (owner && typeof owner.getModel === "function") {
      return owner.getModel(source.modelName);
    }
    if (context.models) {
      return context.models[source.modelName || "default"];
    }
    return null;
  }

  function isV4(model) {
    return Boolean(model && typeof model.isA === "function" && model.isA("sap.ui.model.odata.v4.ODataModel"));
  }

  function readV2(model, source) {
    return new Promise(function (resolve, reject) {
      model.read(source.path, {
        context: source.context,
        filters: source.filters,
        sorters: source.sorters,
        urlParameters: source.urlParameters || source.query,
        groupId: source.groupId,
        success: function (data) {
          if (source.unwrapResults !== false && data && Array.isArray(data.results)) {
            resolve(data.results);
          } else {
            resolve(data);
          }
        },
        error: reject
      });
    });
  }

  async function readV4(model, source) {
    var parameters = source.parameters || source.query || {};
    if (source.kind === "list" || source.collection === true) {
      var listBinding = model.bindList(source.path, source.context, source.sorters, source.filters, parameters);
      var contexts = await listBinding.requestContexts(source.skip || 0, source.top || source.length || 100);
      return Promise.all(contexts.map(function (itemContext) {
        return typeof itemContext.requestObject === "function" ? itemContext.requestObject() : itemContext.getObject();
      }));
    }
    return model.bindContext(source.path, source.context, parameters).requestObject();
  }

  return {
    resolve: function (source, context) {
      var model = getModel(source, context);
      if (!model) {
        throw new Error("UI5 model not found for source " + source.id);
      }
      if (!source.path) {
        throw new Error("UI5 model source " + source.id + " requires a path");
      }
      if (isV4(model)) {
        return readV4(model, source);
      }
      if (typeof model.read === "function") {
        return readV2(model, source);
      }
      if (typeof model.getProperty === "function") {
        return model.getProperty(source.path, source.context);
      }
      throw new Error("Unsupported UI5 model for source " + source.id);
    }
  };
});
