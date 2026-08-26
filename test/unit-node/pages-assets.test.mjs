import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { fingerprintPagesAssets } from "../../scripts/fingerprint-pages-assets.mjs";

test("GitHub Pages fingerprints documentation CSS and JavaScript references", async (t) => {
  const pagesDirectory = await mkdtemp(join(tmpdir(), "ui5-pdfme-pages-"));
  t.after(() => rm(pagesDirectory, { recursive: true, force: true }));
  const assetsDirectory = join(pagesDirectory, "assets");
  const guideDirectory = join(pagesDirectory, "guide");

  await mkdir(assetsDirectory);
  await mkdir(guideDirectory);
  await writeFile(join(assetsDirectory, "styles.css"), ".guide-card { display: grid; }");
  await writeFile(join(assetsDirectory, "docs.js"), "document.documentElement.dataset.ready = 'true';");
  await writeFile(join(assetsDirectory, "logo.svg"), "<svg></svg>");
  await writeFile(join(pagesDirectory, "index.html"), '<link href="assets/styles.css"><script src="assets/docs.js"></script>');
  await writeFile(join(guideDirectory, "index.html"), '<link href="../assets/styles.css"><script src="../assets/docs.js"></script>');

  const replacements = await fingerprintPagesAssets(pagesDirectory);
  const fingerprintedStyles = replacements.get("assets/styles.css");
  const fingerprintedScript = replacements.get("assets/docs.js");

  assert.match(fingerprintedStyles, /^assets\/styles\.[a-f0-9]{12}\.css$/);
  assert.match(fingerprintedScript, /^assets\/docs\.[a-f0-9]{12}\.js$/);
  assert.equal(replacements.has("assets/logo.svg"), false);
  assert.equal(await readFile(join(pagesDirectory, fingerprintedStyles), "utf8"), ".guide-card { display: grid; }");
  assert.equal(await readFile(join(pagesDirectory, fingerprintedScript), "utf8"), "document.documentElement.dataset.ready = 'true';");

  const rootHtml = await readFile(join(pagesDirectory, "index.html"), "utf8");
  const nestedHtml = await readFile(join(guideDirectory, "index.html"), "utf8");
  assert.ok(rootHtml.includes(fingerprintedStyles));
  assert.ok(rootHtml.includes(fingerprintedScript));
  assert.ok(nestedHtml.includes(`../${fingerprintedStyles}`));
  assert.ok(nestedHtml.includes(`../${fingerprintedScript}`));
  assert.doesNotMatch(rootHtml, /assets\/styles\.css|assets\/docs\.js/);
});
