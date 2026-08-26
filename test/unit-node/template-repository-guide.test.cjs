const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const sectionIds = (html) => [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);

test("published repository guide is bilingual and covers every provider", () => {
  const spanish = read("docs/repositories/index.html");
  const english = read("docs/repositories/en.html");
  const sections = ["field-contract", "memory", "local-storage", "rest", "odata", "function", "api", "security", "validate"];

  assert.match(spanish, /<html lang="es">/);
  assert.match(english, /<html lang="en">/);
  assert.deepEqual(sectionIds(english), sectionIds(spanish));
  assert.match(spanish, /hreflang="en" href="en\.html"/);
  assert.match(english, /hreflang="es" href="index\.html"/);

  for (const html of [spanish, english]) {
    for (const id of sections) assert.ok(html.includes(`<section id="${id}">`), `missing repository guide section: ${id}`);
    for (const type of ["memory", "localStorage", "rest", "odata", "function"]) {
      assert.ok(html.includes(`<code>${type}</code>`), `missing repository type: ${type}`);
    }
    assert.match(html, /persistDataSources/);
    assert.match(html, /applyStoredDataSources/);
    assert.match(html, /registerTemplateRepositoryProvider/);
    assert.match(html, /Edm\.String\(128\)/);
    assert.match(html, /Edm\.String\(4096\)/);
    assert.match(html, /Edm\.Int32/);
    assert.match(html, /odataVersion: 2/);
    assert.match(html, /requireEtag: true/);
    assert.match(html, /X-CSRF-Token/);
  }
});

test("repository guide links to the bilingual SAP backend chooser", () => {
  assert.match(read("docs/repositories/index.html"), /href="\.\.\/sap\/index\.html"/);
  assert.match(read("docs/repositories/en.html"), /href="\.\.\/sap\/en\.html"/);
  assert.match(read("docs/index.html"), /href="sap\/"/);
  assert.match(read("docs/en.html"), /href="sap\/en\.html"/);
});

test("REST repository documentation links to the Node and Docker examples", () => {
  const spanish = read("docs/repositories/index.html");
  const english = read("docs/repositories/en.html");

  for (const html of [spanish, english]) {
    const restSection = html.match(/<section id="rest">([\s\S]*?)<\/section>/)?.[1] || "";
    assert.match(restSection, /class="callout"/);
    assert.match(restSection, /examples\/deferred\/node/);
    assert.match(restSection, /examples\/deferred\/docker/);
    assert.match(restSection, /PostgreSQL/);
  }

  assert.match(spanish, /Documentación y ejemplos:/);
  assert.match(english, /Documentation and examples:/);
});

test("published documentation links to the repository guide inside docs", () => {
  const links = [
    ["docs/index.html", "href=\"repositories/\""],
    ["docs/en.html", "href=\"repositories/en.html\""],
    ["docs/guide/index.html", "href=\"../repositories/\""],
    ["docs/guide/en.html", "href=\"../repositories/en.html\""]
  ];

  for (const [file, href] of links) assert.ok(read(file).includes(href), `${file} does not link the published repository guide`);
  assert.doesNotMatch(read("docs/index.html"), /\.\.\/agents\/TEMPLATE_REPOSITORIES\.md/);
  assert.doesNotMatch(read("docs/en.html"), /\.\.\/agents\/TEMPLATE_REPOSITORIES\.md/);
});
