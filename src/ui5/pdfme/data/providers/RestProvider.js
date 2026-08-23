sap.ui.define([], function () {
  "use strict";

  return {
    resolve: async function (source, context) {
      var fetchImpl = source.fetch || context.fetch || globalThis.fetch;
      if (typeof fetchImpl !== "function") {
        throw new Error("No fetch implementation is available for REST source " + source.id);
      }
      if (!source.url) {
        throw new Error("REST source " + source.id + " requires a URL");
      }

      var response = await fetchImpl(source.url, {
        method: source.method || "GET",
        headers: source.headers,
        body: source.body,
        credentials: source.credentials || "same-origin",
        signal: context.signal
      });

      if (!response.ok) {
        throw new Error("REST source " + source.id + " failed with HTTP " + response.status);
      }
      if (source.responseType === "text") {
        return response.text();
      }
      if (source.responseType === "blob") {
        return response.blob();
      }
      return response.json();
    }
  };
});
