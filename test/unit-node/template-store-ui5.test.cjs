const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const loadUi5Module = require("./loadUi5Module.cjs");

const root = path.resolve(__dirname, "../..");
const TemplateStore = loadUi5Module(path.join(root, "src/ui5/pdfme/template/TemplateStore.js"));
const ExampleTemplateSeeder = loadUi5Module(path.join(root, "test/ui5/pdfme/demokit/model/ExampleTemplateSeeder.js"));
const template = { basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] }, schemas: [[]] };

test("UI5 TemplateStore lists, filters, saves and gets templates", async () => {
  const store = new TemplateStore({ id: "memory", type: "memory", records: [{ id: "one", name: "Invoice", status: "published", tags: ["sales"], template }] });
  assert.equal((await store.list({ search: "sales" })).length, 1);
  const saved = await store.save({ name: "Receipt", template });
  assert.ok(saved.id);
  assert.equal((await store.get(saved.id)).name, "Receipt");
});

test("UI5 OData writes an Int32 version, uses a dynamic ETag and leaves audit fields to the backend", async () => {
  let update;
  const model = {
    isA: () => false,
    update: (pathValue, entity, settings) => {
      update = { path: pathValue, entity, settings };
      settings.success({ ID: "invoice-es", Name: "Invoice", Version: 5, TemplateJson: JSON.stringify(template), __metadata: { etag: 'W/"v5"' } });
    }
  };
  const store = new TemplateStore({ id: "gateway", type: "odata", model, path: "/Templates" });
  const saved = await store.save({ id: "invoice-es", name: "Invoice", version: "4", etag: 'W/"v4"', createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", template });

  assert.equal(saved.id, "invoice-es");
  assert.equal(saved.version, "5");
  assert.equal(saved.etag, 'W/"v5"');
  assert.equal(update.path, "/Templates('invoice-es')");
  assert.equal(update.entity.Version, 4);
  assert.equal(update.settings.eTag, 'W/"v4"');
  assert.equal(Object.hasOwn(update.entity, "ID"), false);
  assert.equal(Object.hasOwn(update.entity, "CreatedAt"), false);
  assert.equal(Object.hasOwn(update.entity, "UpdatedAt"), false);
});

test("UI5 OData normalizes V2 ETags and can require one before update", async () => {
  let updates = 0;
  const model = {
    isA: () => false,
    read: (pathValue, settings) => settings.success({ ID: "invoice-es", Name: "Invoice", CreatedAt: "/Date(0+0060)/", UpdatedAt: new Date(1000), __metadata: { etag: 'W/"v2"' } }),
    update: () => { updates += 1; }
  };
  const store = new TemplateStore({ id: "gateway", type: "odata", model, path: "/Templates", requireEtag: true });
  const loaded = await store.get("invoice-es");
  assert.equal(loaded.etag, 'W/"v2"');
  assert.equal(loaded.createdAt, "1970-01-01T01:00:00.000Z");
  assert.equal(loaded.updatedAt, "1970-01-01T00:00:01.000Z");
  await assert.rejects(store.save({ id: "invoice-es", name: "Invoice", version: "4", template }), /requires an ETag/);
  assert.equal(updates, 0);
});

test("UI5 OData rejects non-canonical decimal versions before model updates", async () => {
  let updates = 0;
  const model = { isA: () => false, update: () => { updates += 1; } };
  const store = new TemplateStore({ id: "gateway", type: "odata", model, path: "/Templates" });
  for (const version of ["1e3", "0x10", " 7 ", "01", "1.5", "0", "2147483648"]) {
    assert.throws(() => store.save({ id: "invoice-es", name: "Invoice", version, template }), /OData Version must be an Int32/);
  }
  assert.equal(updates, 0);
});

test("UI5 OData V4 enforces maxRecords on each page request", async () => {
  const requests = [];
  const model = {
    isA: (name) => name === "sap.ui.model.odata.v4.ODataModel",
    bindList: () => ({
      requestContexts: async (skip, length) => {
        requests.push({ skip, length });
        return Array.from({ length }, (_, index) => ({ getObject: () => ({ ID: `id-${skip + index}`, Name: `Item ${skip + index}` }) }));
      }
    })
  };
  const store = new TemplateStore({ id: "v4", type: "odata", model, path: "/Templates", pageSize: 100, maxRecords: 10 });
  assert.equal((await store.list()).length, 10);
  assert.deepEqual(requests, [{ skip: 0, length: 10 }]);
});

test("UI5 OData V2 follows server next links within maxRecords", async () => {
  const reads = [];
  const model = {
    isA: () => false,
    read: (pathValue, settings) => {
      reads.push({ path: pathValue, urlParameters: settings.urlParameters });
      if (reads.length === 1) settings.success({ results: [{ ID: "a", Name: "A" }, { ID: "b", Name: "B" }], __next: "https://sap.example.test/sap/opu/odata/ZPDFME_SRV/Templates?%24skiptoken=2" });
      else settings.success({ results: [{ ID: "c", Name: "C" }, { ID: "d", Name: "D" }] });
    }
  };
  const store = new TemplateStore({ id: "v2", type: "odata", model, path: "/Templates", maxRecords: 3 });
  const records = await store.list();
  assert.equal(Array.from(records, ({ id }) => id).sort().join(","), "a,b,c");
  assert.deepEqual(reads.map(({ path: pathValue }) => pathValue), ["/Templates", "/Templates"]);
  assert.equal(reads[1].urlParameters.$skiptoken, "2");
});

test("UI5 OData V4 waits for property updates and returns refreshed state", async () => {
  let release;
  let refreshed = false;
  let dataReceived;
  const refreshGroups = [];
  const updateDone = new Promise((resolve) => { release = resolve; });
  const boundContext = { setProperty: () => updateDone };
  const binding = {
    requestObject: async () => (refreshed
      ? { ID: "invoice-es", Name: "Invoice 2", Version: 5, TemplateJson: JSON.stringify(template), "@odata.etag": 'W/"5"' }
      : { ID: "invoice-es", Name: "Invoice", Version: 4, "@odata.etag": 'W/"4"' }),
    getBoundContext: () => boundContext,
    attachEventOnce: (name, handler) => { assert.equal(name, "dataReceived"); dataReceived = handler; },
    refresh: (groupId) => {
      refreshGroups.push(groupId);
      refreshed = true;
      queueMicrotask(() => dataReceived({ getParameter: () => undefined }));
    }
  };
  const model = {
    isA: (name) => name === "sap.ui.model.odata.v4.ODataModel",
    bindContext: () => binding,
    submitBatch: async () => undefined
  };
  const store = new TemplateStore({ id: "v4", type: "odata", model, path: "/Templates", updateGroupId: "templates", requireEtag: true });
  let settled = false;
  const saving = store.save({ id: "invoice-es", name: "Invoice 2", version: "4", etag: 'W/"4"', template }).then((record) => { settled = true; return record; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  release();
  const saved = await saving;
  assert.equal(saved.version, "5");
  assert.equal(saved.etag, 'W/"5"');
  assert.deepEqual(refreshGroups, ["$direct"]);
});

test("UI5 OData V4 rejects a stale editor ETag before changing properties", async () => {
  let updates = 0;
  const binding = {
    requestObject: async () => ({ ID: "invoice-es", Name: "Invoice", Version: 5, "@odata.etag": 'W/"5"' }),
    getBoundContext: () => ({ setProperty: () => { updates += 1; } })
  };
  const model = {
    isA: (name) => name === "sap.ui.model.odata.v4.ODataModel",
    bindContext: () => binding
  };
  const store = new TemplateStore({ id: "v4", type: "odata", model, path: "/Templates", requireEtag: true });
  await assert.rejects(
    store.save({ id: "invoice-es", name: "Invoice 2", version: "4", etag: 'W/"4"', template }),
    /ETag is stale/
  );
  assert.equal(updates, 0);
});

test("UI5 demo migrates older high-version examples by bundled revision", () => {
  const key = "ui5-pdfme.demo.templates";
  const values = new Map([[key, JSON.stringify([
    { id: "invoice-demo", name: "Old invoice", version: "9", template: { basePdf: { padding: [40, 12, 40, 12] }, schemas: [[]] } },
    { id: "purchase-order-demo", name: "Old purchase order", version: "12", template: { basePdf: { padding: [12, 12, 25, 12] }, schemas: [[]] } },
    { id: "user-template", name: "User template", version: "20", template }
  ])]]);
  const storage = {
    getItem: (name) => values.get(name) || null,
    setItem: (name, value) => values.set(name, value)
  };
  const corrected = [
    {
      id: "invoice-demo",
      name: "Invoice demo",
      version: "7",
      metadata: { exampleRevision: 1 },
      template: { basePdf: { padding: [12, 12, 12, 12] }, schemas: [[]] }
    },
    {
      id: "purchase-order-demo",
      name: "Purchase order demo",
      version: "2",
      metadata: { exampleRevision: 1 },
      template: { basePdf: { padding: [12, 12, 12, 12] }, schemas: [[]] }
    }
  ];

  const seeded = ExampleTemplateSeeder.seed(storage, key, corrected);

  assert.equal(seeded.find(({ id }) => id === "invoice-demo").version, "10");
  assert.deepEqual(seeded.find(({ id }) => id === "invoice-demo").template.basePdf.padding, [12, 12, 12, 12]);
  assert.equal(seeded.find(({ id }) => id === "purchase-order-demo").version, "13");
  assert.deepEqual(seeded.find(({ id }) => id === "purchase-order-demo").template.basePdf.padding, [12, 12, 12, 12]);
  assert.equal(seeded.find(({ id }) => id === "user-template").version, "20");
});
