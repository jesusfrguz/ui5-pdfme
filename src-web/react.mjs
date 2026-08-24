import React, { forwardRef, useEffect, useRef } from "react";
import { WebPdfTemplateStudio } from "./studio.mjs";
import { WebTemplateCatalog } from "./catalog.mjs";

export const PdfTemplateStudio = forwardRef(function PdfTemplateStudio(props, forwardedRef) {
  const hostRef = useRef(null);
  const studioRef = useRef(null);

  useEffect(() => {
    studioRef.current = new WebPdfTemplateStudio(hostRef.current, props);
    if (typeof forwardedRef === "function") forwardedRef(studioRef.current);
    else if (forwardedRef) forwardedRef.current = studioRef.current;
    return () => {
      studioRef.current?.destroy();
      studioRef.current = null;
      if (typeof forwardedRef === "function") forwardedRef(null);
      else if (forwardedRef) forwardedRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (studioRef.current) studioRef.current.configure(props);
  }, [props.template, props.dataSources, props.mapping, props.templateRepository, props.templateRepositories, props.templateName, props.title, props.filename, props.language, props.autoResolve, props.showHelp, props.helpUrl]);

  return React.createElement("div", { ref: hostRef, className: props.className, style: props.style });
});

export const PdfTemplateCatalog = forwardRef(function PdfTemplateCatalog(props, forwardedRef) {
  const hostRef = useRef(null);
  const catalogRef = useRef(null);
  useEffect(() => {
    catalogRef.current = new WebTemplateCatalog(hostRef.current, props);
    if (typeof forwardedRef === "function") forwardedRef(catalogRef.current);
    else if (forwardedRef) forwardedRef.current = catalogRef.current;
    return () => {
      catalogRef.current?.destroy();
      catalogRef.current = null;
      if (typeof forwardedRef === "function") forwardedRef(null);
      else if (forwardedRef) forwardedRef.current = null;
    };
  }, []);
  useEffect(() => { catalogRef.current?.configure(props); }, [props.store, props.repositories, props.language]);
  return React.createElement("div", { ref: hostRef, className: props.className, style: props.style });
});

export { WebPdfTemplateStudio, createBlankTemplate, createDefaultPlugins } from "./studio.mjs";
export { DataProviderRegistry, DataResolver, MappingEngine } from "./core.mjs";
export { TemplateRepositoryRegistry, TemplateStore } from "./template-repository.mjs";
export { WebTemplateCatalog } from "./catalog.mjs";
