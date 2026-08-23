const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sectionIds(html) {
  return [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
}

test("GitHub Pages documentation has matching Spanish and English versions", () => {
  const spanish = read("docs/index.html");
  const english = read("docs/en.html");

  assert.match(spanish, /<html lang="es">/);
  assert.match(english, /<html lang="en">/);
  assert.deepEqual(sectionIds(english), sectionIds(spanish));
  assert.equal(sectionIds(english).length, 13);

  for (const html of [spanish, english]) {
    assert.match(html, /hreflang="es" href="index\.html"/);
    assert.match(html, /hreflang="en" href="en\.html"/);
    assert.match(html, /data-language="es"/);
    assert.match(html, /data-language="en"/);
    assert.match(html, /assets\/language\.css/);
    assert.match(html, /assets\/docs\.js/);
  }
});

test("documentation language switch is localized and preserves the section", () => {
  const script = read("docs/assets/docs.js");

  assert.match(script, /Copy/);
  assert.match(script, /Copiar/);
  assert.match(script, /localStorage\.setItem\("ui5-pdfme-docs-language"/);
  assert.match(script, /target\.hash = window\.location\.hash/);
});
