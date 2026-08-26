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
  assert.equal(sectionIds(english).length, 14);

  for (const html of [spanish, english]) {
    assert.match(html, /hreflang="es" href="index\.html"/);
    assert.match(html, /hreflang="en" href="en\.html"/);
    assert.match(html, /data-language="es"/);
    assert.match(html, /data-language="en"/);
    assert.match(html, /assets\/language\.css/);
    assert.match(html, /assets\/docs\.js/);
  }
});

test("home page groups SAP backends under repositories and separates deferred generation", () => {
  const spanish = read("docs/index.html");
  const english = read("docs/en.html");

  for (const html of [spanish, english]) {
    assert.match(html, /<section id="choose-guide">/);
    assert.match(html, /class="guide-map guide-map--grouped"/);
    assert.equal((html.match(/<article class="guide-card/g) || []).length, 3);
    assert.match(html, /class="guide-subroute"/);
    assert.match(html, /href="repositories\/(?:en\.html)?"/);
    assert.match(html, /href="sap\/(?:en\.html)?"/);
    assert.match(html, /href="deferred\/"/);
    assert.match(html, /Template repository|Repositorio de plantillas/);
    assert.match(html, /Deferred job|Trabajo diferido/);
  }

  assert.match(spanish, /Qué guía necesitas/);
  assert.match(spanish, /Dentro de repositorios/);
  assert.match(spanish, /no forman un cuarto concepto/);
  assert.match(spanish, /No es necesaria/);
  assert.match(english, /Choose the right guide/);
  assert.match(english, /Within repositories/);
  assert.match(english, /not a fourth concept/);
  assert.match(english, /It is not required/);
});

test("Docker deployment lives only in the deferred-generation guide", () => {
  const spanish = read("docs/index.html");
  const english = read("docs/en.html");
  const deferred = read("docs/deferred/index.html");

  for (const html of [spanish, english]) {
    assert.doesNotMatch(html, /<section id="docker">/);
    assert.doesNotMatch(html, /href="#docker">Docker summary|href="#docker">Resumen de Docker/);
  }

  assert.match(deferred, /<section id="docker">/);
  assert.match(deferred, /Docker y Docker Compose/);
  assert.match(deferred, /docker compose up --build/);
  assert.match(deferred, /compose\.postgres\.yaml/);
  assert.match(deferred, /Antes de exponer el servicio/);
});

test("build section routes consumers to the appropriate usage guide", () => {
  const spanish = read("docs/index.html");
  const english = read("docs/en.html");

  assert.match(spanish, /esta sección explica cómo compilar, probar y publicar este repositorio/);
  assert.match(spanish, /href="#quickstart">Inicio rápido/);
  assert.match(spanish, /href="repositories\/">manual de catálogo y repositorios/);
  assert.match(spanish, /href="deferred\/">manual de generación diferida/);

  assert.match(english, /this section explains how to build, test, and publish this repository/);
  assert.match(english, /href="#quickstart">Quick start/);
  assert.match(english, /href="repositories\/en\.html">catalog and repositories guide/);
  assert.match(english, /href="deferred\/">deferred-generation guide/);
});

test("documentation language switch is localized and preserves the section", () => {
  const script = read("docs/assets/docs.js");

  assert.match(script, /Copy/);
  assert.match(script, /Copiar/);
  assert.match(script, /localStorage\.setItem\("ui5-pdfme-docs-language"/);
  assert.match(script, /target\.hash = window\.location\.hash/);
});

test("template documentation explains the contract, lifecycle, and practical workflows", () => {
  const spanish = read("docs/index.html");
  const english = read("docs/en.html");

  for (const html of [spanish, english]) {
    assert.match(html, /mapping\.fields/);
    assert.match(html, /fixedPosition/);
    assert.match(html, /repeatOnEveryPage/);
    assert.match(html, /saveTemplateRecord/);
    assert.match(html, /listTemplates/);
    assert.match(html, /loadTemplate/);
    assert.match(html, /dataContractVersion/);
  }

  assert.match(spanish, /Tres formas de empezar/);
  assert.match(spanish, /Plantilla en blanco/);
  assert.match(spanish, /Cargar PDF/);
  assert.match(english, /Three ways to start/);
  assert.match(english, /Blank template/);
  assert.match(english, /Load PDF/);
});

test("API documentation covers lifecycle, return values, adapters, and every studio event", () => {
  const spanish = read("docs/index.html");
  const english = read("docs/en.html");
  const sharedTerms = [
    "configure(partial)",
    "Promise&lt;Uint8Array&gt;",
    "getTemplateRecord",
    "event.detail",
    "getParameter",
    "pdfme:templateChange",
    "pdfme:templateSave",
    "pdfme:fieldInsert",
    "pdfme:templatesListed",
    "pdfme:templateLoaded",
    "pdfme:templateSaved",
    "pdfme:dataResolved",
    "pdfme:generated",
    "pdfme:help",
    "pdfme:error"
  ];

  for (const html of [spanish, english]) {
    for (const term of sharedTerms) assert.ok(html.includes(term), `Missing API documentation term: ${term}`);
  }

  assert.match(spanish, /Guardar no es persistir/);
  assert.match(english, /Save is not persistence/);
});
