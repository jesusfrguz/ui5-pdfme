const assert = require("node:assert/strict");
const path = require("node:path");
const cds = require("@sap/cds");

const api = cds.test(path.resolve(__dirname, ".."));
const service = "/odata/v4/pdf-templates/Templates";
const viewer = { auth: { username: "viewer", password: "viewer" } };
const editor = { auth: { username: "editor", password: "editor" } };

const template = JSON.stringify({ basePdf: {}, schemas: [[]] });
const input = (ID) => ({
  ID,
  Name: "Integration template",
  Description: "",
  Tags: "[]",
  Status: "draft",
  Version: 1,
  TemplateJson: template,
  MetadataJson: "{}"
});

async function rejectedStatus(operation) {
  try {
    const response = await operation;
    return response.status;
  }
  catch (error) {
    return error.status || error.response?.status;
  }
}

describe("PdfTemplateService", () => {
  it("enforces roles, validates input, and updates with dynamic ETags", async () => {
    const ID = `integration-${Date.now()}`;

    assert.equal(await rejectedStatus(api.POST(service, input(`${ID}-viewer`), viewer)), 403);
    assert.equal(await rejectedStatus(api.POST(service, { ...input(`${ID}-bad`), ID: "bad/id" }, editor)), 400);
    assert.equal(await rejectedStatus(api.POST(service, { ...input(`${ID}-json`), MappingJson: "" }, editor)), 400);

    const created = await api.POST(service, input(ID), editor);
    assert.equal(created.status, 201);
    assert.equal(created.data.Version, 1);

    const loaded = await api.GET(`${service}('${ID}')`, viewer);
    const etag = loaded.data["@odata.etag"] || loaded.headers?.get?.("etag") || loaded.headers?.etag;
    assert.ok(etag, "GET must return an ETag");

    const updated = await api.PATCH(`${service}('${ID}')`, { Name: "Updated without body Version" }, {
      ...editor,
      headers: { "if-match": etag }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.Version, 2);

    assert.equal(await rejectedStatus(api.PATCH(`${service}('${ID}')`, { Name: "Stale" }, {
      ...editor,
      headers: { "if-match": etag }
    })), 412);

    const maxID = `${ID}-max`;
    await api.POST(service, { ...input(maxID), Version: 2147483647 }, editor);
    const maxRecord = await api.GET(`${service}('${maxID}')`, viewer);
    const maxEtag = maxRecord.data["@odata.etag"] || maxRecord.headers?.get?.("etag") || maxRecord.headers?.etag;
    assert.equal(await rejectedStatus(api.PATCH(`${service}('${maxID}')`, { Name: "Overflow" }, {
      ...editor,
      headers: { "if-match": maxEtag }
    })), 409);
  });
});
