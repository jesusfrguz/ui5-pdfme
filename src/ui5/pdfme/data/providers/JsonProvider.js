sap.ui.define([], function () {
  "use strict";

  return {
    resolve: function (source) {
      if (source.data !== undefined) {
        return source.data;
      }
      if (source.value !== undefined) {
        return source.value;
      }
      return {};
    }
  };
});
