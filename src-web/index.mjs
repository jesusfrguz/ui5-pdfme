import { prepareInputsForGeneration, prepareTemplateForGeneration } from "./core.mjs";

export { DataProviderRegistry, DataResolver, MappingEngine, createDefaultRegistry, flattenData, getPath, prepareInputsForGeneration, prepareTemplateForGeneration, tokenizePath } from "./core.mjs";
export { WebPdfTemplateStudio, createBlankTemplate, createDefaultPlugins } from "./studio.mjs";
export { TemplateRepositoryRegistry, TemplateStore, createTemplateId, filterTemplateRecords, normalizeTemplateRecord } from "./template-repository.mjs";
export { WebTemplateCatalog } from "./catalog.mjs";

export async function generatePdf({ template, inputs, plugins, options }) {
  const [{ generate }, { createDefaultPlugins, withLockedFieldNames }] = await Promise.all([
    import("@pdfme/generator"),
    import("./studio.mjs")
  ]);
  const preparedTemplate = prepareTemplateForGeneration(template);
  return generate({ template: preparedTemplate, inputs: prepareInputsForGeneration(preparedTemplate, inputs), plugins: plugins ? withLockedFieldNames(plugins) : createDefaultPlugins(), options });
}

export function createPdfTemplateStudio(target, configuration) {
  return import("./studio.mjs").then(({ WebPdfTemplateStudio }) => new WebPdfTemplateStudio(target, configuration));
}
