import { createHash } from "node:crypto";
import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, parse } from "node:path";

const FINGERPRINTED_EXTENSIONS = new Set([".css", ".js"]);
const CONTENT_HASH_PATTERN = /\.[a-f0-9]{12}\.(?:css|js)$/;

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findHtmlFiles(entryPath));
    else if (entry.isFile() && extname(entry.name) === ".html") files.push(entryPath);
  }

  return files;
}

export async function fingerprintPagesAssets(pagesDirectory) {
  const assetsDirectory = join(pagesDirectory, "assets");
  const entries = await readdir(assetsDirectory, { withFileTypes: true });
  const replacements = new Map();

  for (const entry of entries) {
    const extension = extname(entry.name);
    if (!entry.isFile() || !FINGERPRINTED_EXTENSIONS.has(extension) || CONTENT_HASH_PATTERN.test(entry.name)) continue;

    const sourcePath = join(assetsDirectory, entry.name);
    const contents = await readFile(sourcePath);
    const hash = createHash("sha256").update(contents).digest("hex").slice(0, 12);
    const { name } = parse(entry.name);
    const fingerprintedName = `${name}.${hash}${extension}`;

    await copyFile(sourcePath, join(assetsDirectory, fingerprintedName));
    replacements.set(`assets/${entry.name}`, `assets/${fingerprintedName}`);
  }

  for (const htmlPath of await findHtmlFiles(pagesDirectory)) {
    const original = await readFile(htmlPath, "utf8");
    let updated = original;

    for (const [source, fingerprinted] of replacements) {
      updated = updated.replaceAll(source, fingerprinted);
    }

    if (updated !== original) await writeFile(htmlPath, updated);
  }

  return replacements;
}
