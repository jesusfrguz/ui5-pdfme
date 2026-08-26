const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const contractsDirectory = path.join(root, "examples", "backend", "contracts");
const schemaPath = path.join(contractsDirectory, "template-record.schema.json");
const openApiPath = path.join(contractsDirectory, "template-repository.openapi.json");
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const schema = readJson(schemaPath);
const openApi = readJson(openApiPath);

function resolveFragment(document, fragment) {
  assert.ok(fragment.startsWith("#/"), `Unsupported JSON pointer: ${fragment}`);
  return fragment.slice(2).split("/").reduce((value, token) => {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    assert.ok(value && Object.prototype.hasOwnProperty.call(value, key), `Missing JSON pointer segment: ${key}`);
    return value[key];
  }, document);
}

test("template record contract defines canonical types and operational limits", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema["x-operational-max-payload-characters"], 5_000_000);
  assert.equal(schema.$ref, "#/$defs/templateRecord");

  const properties = schema.$defs.recordProperties.properties;
  assert.equal(schema.$defs.identifier.type, "string");
  assert.equal(schema.$defs.identifier.maxLength, 128);
  assert.equal(schema.$defs.identifier.pattern, "^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$");
  assert.equal(properties.name.maxLength, 160);
  assert.equal(properties.description.maxLength, 1024);
  assert.equal(properties.tags.maxItems, 32);
  assert.equal(properties.tags.uniqueItems, true);
  assert.equal(properties.tags.items.maxLength, 64);
  assert.equal(properties.tags["x-odata-max-length"], 4096);
  assert.equal(properties.status.maxLength, 20);
  assert.deepEqual(properties.status.enum, ["draft", "published", "archived"]);

  const version = schema.$defs.version;
  assert.equal(version.type, "string");
  assert.equal(version.pattern, "^[1-9][0-9]*$");
  assert.equal(version.maxLength, 10);
  assert.equal(version["x-numeric-maximum"], 2_147_483_647);
  assert.equal(version["x-odata-type"], "Edm.Int32");
  assert.equal(version["x-database-type"], "INTEGER");

  for (const name of ["template", "mapping", "metadata", "dataSources"]) {
    const payload = schema.$defs[name];
    assert.equal(payload["x-odata-type"], "Edm.String", `${name} must use an OData string payload`);
    assert.equal(payload["x-odata-json-encoded"], true, `${name} must be JSON encoded for OData`);
    assert.equal(payload["x-intrinsic-max-length"], null, `${name} must not declare an intrinsic character limit`);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "maxLength"), false, `${name} must not use maxLength`);
  }
});

test("OpenAPI contract references the canonical schema and exposes repository operations", () => {
  assert.equal(openApi.openapi, "3.1.0");
  assert.equal(openApi["x-operational-max-payload-characters"], 5_000_000);
  assert.equal(openApi["x-odata-profile"].versionProperty, "Version");
  assert.equal(openApi["x-odata-profile"].versionType, "Edm.Int32");
  assert.match(openApi["x-odata-profile"].properties.ID, /Edm\.String\(128\)/);
  assert.match(openApi["x-odata-profile"].properties.TemplateJson, /Edm\.String\(max\)/);

  assert.ok(openApi.paths["/api/templates"].get);
  assert.ok(openApi.paths["/api/templates"].post);
  assert.ok(openApi.paths["/api/templates/{id}"].get);
  assert.ok(openApi.paths["/api/templates/{id}"].put);

  const externalReferences = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string" && value.$ref.startsWith("./template-record.schema.json#")) externalReferences.push(value.$ref);
    Object.values(value).forEach(visit);
  };
  visit(openApi);
  assert.ok(externalReferences.length >= 4);

  for (const reference of externalReferences) {
    const [relativePath, fragment] = reference.split("#");
    assert.equal(path.resolve(contractsDirectory, relativePath), schemaPath);
    resolveFragment(schema, `#${fragment}`);
  }
});

test("REST version remains a decimal string while the OData boundary is Int32", () => {
  const version = schema.$defs.version;
  assert.equal(version.type, "string");
  assert.match("1", new RegExp(version.pattern));
  assert.match("2147483647", new RegExp(version.pattern));
  assert.doesNotMatch("0", new RegExp(version.pattern));
  assert.doesNotMatch("1.5", new RegExp(version.pattern));
  assert.equal(version["x-odata-type"], "Edm.Int32");
  assert.match(openApi.info.description, /REST exposes version as a normalized positive decimal string/);
  assert.match(openApi.info.description, /OData and database field is Int32/);
});
