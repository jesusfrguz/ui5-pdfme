import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { fingerprintPagesAssets } from "./fingerprint-pages-assets.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pagesDirectory = resolve(repositoryRoot, ".pages");
const examplesDirectory = resolve(pagesDirectory, "examples");

await rm(pagesDirectory, { recursive: true, force: true });
await mkdir(examplesDirectory, { recursive: true });

await cp(resolve(repositoryRoot, "docs"), pagesDirectory, { recursive: true });
await cp(resolve(repositoryRoot, "examples", "index.html"), resolve(examplesDirectory, "index.html"));

for (const name of ["javascript", "react"]) {
  await build({
    root: resolve(repositoryRoot, "examples", name),
    base: "./",
    build: {
      outDir: resolve(examplesDirectory, name),
      emptyOutDir: true
    }
  });
}

await cp(
  resolve(repositoryRoot, "dist-v6", "resources"),
  resolve(pagesDirectory, "resources"),
  { recursive: true }
);
await cp(
  resolve(repositoryRoot, "test", "ui5", "pdfme", "demokit"),
  resolve(examplesDirectory, "ui5"),
  { recursive: true }
);
await cp(
  resolve(repositoryRoot, "examples", "ui5", "index.html"),
  resolve(examplesDirectory, "ui5", "index.html")
);

const fingerprintedAssets = await fingerprintPagesAssets(pagesDirectory);

console.log(`GitHub Pages artifact created at ${pagesDirectory} with ${fingerprintedAssets.size} fingerprinted assets`);
