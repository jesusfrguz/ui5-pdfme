export { DataProviderRegistry, DataResolver, MappingEngine, createDefaultRegistry, flattenData, getPath, tokenizePath } from "./core.mjs";
export { WebPdfTemplateStudio, createBlankTemplate, createDefaultPlugins } from "./studio.mjs";

export async function generatePdf({ template, inputs, plugins, options }) {
  const [{ generate }, { createDefaultPlugins }] = await Promise.all([
    import("@pdfme/generator"),
    import("./studio.mjs")
  ]);
  return generate({ template, inputs, plugins: plugins || createDefaultPlugins(), options });
}

export function createPdfTemplateStudio(target, configuration) {
  return import("./studio.mjs").then(({ WebPdfTemplateStudio }) => new WebPdfTemplateStudio(target, configuration));
}
