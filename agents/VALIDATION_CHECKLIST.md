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
- [ ] Static field identifiers accept unique free text; connected identifiers use a searchable data selector and reject values outside its options.
- [ ] **Value from data** is unchecked for palette-created static fields and checked for connected fields.
- [ ] A connected Text with **Show label** renders `Label: resolved value` in the layout and final PDF; a static Text shows the flag checked and disabled.
- [ ] **Fixed non-moving position** keeps static content and data-bound Text outside the dynamic flow; **Repeat on every page** is shown only when fixed is enabled.
- [ ] Fixed fields remain selectable after save/reload; fixed-only content renders on its original page, repeated fixed content and resolved Text values render on every page, and repeated header/footer bounds automatically extend page padding to prevent overlap after page breaks.
- [ ] Multi-variable text resolves both complete paths and configured aliases.
- [ ] Save/reload preserves the template.
- [ ] Preview, download and print produce a valid PDF.
- [ ] Catalog search/status/repository filters return the expected templates.
- [ ] Catalog creation starts a blank A4 template and imports every page of a valid PDF background; invalid files are rejected.
- [ ] List, get and save work for every configured template repository.
- [ ] Server-driven REST/OData pagination is exhausted or intentionally bounded.
- [ ] Long text, zero rows, many rows and page breaks were inspected.
- [ ] Locale, timezone, fonts and currency are correct.

## Platform

- [ ] JavaScript: custom event names start with `pdfme:`.
- [ ] React: ref is populated after mount and cleaned after unmount.
- [ ] UI5: a production `ui5 build` passes and the library is declared in `manifest.json`.

## Security/release

- [ ] No token, cookie, credential, personal payload or private URL is committed.
- [ ] Template publishing is authorized and versioned.
- [ ] Stored template sources contain no credentials; applying stored sources is explicitly opted in.
- [ ] `npm test`, `npm run build` and the relevant browser example pass.
- [ ] License and third-party notices ship with the artifact.
