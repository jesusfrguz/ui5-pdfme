import React, { forwardRef, useEffect, useRef } from "react";
import { WebPdfTemplateStudio } from "./studio.mjs";

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
  }, [props.template, props.dataSources, props.mapping, props.filename, props.language, props.autoResolve]);

  return React.createElement("div", { ref: hostRef, className: props.className, style: props.style });
});

export { WebPdfTemplateStudio, createBlankTemplate, createDefaultPlugins } from "./studio.mjs";
export { DataProviderRegistry, DataResolver, MappingEngine } from "./core.mjs";
