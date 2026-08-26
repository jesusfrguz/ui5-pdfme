# ui5-pdfme documentation

The complete technical and functional documentation is available as a localized static site in [Spanish](index.html?lang=es) and [English](index.html?lang=en). Each guide keeps one HTML structure and loads its translated content from `i18n/<language>/*.json`. The language switch preserves the current section and remembers the visitor's choice. GitHub Pages publishes this directory automatically.

The end-user manual is also available in [Spanish](guide/index.html?lang=es) and [English](guide/index.html?lang=en). It explains the visual workflow without requiring integration knowledge.

Main references:

- [Repository README](../README.md)
- [AI integration playbook](../agents/README.md)
- [JavaScript installation](../agents/INSTALL_JAVASCRIPT.md)
- [React installation](../agents/INSTALL_REACT.md)
- [SAPUI5/OpenUI5/Fiori installation](../agents/INSTALL_UI5.md)
- [Template creation](../agents/CREATE_TEMPLATE.md)
- [Data and OData](../agents/DATA_INTEGRATION.md)
- Template catalog and repositories web guide: [Spanish](repositories/index.html?lang=es) · [English](repositories/index.html?lang=en)
- SAP/OData backend chooser: [Spanish](sap/index.html?lang=es) · [English](sap/index.html?lang=en)
- Docker and deferred PDF generation: [web manual](deferred/index.html) · [agent recipe](../agents/DEFERRED_GENERATION.md)
- [Template repository recipe for agents](../agents/TEMPLATE_REPOSITORIES.md)
- [Validation checklist](../agents/VALIDATION_CHECKLIST.md)

Run locally with `npm run docs:dev`.

Author: [Jesús Franco Guzmán](https://www.linkedin.com/in/jesus-franco-guzman/).
