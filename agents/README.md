# AI integration playbook

This folder gives coding agents deterministic recipes for applying `ui5-pdfme` in another project.

| Goal | Guide |
| --- | --- |
| SAPUI5, OpenUI5 or Fiori | [INSTALL_UI5.md](INSTALL_UI5.md) |
| Plain JavaScript, Vite or another web bundler | [INSTALL_JAVASCRIPT.md](INSTALL_JAVASCRIPT.md) |
| React | [INSTALL_REACT.md](INSTALL_REACT.md) |
| Build or modify a print template | [CREATE_TEMPLATE.md](CREATE_TEMPLATE.md) |
| Connect JSON, REST, OData or calculated data | [DATA_INTEGRATION.md](DATA_INTEGRATION.md) |
| List, load and persist templates | [TEMPLATE_REPOSITORIES.md](TEMPLATE_REPOSITORIES.md) |
| Verify an implementation | [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md) |

An agent should first identify the host stack and the document being produced. It should then install one adapter, model data sources separately from field mappings, load or create a versioned template, and validate the final PDF with representative data.

Do not copy implementation files into a consumer application. Install the package and import its public entry point. Do not put access tokens inside `dataSources`; authentication belongs to the application transport layer.
