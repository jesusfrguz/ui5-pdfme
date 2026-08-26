const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const pages = {
  home: "docs/index.html",
  guide: "docs/guide/index.html",
  repositories: "docs/repositories/index.html",
  sap: "docs/sap/index.html"
};

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function catalog(page, language = "en") {
  return JSON.parse(read(`docs/i18n/${language}/${page}.json`));
}

function localized(page, language = "es") {
  const html = read(pages[page]);
  if (language === "es") return html;
  return `${html}\n${Object.values(catalog(page, language).translations).join("\n")}`;
}

function sectionIds(html) {
  return [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
}

function referencedTranslationKeys(html) {
  const keys = [...html.matchAll(/\sdata-i18n="([^"]+)"/g)].map((match) => match[1]);
  for (const match of html.matchAll(/\sdata-i18n-attrs="([^"]+)"/g)) {
    for (const binding of match[1].split(",")) keys.push(binding.slice(binding.indexOf(":") + 1));
  }
  return [...new Set(keys)].sort();
}

test("GitHub Pages documentation uses one HTML structure and complete JSON language catalogs", () => {
  for (const [page, relativePath] of Object.entries(pages)) {
    const html = read(relativePath);
    const english = catalog(page);

    assert.match(html, new RegExp(`<html lang="es" data-i18n-page="${page}">`));
    assert.equal(english.locale, "en");
    assert.equal(english.page, page);
    assert.deepEqual(Object.keys(english.translations).sort(), referencedTranslationKeys(html));
    assert.match(html, /data-language="es"/);
    assert.match(html, /data-language="en"/);
    assert.match(html, /language\.css/);
    assert.match(html, /docs\.js/);
  }

  assert.equal(sectionIds(read(pages.home)).length, 14);
  assert.match(read(pages.home), /hreflang="es" href="\?lang=es"/);
  assert.match(read(pages.home), /hreflang="en" href="\?lang=en"/);

  const manifest = JSON.parse(read("docs/i18n/manifest.json"));
  assert.equal(manifest.defaultLanguage, "es");
  assert.deepEqual(manifest.languages.map(({ code }) => code), ["es", "en"]);
});

test("legacy English URLs are small compatibility redirects to the language parameter", () => {
  for (const relativePath of ["docs/en.html", "docs/guide/en.html", "docs/repositories/en.html", "docs/sap/en.html"]) {
    const redirect = read(relativePath);
    assert.ok(Buffer.byteLength(redirect) < 700, `${relativePath} must remain a redirect, not a duplicated page`);
    assert.match(redirect, /searchParams\.set\("lang", "en"\)/);
    assert.match(redirect, /target\.hash = window\.location\.hash/);
  }
});

test("home page groups SAP backends under repositories and separates deferred generation", () => {
  const spanish = localized("home");
  const english = localized("home", "en");

  assert.match(spanish, /<section id="choose-guide">/);
  assert.match(spanish, /class="guide-map guide-map--grouped"/);
  assert.equal((spanish.match(/<article class="guide-card/g) || []).length, 3);
  assert.match(spanish, /class="guide-subroute"/);
  assert.match(spanish, /href="repositories\//);
  assert.match(spanish, /href="sap\//);
  assert.match(spanish, /href="deferred\//);
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
  const home = read(pages.home);
  const deferred = read("docs/deferred/index.html");

  assert.doesNotMatch(home, /<section id="docker">/);
  assert.doesNotMatch(home, /href="#docker">Resumen de Docker/);
  assert.match(deferred, /<section id="docker">/);
  assert.match(deferred, /Docker y Docker Compose/);
  assert.match(deferred, /docker compose up --build/);
  assert.match(deferred, /compose\.postgres\.yaml/);
  assert.match(deferred, /Antes de exponer el servicio/);
});

test("build section routes consumers to the appropriate usage guide", () => {
  const spanish = localized("home");
  const english = localized("home", "en");

  assert.match(spanish, /esta sección explica cómo compilar, probar y publicar este repositorio/);
  assert.match(spanish, /href="#quickstart">Inicio rápido/);
  assert.match(spanish, /href="repositories\/">manual de catálogo y repositorios/);
  assert.match(spanish, /href="deferred\/">manual de generación diferida/);
  assert.match(english, /this section explains how to build, test, and publish this repository/);
  assert.match(english, /href="#quickstart">Quick start/);
  assert.match(english, /catalog and repositories guide/);
  assert.match(english, /deferred-generation guide/);
});

test("documentation language switch loads JSON, preserves sections, and localizes links", () => {
  const script = read("docs/assets/docs.js");
  const spanishCommon = read("docs/i18n/es/common.json");
  const englishCommon = read("docs/i18n/en/common.json");

  assert.match(script, /new URLSearchParams\(window\.location\.search\)\.get\("lang"\)/);
  assert.match(script, /loadJson\(`\$\{language\}\/\$\{page\}\.json`\)/);
  assert.match(script, /localStorage\.setItem\("ui5-pdfme-docs-language"/);
  assert.match(script, /currentTarget\.hash = window\.location\.hash/);
  assert.match(script, /window\.location\.assign\(currentTarget\)/);
  assert.match(script, /target\.searchParams\.set\("lang", language\)/);
  assert.match(spanishCommon, /Copiar/);
  assert.match(englishCommon, /Copy/);
});

test("template documentation explains the contract, lifecycle, and practical workflows", () => {
  const spanish = localized("home");
  const english = localized("home", "en");

  for (const content of [spanish, english]) {
    assert.match(content, /mapping\.fields/);
    assert.match(content, /fixedPosition/);
    assert.match(content, /repeatOnEveryPage/);
    assert.match(content, /saveTemplateRecord/);
    assert.match(content, /listTemplates/);
    assert.match(content, /loadTemplate/);
    assert.match(content, /dataContractVersion/);
  }

  assert.match(spanish, /Tres formas de empezar/);
  assert.match(spanish, /Plantilla en blanco/);
  assert.match(spanish, /Cargar PDF/);
  assert.match(english, /Three ways to start/);
  assert.match(english, /Blank template/);
  assert.match(english, /Load PDF/);
});

test("API documentation covers lifecycle, return values, adapters, and every studio event", () => {
  const spanish = localized("home");
  const english = localized("home", "en");
  const sharedTerms = [
    "configure(partial)", "Promise&lt;Uint8Array&gt;", "getTemplateRecord", "event.detail", "getParameter",
    "pdfme:templateChange", "pdfme:templateSave", "pdfme:fieldInsert", "pdfme:templatesListed",
    "pdfme:templateLoaded", "pdfme:templateSaved", "pdfme:dataResolved", "pdfme:generated", "pdfme:help", "pdfme:error"
  ];

  for (const content of [spanish, english]) {
    for (const term of sharedTerms) assert.ok(content.includes(term), `Missing API documentation term: ${term}`);
  }

  assert.match(spanish, /Guardar no es persistir/);
  assert.match(english, /Save is not persistence/);
});
