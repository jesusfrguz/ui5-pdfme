# Validation checklist

## Installation

- [ ] The consumer installs from the public package/repository, without copied internals.
- [ ] Production bundling succeeds with no unresolved ESM/WASM assets.
- [ ] The editor has an explicit usable height and a responsive container.

## Data

- [ ] Every source has a unique `id` and known trust boundary.
- [ ] Dependencies are acyclic; optional sources have safe defaults.
- [ ] OData entity/collection shape is normalized as expected.
- [ ] Mappings resolve missing, null, date, currency, array and table cases.

## Template/PDF

- [ ] Schema names are unique and match mapping keys.
- [ ] Save/reload preserves the template.
- [ ] Preview, download and print produce a valid PDF.
- [ ] Long text, zero rows, many rows and page breaks were inspected.
- [ ] Locale, timezone, fonts and currency are correct.

## Platform

- [ ] JavaScript: custom event names start with `pdfme:`.
- [ ] React: ref is populated after mount and cleaned after unmount.
- [ ] UI5: a production `ui5 build` passes and the library is declared in `manifest.json`.

## Security/release

- [ ] No token, cookie, credential, personal payload or private URL is committed.
- [ ] Template publishing is authorized and versioned.
- [ ] `npm test`, `npm run build` and the relevant browser example pass.
- [ ] License and third-party notices ship with the artifact.
