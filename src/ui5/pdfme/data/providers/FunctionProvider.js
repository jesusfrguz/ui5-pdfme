sap.ui.define([], function () {
  "use strict";

  return {
    resolve: function (source, context) {
      var loader = source.load || (context.loaders && context.loaders[source.loader]);
      if (typeof loader !== "function") {
        throw new Error("Function source " + source.id + " requires a load function or registered loader");
      }
      return loader(source, context);
    }
  };
});
