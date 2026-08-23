/*
 * Compatibility patch for ui5-tooling-modules 3.38.x.
 *
 * pdfme 6 loads PDFium as a WASM asset. The current tooling plugin treats every
 * Rollup asset as JavaScript/source-map text. This idempotent postinstall patch
 * keeps binary assets intact and resolves their URLs through the UI5 loader.
 */
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.dirname(require.resolve("ui5-tooling-modules/package.json"));

function patch(relativePath, changes) {
  const filePath = path.join(packageRoot, relativePath);
  let source = fs.readFileSync(filePath, "utf8");

  for (const { original, replacement, label } of changes) {
    if (source.includes(replacement)) {
      continue;
    }
    if (!source.includes(original)) {
      throw new Error(`Cannot patch ${relativePath} (${label}): unsupported ui5-tooling-modules version`);
    }
    source = source.replace(original, replacement);
  }

  fs.writeFileSync(filePath, source, "utf8");
}

patch("lib/rollup-plugin-polyfill-node-override.js", [
  {
    label: "virtual polyfill relative resolution",
    original: `\t\tresolveId: function (importee, importer, options) {
\t\t\tif (isBuiltInModule(importee, moduleNames)) {`,
    replacement: `\t\tresolveId: function (importee, importer, options) {
\t\t\t// Delegate relative imports owned by the upstream virtual polyfill
\t\t\t// back to that plugin before generic filesystem resolution runs.
\t\t\tif (importer && importer.startsWith(PREFIX) && importee.startsWith(".")) {
\t\t\t\treturn resolveId.call(this, importee, importer, options);
\t\t\t}
\t\t\tif (isBuiltInModule(importee, moduleNames)) {`,
  },
]);

patch("lib/rollup-plugin-import-meta.js", [
  {
    label: "query-string guard",
    original: 'if (resolvedModuleId.indexOf("?")) {',
    replacement: 'if (resolvedModuleId.indexOf("?") >= 0) {',
  },
  {
    label: "binary asset emission",
    original: `\t\t\t\t\tthis.emitFile({
\t\t\t\t\t\ttype: "prebuilt-chunk",
\t\t\t\t\t\tfileName: path.basename(resolvedModuleId),
\t\t\t\t\t\tcode: readFileSync(resolvedModuleId, { encoding: "utf8" }),
\t\t\t\t\t});`,
    replacement: `\t\t\t\t\t// Binary assets such as WASM must not be parsed or minified as JS.
\t\t\t\t\tconst extension = path.extname(resolvedModuleId).toLowerCase();
\t\t\t\t\tif ([".js", ".mjs", ".cjs"].includes(extension)) {
\t\t\t\t\t\tthis.emitFile({
\t\t\t\t\t\t\ttype: "prebuilt-chunk",
\t\t\t\t\t\t\tfileName: path.basename(resolvedModuleId),
\t\t\t\t\t\t\tcode: readFileSync(resolvedModuleId, { encoding: "utf8" }),
\t\t\t\t\t\t});
\t\t\t\t\t} else {
\t\t\t\t\t\tthis.emitFile({
\t\t\t\t\t\t\ttype: "asset",
\t\t\t\t\t\t\tfileName: path.basename(resolvedModuleId),
\t\t\t\t\t\t\tsource: readFileSync(resolvedModuleId),
\t\t\t\t\t\t});
\t\t\t\t\t}`,
  },
  {
    label: "UI5 asset URL",
    original: '\t\t\t\t\treturn code.replace(urlMatch[1], `${JSON.stringify(path.basename(resolvedModule.id))}, import.meta.url`);',
    replacement: `\t\t\t\t\t// Resolve emitted assets through the UI5 loader. The build task rewrites
\t\t\t\t\t// this module ID into the consuming library namespace.
\t\t\t\t\treturn code.replace(
\t\t\t\t\t\turlMatch[0],
\t\t\t\t\t\t\`new URL(sap.ui.require.toUrl(\${JSON.stringify(path.basename(resolvedModuleId))}), document.baseURI)\`,
\t\t\t\t\t);`,
  },
]);

patch("lib/rollup-plugin-resolve-module.js", [
  {
    label: "virtual polyfill relative imports",
    original: `\t\tresolveId: function (importee, importer) {
\t\t\tlet module = importee;`,
    replacement: `\t\tresolveId: function (importee, importer) {
\t\t\t// Let the plugin that owns a Rollup virtual module resolve its
\t\t\t// relative imports. Treating a virtual ID as a filesystem path can
\t\t\t// incorrectly fall back to this project's package entry point.
\t\t\tif (importer && importer.startsWith("\\0")) {
\t\t\t\treturn null;
\t\t\t}
\t\t\tlet module = importee;`,
  },
]);

patch("lib/util.js", [
  {
    label: "binary Rollup assets",
    original: `\t\t\t\t\t\t\t} else if (module.type === "asset") {
\t\t\t\t\t\t\t\t// asset module (e.g. source maps)
\t\t\t\t\t\t\t\tconst sourcemapSource = JSON.parse(module.source);`,
    replacement: `\t\t\t\t\t\t\t} else if (module.type === "asset") {
\t\t\t\t\t\t\t\t// asset module (e.g. source maps or binary files such as WASM)
\t\t\t\t\t\t\t\tif (!module.fileName.endsWith(".map")) {
\t\t\t\t\t\t\t\t\tbundleInfo.addResource({
\t\t\t\t\t\t\t\t\t\tname: module.fileName,
\t\t\t\t\t\t\t\t\t\tcode: module.source,
\t\t\t\t\t\t\t\t\t\tbinary: true,
\t\t\t\t\t\t\t\t\t});
\t\t\t\t\t\t\t\t\tcontinue;
\t\t\t\t\t\t\t\t}
\t\t\t\t\t\t\t\tconst sourcemapSource = JSON.parse(module.source);`,
  },
  {
    label: "binary rewrite skip",
    original: `\t\t\t\t\t\tfor (const module of bundleInfo.getEntries()) {
\t\t\t\t\t\t\t// for CDN cases`,
    replacement: `\t\t\t\t\t\tfor (const module of bundleInfo.getEntries()) {
\t\t\t\t\t\t\tif (module.binary) {
\t\t\t\t\t\t\t\tcontinue;
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\t// for CDN cases`,
  },
  {
    label: "shifted chunk imports",
    original: `\t\t\t\t\t\t\t\tfor (const importFile of module.imports) {
\t\t\t\t\t\t\t\t\tconst importName = importFile.slice(0, path.extname(importFile).length * -1);
\t\t\t\t\t\t\t\t\tmodifiedCode = replaceImports(modifiedCode, \`./\${importName}\`, \`\${moduleBasePath}\${importName}\`);
\t\t\t\t\t\t\t\t}`,
    replacement: `\t\t\t\t\t\t\t\tfor (const importFile of module.imports) {
\t\t\t\t\t\t\t\t\tconst importName = importFile.slice(0, path.extname(importFile).length * -1);
\t\t\t\t\t\t\t\t\tconst importBasePath = shiftedEntries[importFile]
\t\t\t\t\t\t\t\t\t\t? (module.name.startsWith(\`\${dynamicEntriesPath}/\`) ? "./" : \`\${moduleBasePath}\${dynamicEntriesPath}/\`)
\t\t\t\t\t\t\t\t\t\t: moduleBasePath;
\t\t\t\t\t\t\t\t\tmodifiedCode = replaceImports(modifiedCode, \`./\${importName}\`, \`\${importBasePath}\${importName}\`);
\t\t\t\t\t\t\t\t}`,
  },
]);

patch("lib/task.js", [
  {
    label: "UI5 binary resource",
    original: `\t\t\tif (entry.type === "resource") {
\t\t\t\tnewResource = resourceFactory.createResource({
\t\t\t\t\tpath: \`/resources/\${rewriteDep(entry.name, bundleInfo)}\`,
\t\t\t\t\tstring: entry.code,
\t\t\t\t});`,
    replacement: `\t\t\tif (entry.type === "resource") {
\t\t\t\tconst resourceParameters = {
\t\t\t\t\tpath: \`/resources/\${rewriteDep(entry.name, bundleInfo)}\`,
\t\t\t\t};
\t\t\t\tif (entry.binary) {
\t\t\t\t\tresourceParameters.buffer = Buffer.isBuffer(entry.code) ? entry.code : Buffer.from(entry.code);
\t\t\t\t} else {
\t\t\t\t\tresourceParameters.string = entry.code;
\t\t\t\t}
\t\t\t\tnewResource = resourceFactory.createResource(resourceParameters);`,
  },
]);

console.log("ui5-pdfme: ui5-tooling-modules WASM compatibility patch is ready");
