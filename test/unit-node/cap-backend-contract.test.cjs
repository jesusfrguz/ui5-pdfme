const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const capRoot = path.join(root, "examples", "backend", "cap");
const schema = fs.readFileSync(path.join(capRoot, "db", "schema.cds"), "utf8");
const service = fs.readFileSync(path.join(capRoot, "srv", "template-service.cds"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(capRoot, "package.json"), "utf8"));
const integrationTest = fs.readFileSync(path.join(capRoot, "test", "template-service.test.js"), "utf8");
const { LIMITS, normalizeTemplateInput } = require(path.join(capRoot, "srv", "template-contract.js"));

const validTemplate = () => ({
  ID: "invoice-es",
  Name: "Spanish invoice",
  Description: "Approved template",
  Tags: '["sales","es"]',
  Status: "published",
  Version: 3,
  TemplateJson: '{"basePdf":{},"schemas":[[]]}',
  MappingJson: '{"fields":{}}',
  MetadataJson: '{}'
});

test("CAP CDS exposes the canonical OData V4 field types and limits", () => {
  assert.doesNotMatch(schema, /\bcuid\b/);
  assert.match(schema, /key ID\s+: String\(128\)/);
  assert.match(schema, /name\s+: String\(160\) not null/);
  assert.match(schema, /description\s+: String\(1024\) not null/);
  assert.match(schema, /tags\s+: String\(4096\) not null/);
  assert.match(schema, /status\s+: String\(20\) not null/);
  assert.match(schema, /version\s+: Integer not null/);
  for (const field of ["templateJson", "mappingJson", "metadataJson", "dataSourcesJson"]) {
    assert.match(schema, new RegExp(`${field}\\s+: LargeString`));
  }

  assert.match(service, /@protocol: 'odata-v4'/);
  assert.match(service, /@path: 'pdf-templates'/);
  assert.match(service, /@cds\.server\.body_parser\.limit: '5mb'/);
  assert.match(service, /version as Version @odata\.etag/);
  assert.match(service, /@Core\.OptimisticConcurrency: \[Version\]/);
  assert.match(service, /grant: 'READ'.*TemplateViewer.*TemplateEditor/);
  assert.match(service, /grant: \['CREATE', 'UPDATE'\].*TemplateEditor/);
  assert.doesNotMatch(service, /requires: 'TemplateEditor'/);
});

test("CAP quickstart uses a compatible current CAP dependency family", () => {
  assert.equal(packageJson.engines.node, "^22.0.0 || ^24.0.0");
  assert.equal(packageJson.dependencies["@sap/cds"], "^10");
  assert.equal(packageJson.devDependencies["@cap-js/cds-test"], "^1.0.2");
  assert.equal(packageJson.devDependencies["@cap-js/sqlite"], "^3");
  assert.equal(packageJson.devDependencies["@sap/cds-dk"], "^10");
  assert.equal(packageJson.scripts.test, "cds test");
  assert.match(integrationTest, /TemplateViewer|username: "viewer"/);
  assert.match(integrationTest, /if-match/);
  assert.match(integrationTest, /2147483647/);
});

test("CAP update handler requires If-Match, accepts an omitted body Version, and guards Int32 overflow", () => {
  const implementation = fs.readFileSync(path.join(capRoot, "srv", "template-service.js"), "utf8");
  assert.match(implementation, /request\.headers\?\.\["if-match"\]/);
  assert.match(implementation, /request\.data\.Version != null && request\.data\.Version !== current\.version/);
  assert.doesNotMatch(implementation, /request\.data\.Version == null\) return request\.reject\(428/);
  assert.match(implementation, /current\.version >= LIMITS\.int32Max/);
  assert.match(implementation, /request\.data\.Version = current\.version \+ 1/);
});

test("CAP input contract normalizes valid tags and integer versions", () => {
  const record = validTemplate();
  normalizeTemplateInput(record);
  assert.deepEqual(JSON.parse(record.Tags), ["sales", "es"]);
  assert.equal(record.Version, 3);
  const trimmed = { ...validTemplate(), Name: "  Trimmed name  " };
  normalizeTemplateInput(trimmed);
  assert.equal(trimmed.Name, "Trimmed name");
  assert.deepEqual(LIMITS, {
    id: 128,
    name: 160,
    description: 1024,
    tagsJson: 4096,
    tagCount: 32,
    tagLength: 64,
    payloadCharacters: 5_000_000,
    int32Max: 2_147_483_647
  });
});

test("CAP input contract rejects invalid lengths, tags, versions, and JSON shapes", () => {
  const invalidCases = [
    [{ ...validTemplate(), ID: "x".repeat(129) }, /ID must not exceed 128/],
    [{ ...validTemplate(), ID: "bad/id" }, /ID must match/],
    [{ ...validTemplate(), Name: "x".repeat(161) }, /Name must not exceed 160/],
    [{ ...validTemplate(), Name: "   " }, /Name must not be empty/],
    [{ ...validTemplate(), Description: "x".repeat(1025) }, /Description must not exceed 1024/],
    [{ ...validTemplate(), Tags: JSON.stringify(Array.from({ length: 33 }, (_, index) => `tag-${index}`)) }, /at most 32/],
    [{ ...validTemplate(), Tags: '["sales","SALES"]' }, /unique values/],
    [{ ...validTemplate(), Tags: JSON.stringify(["x".repeat(65)]) }, /1 to 64/],
    [{ ...validTemplate(), Version: "not-a-number" }, /positive Int32/],
    [{ ...validTemplate(), Version: 2_147_483_648 }, /positive Int32/],
    [{ ...validTemplate(), TemplateJson: "{}" }, /pdfme template object/],
    [{ ...validTemplate(), MappingJson: "" }, /MappingJson must contain valid JSON/],
    [{ ...validTemplate(), MetadataJson: "[]" }, /MetadataJson must contain an object/],
    [{ ...validTemplate(), DataSourcesJson: "{}" }, /DataSourcesJson must contain an array/]
  ];

  for (const [record, pattern] of invalidCases) {
    assert.throws(() => normalizeTemplateInput(record), pattern);
  }
});

test("CAP input contract applies the five-million-character operational payload limit", () => {
  const record = validTemplate();
  record.MappingJson = JSON.stringify({ payload: "x".repeat(5_000_000) });
  assert.throws(() => normalizeTemplateInput(record), /5000000 characters/);
});
