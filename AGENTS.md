# AGENTS.md

## Mission

Maintain `ui5-pdfme` as one visual print-template engine with stable adapters for SAPUI5/OpenUI5/Fiori, framework-neutral JavaScript and React. Preserve the declarative template, data-source and mapping contracts across all adapters.

## Start here

1. Read [agents/README.md](agents/README.md).
2. Choose exactly one installation guide for the target stack.
3. Use [agents/CREATE_TEMPLATE.md](agents/CREATE_TEMPLATE.md) for template work, [agents/DATA_INTEGRATION.md](agents/DATA_INTEGRATION.md) for data/OData work, [agents/TEMPLATE_REPOSITORIES.md](agents/TEMPLATE_REPOSITORIES.md) for catalog/persistence work, and [agents/DEFERRED_GENERATION.md](agents/DEFERRED_GENERATION.md) for backend jobs/workers.
4. Run the checks in [agents/VALIDATION_CHECKLIST.md](agents/VALIDATION_CHECKLIST.md) before declaring success.

## Repository contracts

- `src-web/core.mjs` is the framework-neutral data and mapping layer.
- `src-web/studio.mjs` is the browser adapter and public JavaScript API.
- `src-web/react.mjs` is a thin lifecycle/ref adapter; do not duplicate business logic there.
- `src/ui5/pdfme/` is the native UI5 library. Keep UI5 code compatible with the minimum version documented in `README.md`.
- `examples/shared/invoice.mjs` is the canonical cross-framework sample.
- `dist-v6/` is generated. Never edit it by hand.
- A schema `name` is the stable key linking a pdfme field to `mapping.fields`.
- Never evaluate mapping expressions with `eval` or `Function`. Use paths, templates and registered formatters/loaders.
- Treat REST/OData values as untrusted. Render labels/previews with text APIs, never raw `innerHTML`.

## Commands

```bash
npm ci
npm test
npm run build
npm run example:js
npm run example:react
npm run docs:dev
```

`npm run build` applies the pinned UI5 tooling compatibility patch before generating `dist-v6`. If dependencies change, verify that the patch remains idempotent and fail loudly rather than silently producing an incomplete bundle.

## Change rules

- A core contract change needs Node tests and must be reflected in all relevant guides.
- An adapter change needs a runnable example in that stack.
- A visual change needs browser validation at desktop and narrow viewport widths.
- A template example must generate a valid PDF, not merely render in the designer.
- Keep secrets, bearer tokens, cookies and private endpoint payloads out of templates, examples, screenshots and commits.
- Preserve `LICENSE`, `NOTICE` and `THIRD_PARTY_NOTICES.md` in distributed artifacts.

## Public APIs to preserve

JavaScript: `WebPdfTemplateStudio`, `createPdfTemplateStudio`, `generatePdf`, `DataResolver`, `MappingEngine`.

React: `PdfTemplateStudio` plus an imperative ref exposing the underlying `WebPdfTemplateStudio`.

UI5: `ui5.pdfme.PdfTemplateStudio`, `configure`, setters, `refreshData`, `generate`, `preview`, `download`, `print`, registration methods and documented events.

## Done means

All relevant tests/builds pass, the example can resolve data and open a generated PDF, documentation matches the API, generated directories are not manually altered, and no user data or credentials were added.
