sap.ui.define([], function () {
  "use strict";

  function parseMetadata(record) {
    var metadata = record && record.metadata || {};
    if (typeof metadata === "string") {
      try { metadata = JSON.parse(metadata); } catch (ignore) { metadata = {}; }
    }
    return metadata || {};
  }

  function seed(storage, storageKey, examples) {
    var stored = JSON.parse(storage.getItem(storageKey) || "[]");
    if (!Array.isArray(stored)) {
      stored = [];
    }
    examples.forEach(function (example) {
      var storedIndex = stored.findIndex(function (candidate) { return candidate.id === example.id; });
      var exampleRevision = Number(parseMetadata(example).exampleRevision || 0);
      if (storedIndex < 0) {
        stored.push(example);
        return;
      }
      var storedRevision = Number(parseMetadata(stored[storedIndex]).exampleRevision || 0);
      if (storedRevision < exampleRevision || Number(stored[storedIndex].version || 0) < Number(example.version || 0)) {
        stored[storedIndex] = Object.assign({}, example, {
          version: String(Math.max(Number(stored[storedIndex].version || 0), Number(example.version || 0)) + 1)
        });
      }
    });
    storage.setItem(storageKey, JSON.stringify(stored));
    return stored;
  }

  return { seed: seed };
});
