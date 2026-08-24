import { Designer } from "@pdfme/ui";
import { generate } from "@pdfme/generator";
import * as schemas from "@pdfme/schemas";
import { checkTemplate, getB64BasePdf } from "@pdfme/common";
import { DataResolver, MappingEngine, flattenData, prepareInputsForGeneration, prepareTemplateForGeneration } from "./core.mjs";
import { TemplateStore } from "./template-repository.mjs";
import { WebTemplateCatalog } from "./catalog.mjs";

const labels = {
  en: { title: "Print form designer", shortTitle: "PDF designer", data: "Data fields", templates: "Templates", hint: "Select a field to add it to the template", search: "Search fields", empty: "No matching fields", included: "Included", notIncluded: "Not included", refresh: "Refresh data", save: "Save template", saveAs: "Save template", name: "Name", fieldIdentifier: "Field identifier", fieldIdentifierHelp: "Static-field identifier. You can rename it, but it must be unique in the template.", fieldDataBound: "Connected to a data source. Search and select an available data field.", fieldDataNotFound: "Select an available data field.", valueFromData: "Value from data", showLabel: "Show label", labelText: "Label text", labelTextHelp: "Text placed before the resolved value. A colon and a space are added automatically.", fixedPosition: "Fixed non-moving position", fixedPositionHelp: "Keeps this static element or data-bound text at its absolute position, outside the dynamic content flow.", repeatOnEveryPage: "Repeat on every page", repeatOnEveryPageHelp: "Draws the fixed element and its resolved value on every generated page. Its nearest page margin expands automatically to prevent overlap with dynamic content.", description: "Description", tags: "Tags (comma separated)", status: "Status", source: "Repository", cancel: "Cancel", preview: "PDF preview", enterFullscreen: "Enter full screen", exitFullscreen: "Exit full screen", fullscreenUnavailable: "Full screen is not available in this browser", download: "Download PDF", print: "Print", help: "Help", helpTitle: "Quick user guide", helpIntro: "Create and check a template in five steps:", helpSteps: ["Open a template or start with the current design.", "Add static elements from the palette, choose a QR/barcode type, or select a data field from the left panel.", "Select an element to adjust its identifier and style; connected Text can show a label, stay fixed, and optionally repeat on every page.", "Use PDF preview and check long, empty and repeated values, tables, margins, and page breaks.", "Save the template with its repository metadata, then download or print the final PDF."], openGuide: "Open full user guide", close: "Close" },
  es: { title: "Diseñador de formularios de impresión", shortTitle: "Editor PDF", data: "Campos de datos", templates: "Plantillas", hint: "Selecciona un campo para añadirlo a la plantilla", search: "Buscar campos", empty: "No hay campos coincidentes", included: "Incluido", notIncluded: "No incluido", refresh: "Actualizar datos", save: "Guardar plantilla", saveAs: "Guardar plantilla", name: "Nombre", fieldIdentifier: "Identificador del campo", fieldIdentifierHelp: "Identificador de un campo estático. Puedes renombrarlo, pero debe ser único en la plantilla.", fieldDataBound: "Conectado a una fuente de datos. Busca y selecciona un campo disponible.", fieldDataNotFound: "Selecciona un campo de datos disponible.", valueFromData: "Valor desde datos", showLabel: "Mostrar etiqueta", labelText: "Texto de la etiqueta", labelTextHelp: "Texto situado antes del valor resuelto. Se añaden automáticamente dos puntos y un espacio.", fixedPosition: "Posición fija no desplazable", fixedPositionHelp: "Mantiene este elemento estático o texto conectado a datos en su posición absoluta, fuera del flujo de contenido dinámico.", repeatOnEveryPage: "Repetir en todas las páginas", repeatOnEveryPageHelp: "Dibuja el elemento fijo y su valor resuelto en todas las páginas generadas. El margen más cercano se amplía automáticamente para evitar solapamientos con contenido dinámico.", description: "Descripción", tags: "Etiquetas (separadas por comas)", status: "Estado", source: "Repositorio", cancel: "Cancelar", preview: "Vista previa del PDF", enterFullscreen: "Pantalla completa", exitFullscreen: "Salir de pantalla completa", fullscreenUnavailable: "La pantalla completa no está disponible en este navegador", download: "Descargar PDF", print: "Imprimir", help: "Ayuda", helpTitle: "Guía rápida de uso", helpIntro: "Crea y comprueba una plantilla en cinco pasos:", helpSteps: ["Abre una plantilla o empieza con el diseño actual.", "Añade elementos estáticos desde la paleta, elige un tipo de QR/código o selecciona un campo de datos del panel izquierdo.", "Selecciona un elemento para ajustar su identificador y estilo; un Text conectado puede mostrar etiqueta, quedar fijo y repetirse en todas las páginas.", "Usa la vista previa y comprueba valores largos, vacíos y repetidos, tablas, márgenes y saltos de página.", "Guarda la plantilla con los metadatos de su repositorio y después descarga o imprime el PDF final."], openGuide: "Abrir la guía de uso completa", close: "Cerrar" }
};

Object.assign(labels.en, { blankTemplate: "Blank template", loadPdf: "Load PDF" });
Object.assign(labels.es, { blankTemplate: "Plantilla en blanco", loadPdf: "Cargar PDF" });

const icons = {
  data: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h10"/></svg>',
  templates: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 2h9v11H3zM3 6V4h7l2 2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6.2 6.2L4 9m2 6a7 7 0 0 0 12.3 2.8L20 15"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6"/></svg>',
  preview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5"/></svg>',
  exitFullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h5V4M20 9h-5V4M15 20v-5h5M9 20v-5H4"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/></svg>',
  print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5h18v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2 1-1.2 1.8M12 17h.01"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
};

const styles = `
.pdfme-web-studio{--p:#0a6ed1;--p-hover:#085caf;--text:#172b3f;--muted:#5f7285;--line:#dce3e8;--surface:#fff;--surface-subtle:#f6f8fa;font:14px/1.4 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text);border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--surface);min-height:640px;box-shadow:0 8px 28px #17324d12;position:relative}.pdfme-web-studio:fullscreen{width:100vw;height:100vh;min-height:0;border:0;border-radius:0}.pdfme-web-studio *{box-sizing:border-box}.pdfme-web-toolbar{display:flex;align-items:center;gap:16px;min-height:60px;padding:10px 14px 10px 18px;background:#fffc;border-bottom:1px solid var(--line);position:relative;z-index:6;backdrop-filter:blur(12px)}.pdfme-web-title{min-width:0;overflow:hidden;font-size:17px;font-weight:700;letter-spacing:-.01em;line-height:1.2;margin-right:auto;white-space:nowrap;text-overflow:ellipsis}.pdfme-web-title-short{display:none}.pdfme-web-actions{display:flex;align-items:center}.pdfme-web-action-group,.pdfme-web-sidebar-actions{display:flex;align-items:center;gap:7px}.pdfme-web-action-group+.pdfme-web-action-group{margin-left:4px;padding-left:11px;border-left:1px solid var(--line)}.pdfme-web-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;border:1px solid #c8d2da;border-radius:9px;background:var(--surface);color:#243b53;padding:7px 11px;cursor:pointer;font:600 13px/1 inherit;white-space:nowrap;transition:background-color .16s,border-color .16s,color .16s,box-shadow .16s,transform .16s}.pdfme-web-button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}.pdfme-web-button:hover{background:#edf6ff;border-color:#7ab7eb;color:#075b9e}.pdfme-web-button:active{transform:translateY(1px)}.pdfme-web-button:focus-visible,.pdfme-web-field:focus-visible,.pdfme-web-search input:focus-visible{outline:3px solid #0a6ed133;outline-offset:2px;border-color:var(--p)}.pdfme-web-button.primary{background:var(--p);color:#fff;border-color:var(--p);box-shadow:0 2px 7px #0a6ed133}.pdfme-web-button.primary:hover{background:var(--p-hover);border-color:var(--p-hover);color:#fff}.pdfme-web-button.icon-only{width:36px;min-height:36px;padding:0}.pdfme-web-data-toggle{display:none}.pdfme-web-layout{display:grid;grid-template-columns:272px minmax(0,1fr);height:calc(100% - 60px);min-height:580px;position:relative;transition:grid-template-columns .2s ease}.pdfme-web-studio.pdfme-web-data-collapsed .pdfme-web-layout{grid-template-columns:0 minmax(0,1fr)}.pdfme-web-sidebar{min-width:0;background:var(--surface-subtle);border-right:1px solid var(--line);padding:16px 14px;overflow:auto;z-index:4;transition:opacity .16s,transform .2s}.pdfme-web-data-collapsed .pdfme-web-sidebar{opacity:0;pointer-events:none;overflow:hidden}.pdfme-web-sidebar-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:3px}.pdfme-web-sidebar-title{min-width:0;margin-right:auto}.pdfme-web-sidebar h2{font-size:15px;line-height:1.3;margin:0}.pdfme-web-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;margin-left:5px;padding:0 6px;border-radius:99px;background:#e5ebf0;color:#526578;font-size:11px;font-weight:700;vertical-align:1px}.pdfme-web-close-data{display:none}.pdfme-web-hint{color:var(--muted);font-size:12px;margin:0 0 12px}.pdfme-web-search{display:flex;align-items:center;gap:7px;height:38px;margin-bottom:12px;padding:0 10px;border:1px solid #cfd8df;border-radius:9px;background:#fff;color:#698095}.pdfme-web-search:focus-within{border-color:var(--p);box-shadow:0 0 0 3px #0a6ed118}.pdfme-web-search svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;flex:0 0 auto}.pdfme-web-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font:inherit}.pdfme-web-search input::placeholder{color:#7a8b9a}.pdfme-web-fields{display:grid;gap:7px}.pdfme-web-field{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;text-align:left;background:#fff;border:1px solid #d7e0e6;border-radius:9px;padding:9px 10px;cursor:pointer;overflow:hidden;color:var(--text);transition:border-color .16s,box-shadow .16s,transform .16s}.pdfme-web-field::after{content:"+";grid-column:2;grid-row:1/3;align-self:center;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:7px;background:#edf3f7;color:#456278;font-size:17px;font-weight:400}.pdfme-web-field:hover{border-color:#83bce9;box-shadow:0 3px 10px #17324d12;transform:translateY(-1px)}.pdfme-web-field:hover::after{background:#dceeff;color:#075b9e}.pdfme-web-field strong,.pdfme-web-field small{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdfme-web-field strong{font-size:12.5px}.pdfme-web-field small{color:var(--muted);font-size:11.5px}.pdfme-web-empty{margin:22px 4px;color:var(--muted);font-size:12px;text-align:center}.pdfme-web-designer{min-width:0;overflow:auto;background:#e9edf0}.pdfme-web-backdrop{display:none}.pdfme-web-busy{cursor:progress}.pdfme-web-busy .pdfme-web-button,.pdfme-web-busy .pdfme-web-field{pointer-events:none}.pdfme-web-busy .pdfme-web-title::after{content:"";display:inline-block;width:12px;height:12px;margin-left:9px;border:2px solid #b8d6ef;border-top-color:var(--p);border-radius:50%;animation:pdfme-web-spin .7s linear infinite;vertical-align:-1px}@keyframes pdfme-web-spin{to{transform:rotate(360deg)}}.pdfme-web-dialog{border:0;border-radius:14px;padding:0;width:min(1100px,94vw);height:min(850px,90vh);box-shadow:0 20px 70px #0005;overflow:hidden}.pdfme-web-dialog::backdrop{background:#10253c88;backdrop-filter:blur(2px)}.pdfme-web-dialog header{display:flex;align-items:center;min-height:58px;padding:10px 14px 10px 18px;border-bottom:1px solid var(--line);font-weight:700}.pdfme-web-dialog header button{margin-left:auto}.pdfme-web-dialog iframe{width:100%;height:calc(100% - 58px);border:0}@media(max-width:1100px){.pdfme-web-toolbar{gap:10px}.pdfme-web-button-label{display:none}.pdfme-web-button{width:38px;padding:0}.pdfme-web-data-toggle{display:inline-flex}}@media(max-width:800px){.pdfme-web-studio{min-height:620px;border-radius:12px}.pdfme-web-studio:fullscreen{min-height:0;border-radius:0}.pdfme-web-toolbar{min-height:58px;padding:9px 10px 9px 14px}.pdfme-web-title{font-size:15px}.pdfme-web-title-full{display:none}.pdfme-web-title-short{display:inline}.pdfme-web-action-group{gap:5px}.pdfme-web-action-group+.pdfme-web-action-group{margin-left:2px;padding-left:7px}.pdfme-web-layout,.pdfme-web-studio.pdfme-web-data-collapsed .pdfme-web-layout{display:block;height:calc(100% - 58px);min-height:560px}.pdfme-web-studio:fullscreen .pdfme-web-layout,.pdfme-web-studio.pdfme-web-data-collapsed:fullscreen .pdfme-web-layout{min-height:0}.pdfme-web-sidebar{position:absolute;inset:0 auto 0 0;width:min(320px,88%);border-right:1px solid var(--line);box-shadow:12px 0 32px #172b3f22;transform:translateX(-105%);opacity:0;pointer-events:none}.pdfme-web-studio.pdfme-web-data-open .pdfme-web-sidebar{transform:translateX(0);opacity:1;pointer-events:auto}.pdfme-web-close-data{display:inline-flex}.pdfme-web-backdrop{position:absolute;inset:0;z-index:3;border:0;background:#172b3f52;cursor:pointer}.pdfme-web-data-open .pdfme-web-backdrop{display:block}.pdfme-web-designer{height:100%;min-height:560px}.pdfme-web-studio:fullscreen .pdfme-web-designer{min-height:0}.pdfme-web-dialog{width:96vw;height:92vh}}@media(max-width:440px){.pdfme-web-toolbar{padding-left:12px}.pdfme-web-button{width:36px;min-height:36px}.pdfme-web-action-group{gap:4px}.pdfme-web-action-group+.pdfme-web-action-group{padding-left:5px}}@media(max-width:360px){.pdfme-web-title{display:none}}
.pdfme-web-studio{box-sizing:border-box;width:100%;height:100%}
.pdfme-web-template-dialog{display:flex;flex-direction:column}.pdfme-web-template-catalog-host{flex:1 1 auto;min-height:0}.pdfme-web-template-dialog .pdfme-template-catalog{height:100%}.pdfme-template-save-form{display:grid;gap:.75rem;padding:1rem 1.2rem}.pdfme-template-save-form label{display:grid;gap:.3rem;color:var(--muted);font-size:.78rem;font-weight:600}.pdfme-template-save-form input,.pdfme-template-save-form textarea,.pdfme-template-save-form select{width:100%;padding:.55rem .65rem;border:1px solid #c8d2da;border-radius:.5rem;background:#fff;color:var(--text);font:inherit}.pdfme-template-save-form-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.25rem}
.pdfme-web-help-dialog{--p:#0a6ed1;--p-hover:#085caf;--text:#172b3f;--muted:#5f7285;--line:#dce3e8;--surface:#fff;height:fit-content;max-height:90vh;width:min(38rem,94vw);color:var(--text);background:var(--surface)}.pdfme-web-help-content{padding:1.1rem 1.3rem 1.3rem}.pdfme-web-help-content p{margin:.1rem 0 .7rem;color:var(--muted)}.pdfme-web-help-content ol{margin:.4rem 0 1.2rem;padding-left:1.35rem}.pdfme-web-help-content li+li{margin-top:.48rem}.pdfme-web-help-actions{display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap}.pdfme-web-help-actions .pdfme-web-button{width:auto;min-width:max-content;padding:7px 11px}.pdfme-web-help-actions a{text-decoration:none}
.pdfme-web-field{grid-template-columns:minmax(0,1fr) auto auto}.pdfme-web-field::after{grid-column:3}.pdfme-web-field-status{grid-column:2;grid-row:1/3;align-self:center;display:inline-flex;align-items:center;gap:.3rem;padding:.18rem .42rem;border-radius:99px;background:#eef1f3;color:#5f6b76;font-size:.68rem;font-weight:700;white-space:nowrap}.pdfme-web-field-status::before{content:"";width:.42rem;height:.42rem;border-radius:50%;background:#89919a}.pdfme-web-field-status.is-included{background:#e7f5e9;color:#256f3a}.pdfme-web-field-status.is-included::before{background:#30914c;box-shadow:0 0 0 .14rem #30914c24}
.pdfme-web-designer .pdfme-designer-bulk-update{display:none!important}
.pdfme-web-designer .pdfme-field-data-icon{display:inline-block;width:16px;height:16px;flex:0 0 16px;background:var(--p);font-size:0;line-height:0;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cellipse cx='12' cy='5' rx='8' ry='3' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cellipse cx='12' cy='5' rx='8' ry='3' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/contain no-repeat}
.pdfme-web-designer .pdfme-designer-list-view .lucide-lock{color:transparent!important;fill:transparent!important;stroke:transparent!important;background:var(--muted);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z' fill='none' stroke='black' stroke-width='2'/%3E%3Ccircle cx='12' cy='12' r='2.5' fill='black'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z' fill='none' stroke='black' stroke-width='2'/%3E%3Ccircle cx='12' cy='12' r='2.5' fill='black'/%3E%3C/svg%3E") center/contain no-repeat}
.pdfme-web-designer .pdfme-designer-list-view li>div:not(:has(>.lucide-lock))::after{content:"";display:inline-block;width:15px;height:15px;flex:0 0 15px;margin-right:.5rem;background:var(--p);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cellipse cx='12' cy='5' rx='8' ry='3' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cellipse cx='12' cy='5' rx='8' ry='3' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/contain no-repeat}
.pdfme-web-designer .pdfme-designer-list-view li>div.pdfme-field-fixed-position::after{content:"";display:inline-block;width:15px;height:15px;flex:0 0 15px;margin-right:.5rem;background:var(--p);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8 3h8l-1 6 3 3v2H6v-2l3-3zM12 14v7' fill='none' stroke='black' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8 3h8l-1 6 3 3v2H6v-2l3-3zM12 14v7' fill='none' stroke='black' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat}
.pdfme-web-designer .pdfme-designer-list-view li>div.pdfme-field-repeat-on-every-page::after{content:"";display:inline-block;width:15px;height:15px;flex:0 0 15px;margin-right:.5rem;background:var(--p);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='9' y='9' width='12' height='12' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M15 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='9' y='9' width='12' height='12' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M15 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/contain no-repeat}
.pdfme-web-designer .pdfme-field-data-select .ant-select-prefix{display:inline-block;width:16px;height:16px;flex:0 0 16px;background:var(--p);font-size:0;line-height:0;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cellipse cx='12' cy='5' rx='8' ry='3' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cellipse cx='12' cy='5' rx='8' ry='3' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/contain no-repeat}
`;

let studioId = 0;

export function createBlankTemplate() {
  return { basePdf: { width: 210, height: 297, padding: [12, 12, 12, 12] }, schemas: [[]] };
}

export async function createTemplateFromPdf(source) {
  const data = source instanceof Blob ? await source.arrayBuffer() : source;
  if (typeof data === "string") {
    if (!data.startsWith("data:application/pdf;")) throw new TypeError("A PDF file is required");
  } else {
    const bytes = data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : null;
    const header = bytes ? String.fromCharCode(...bytes.subarray(0, Math.min(bytes.length, 1024))) : "";
    if (!header.includes("%PDF-")) throw new TypeError("A PDF file is required");
  }
  return { basePdf: await getB64BasePdf(data), schemas: [[]] };
}

export function syncFieldListIndicators(designerRoot, pageSchemas = []) {
  const rows = designerRoot?.querySelectorAll?.(".pdfme-designer-list-view li > div") || [];
  rows.forEach((row, index) => {
    const schema = pageSchemas[index];
    const fixed = schema?.fixedPosition === true && (schema?.readOnly === true || schema?.type === "text");
    row.classList.toggle("pdfme-field-fixed-position", fixed);
    row.classList.toggle("pdfme-field-repeat-on-every-page", fixed && schema?.repeatOnEveryPage === true);
  });
  return rows.length;
}

export function formatFieldValueWithLabel(schema, value) {
  const text = String(value ?? "");
  const label = String(schema?.label ?? "").trim();
  const dataBound = schema?.readOnly !== true || Boolean(schema?.__ui5PdfmeFixedInputAlias);
  return schema?.type === "text" && dataBound && schema?.showLabel === true && label
    ? `${label}: ${text}`
    : text;
}

export function withLockedFieldNames(plugins = {}, isDataBound = () => false, isUniqueName = (name, activeSchema, schemasList = []) => (
  !schemasList.some((schema) => schema.name === name && schema.id !== activeSchema?.id)
), getDataFieldOptions = () => []) {
  return Object.fromEntries(Object.entries(plugins).map(([label, plugin]) => {
    const originalPdf = plugin?.pdf;
    const originalUi = plugin?.ui;
    const supportsFieldLabel = plugin?.propPanel?.defaultSchema?.type === "text";
    const fixedPdf = typeof originalPdf === "function" ? async (args) => {
      const value = String(args?.value ?? "");
      const match = value.match(/^\u0000ui5-pdfme-fixed:(\d+):(\d+)\u0000/);
      if (!match) return originalPdf({ ...args, value: supportsFieldLabel ? formatFieldValueWithLabel(args?.schema, value) : value });
      if (Number(match[1]) !== Number(match[2])) return undefined;
      const unwrappedValue = value.slice(match[0].length);
      return originalPdf({ ...args, value: supportsFieldLabel ? formatFieldValueWithLabel(args?.schema, unwrappedValue) : unwrappedValue });
    } : originalPdf;
    const labeledUi = supportsFieldLabel && typeof originalUi === "function" ? (args) => {
      const showLabel = args?.schema?.readOnly !== true && args?.schema?.showLabel === true && String(args?.schema?.label ?? "").trim();
      return originalUi({
        ...args,
        value: formatFieldValueWithLabel(args?.schema, args?.value),
        mode: showLabel && args?.mode === "designer" ? "viewer" : args?.mode
      });
    } : originalUi;
    if (!plugin?.propPanel) return [label, { ...plugin, pdf: fixedPdf }];
    const originalSchema = plugin.propPanel.schema;
    const originalDefaultSchema = plugin.propPanel.defaultSchema;
    const supportsDataBinding = originalDefaultSchema?.readOnly !== true;
    const defaultSchema = originalDefaultSchema && originalDefaultSchema.readOnly === undefined
      ? { ...originalDefaultSchema, readOnly: true }
      : originalDefaultSchema;
    return [label, {
      ...plugin,
      pdf: fixedPdf,
      ui: labeledUi,
      propPanel: {
        ...plugin.propPanel,
        widgets: {
          ...(plugin.propPanel.widgets || {}),
          ...(supportsFieldLabel ? {
            FieldLabelToggle: (widgetProps) => {
              const { rootElement, changeSchemas, activeSchema, i18n } = widgetProps;
              const dataBound = activeSchema?.readOnly !== true;
              const checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              checkbox.checked = dataBound ? activeSchema?.showLabel === true : true;
              checkbox.disabled = !dataBound;
              checkbox.onchange = (event) => changeSchemas([{
                key: "showLabel",
                value: event.target.checked,
                schemaId: activeSchema.id
              }]);
              const container = document.createElement("label");
              const text = document.createElement("span");
              text.textContent = i18n("showLabel");
              text.style.marginLeft = "0.5rem";
              container.style.cssText = "display:flex;width:100%;";
              container.style.opacity = dataBound ? "1" : "0.5";
              container.append(checkbox, text);
              rootElement.append(container);
            }
          } : {})
        },
        defaultSchema,
        schema: (props) => {
          const dataBound = isDataBound(props.activeSchema);
          const supportsFixedPosition = props.activeSchema?.readOnly === true || props.activeSchema?.type === "text";
          const dataOptions = dataBound
            ? getDataFieldOptions(props.activeSchema).filter((option) => (
              option.value === props.activeSchema?.name || isUniqueName(option.value, props.activeSchema, props.schemas || [])
            ))
            : [];
          return {
            ...(typeof originalSchema === "function" ? originalSchema(props) : originalSchema || {}),
            ...(supportsDataBinding ? {
              editable: {
                title: props.i18n("editable"),
                type: "boolean",
                span: 8,
                hidden: false
              }
            } : {}),
            ...(supportsFieldLabel ? {
              showLabelControl: {
                type: "boolean",
                widget: "FieldLabelToggle",
                bind: false,
                span: 12,
                hidden: false
              },
              label: {
                title: props.i18n("labelText"),
                type: "string",
                span: 12,
                hidden: !dataBound || props.activeSchema?.showLabel !== true,
                props: { title: props.i18n("labelTextHelp"), autoComplete: "off" }
              }
            } : {}),
            fixedPosition: {
              title: props.i18n("fixedPosition"),
              type: "boolean",
              span: 12,
              hidden: !supportsFixedPosition || !props.basePdf || typeof props.basePdf !== "object" || !Array.isArray(props.basePdf.padding),
              props: { title: props.i18n("fixedPositionHelp") }
            },
            repeatOnEveryPage: {
              title: props.i18n("repeatOnEveryPage"),
              type: "boolean",
              span: 12,
              hidden: !supportsFixedPosition || props.activeSchema?.fixedPosition !== true || !props.basePdf || typeof props.basePdf !== "object" || !Array.isArray(props.basePdf.padding),
              props: { title: props.i18n("repeatOnEveryPageHelp") }
            },
            name: {
              title: props.i18n("fieldName"),
              type: "string",
              required: true,
              span: 12,
              disabled: false,
              ...(dataBound ? { widget: "select" } : {}),
              rules: [
                {
                  validator: (_rule, value) => isUniqueName(value, props.activeSchema, props.schemas || []),
                  message: props.i18n("validation.uniqueName")
                },
                ...(dataBound ? [{
                  validator: (_rule, value) => dataOptions.some((option) => option.value === value),
                  message: props.i18n("fieldDataNotFound")
                }] : [])
              ],
              props: {
                autoComplete: "off",
                title: props.i18n(dataBound ? "fieldDataBound" : "fieldIdentifierHelp"),
                ...(dataBound ? {
                  options: dataOptions,
                  showSearch: true,
                  optionFilterProp: "label",
                  notFoundContent: props.i18n("fieldDataNotFound"),
                  className: "pdfme-field-data-select",
                  prefix: " ",
                  classNames: { prefix: "pdfme-field-data-icon" }
                } : {})
              }
            }
          };
        }
      }
    }];
  }));
}

export function createDefaultPlugins(isDataBound, isUniqueName, getDataFieldOptions) {
  return withLockedFieldNames({
    Text: schemas.text, MultiVariableText: schemas.multiVariableText, Table: schemas.table,
    List: schemas.list, Image: schemas.image, Signature: schemas.signature, SVG: schemas.svg,
    Line: schemas.line, Rectangle: schemas.rectangle, Ellipse: schemas.ellipse, Date: schemas.date,
    DateTime: schemas.dateTime, Time: schemas.time, Select: schemas.select,
    RadioGroup: schemas.radioGroup, Checkbox: schemas.checkbox, CircleMark: schemas.circleMark,
    QRCode: schemas.barcodes.qrcode, Code128: schemas.barcodes.code128,
    EAN13: schemas.barcodes.ean13, DataMatrix: schemas.barcodes.gs1datamatrix, PDF417: schemas.barcodes.pdf417
  }, isDataBound, isUniqueName, getDataFieldOptions);
}

function ensureStyles() {
  if (document.querySelector("style[data-pdfme-web]")) return;
  const style = document.createElement("style");
  style.dataset.pdfmeWeb = "true";
  style.textContent = styles;
  document.head.append(style);
}

function uniqueName(template, path) {
  const base = String(path).replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "") || "field";
  const names = new Set((template.schemas || []).flat().map(({ name }) => name));
  let name = base;
  let suffix = 2;
  while (names.has(name)) name = `${base}_${suffix++}`;
  return name;
}

function canonicalDataPath(path) {
  return String(path ?? "").replace(/\[(?:'([^']+)'|"([^"]+)"|(\d+))\]/g, (_match, single, double, index) => `.${single || double || index}`).replace(/^\$\.?/, "").replace(/^\.|\.$/g, "");
}

function pathsFromDefinition(definition) {
  if (typeof definition === "string") return [definition];
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return [];
  if (definition.variables && typeof definition.variables === "object") {
    const variableDefinitions = Array.isArray(definition.variables)
      ? definition.variables
      : Object.values(definition.variables);
    return variableDefinitions.flatMap(pathsFromDefinition);
  }
  if (typeof definition.path === "string") return [definition.path];
  if (typeof definition.template !== "string") return [];
  return [...definition.template.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1].trim());
}

export function getIncludedDataPaths(template, mappingDefinition = {}) {
  const schemaNames = new Set((template?.schemas || []).flat().map((schema) => schema.name));
  const fields = mappingDefinition.fields || mappingDefinition;
  const repeat = typeof mappingDefinition.repeat === "string" ? mappingDefinition.repeat : "";
  const included = new Set();
  schemaNames.forEach((name) => {
    pathsFromDefinition(fields?.[name]).forEach((path) => {
      const expandedPath = repeat && /^\$item(?:\.|$)/.test(path)
        ? `${repeat}[0]${path.slice("$item".length)}`
        : path;
      included.add(canonicalDataPath(expandedPath));
    });
  });
  return included;
}

export function isDataBoundField(schema, { mapping, autoMappings, resolvedData } = {}) {
  if (!schema || schema.readOnly === true) return false;
  const name = typeof schema === "string" ? schema : schema.name;
  if (!name) return false;
  if (typeof schema === "object") return true;
  if (Object.prototype.hasOwnProperty.call(autoMappings || {}, name)) return true;
  const configured = mapping?.fields || mapping;
  if (configured && typeof configured === "object" && Object.prototype.hasOwnProperty.call(configured, name)) return true;
  return flattenData(resolvedData).some((field) => canonicalDataPath(field.path) === canonicalDataPath(name));
}

export function getDataFieldOptions({ mapping, autoMappings, resolvedData } = {}) {
  const options = new Map();
  const add = (name, definition = name) => {
    if (!name || options.has(name)) return;
    const paths = pathsFromDefinition(definition);
    options.set(name, {
      value: name,
      label: paths.length && !(paths.length === 1 && paths[0] === name)
        ? `${name} — ${paths.join(", ")}`
        : name
    });
  };
  const configured = mapping?.fields || (mapping && !Object.prototype.hasOwnProperty.call(mapping, "repeat") ? mapping : {});
  Object.entries(configured || {}).forEach(([name, definition]) => add(name, definition));
  Object.entries(autoMappings || {}).forEach(([name, definition]) => add(name, definition));
  flattenData(resolvedData).forEach(({ path }) => add(path));
  return [...options.values()];
}

export function getMultiVariableNames(schema = {}) {
  const namesFromText = [...String(schema.text || "").matchAll(/\{([^{}]+)\}/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return [...new Set(namesFromText.length ? namesFromText : (schema.variables || []))];
}

export function isUniqueFieldName(template, name, activeName) {
  if (!name) return true;
  const matches = (template?.schemas || []).flat().filter((schema) => schema.name === name).length;
  return name === activeName ? matches <= 1 : matches === 0;
}

export function resolveStudioTitle({ title, templateName, record, fallback }) {
  return title || record?.name || templateName || fallback;
}

export function resolveHelpUrl(language, configuredUrl) {
  if (configuredUrl) return String(configuredUrl);
  return language === "es"
    ? "https://jesusfrguz.github.io/ui5-pdfme/guide/"
    : "https://jesusfrguz.github.io/ui5-pdfme/guide/en.html";
}

export function createDefaultFieldMappings(template, configuredFields = {}) {
  const defaults = {};
  (template?.schemas || []).flat().forEach((schema) => {
    if (schema.readOnly) return;
    if (schema.type === "multiVariableText") {
      defaults[schema.name] = {
        variables: Object.fromEntries(getMultiVariableNames(schema).map((name) => [
          name,
          Object.prototype.hasOwnProperty.call(configuredFields, name) ? configuredFields[name] : name
        ]))
      };
    } else {
      defaults[schema.name] = schema.name;
    }
  });
  return defaults;
}

export class WebPdfTemplateStudio {
  constructor(target, configuration = {}) {
    this.root = typeof target === "string" ? document.querySelector(target) : target;
    if (!(this.root instanceof HTMLElement)) throw new TypeError("A target HTMLElement or selector is required");
    this.id = ++studioId;
    this.dataPanelId = `pdfme-web-data-${this.id}`;
    this.resolver = new DataResolver();
    this.mapper = new MappingEngine();
    this.loaders = {};
    this.autoMappings = {};
    const isDataBound = (schema) => this.isDataBoundField(schema);
    const isUniqueName = (name, schema) => this.isUniqueFieldName(name, schema);
    const dataFieldOptions = () => this.getDataFieldOptions();
    this.plugins = {
      ...createDefaultPlugins(isDataBound, isUniqueName, dataFieldOptions),
      ...withLockedFieldNames(configuration.plugins || {}, isDataBound, isUniqueName, dataFieldOptions)
    };
    this.configure({ template: createBlankTemplate(), dataSources: [], mapping: null, templateRepositories: [], filename: "document.pdf", language: "en", autoResolve: true, showHelp: true, helpUrl: "", ...configuration }, false);
    this.render();
    if (this.configuration.autoResolve) this.refreshData().catch(() => {});
  }

  configure(configuration = {}, refresh = true) {
    this.configuration = { ...(this.configuration || {}), ...configuration };
    if (configuration.template) this.template = structuredClone(configuration.template);
    if (configuration.dataSources) this.dataSources = configuration.dataSources;
    if (Object.hasOwn(configuration, "mapping")) this.mapping = configuration.mapping;
    if (configuration.templateRepository || configuration.templateRepositories) {
      const repositories = configuration.templateRepositories || configuration.templateRepository;
      this.templateStore = new TemplateStore(repositories, { context: { fetch: configuration.fetch || this.configuration.fetch, storage: configuration.storage || this.configuration.storage, signal: configuration.signal || this.configuration.signal } });
    }
    this.filename = this.configuration.filename || "document.pdf";
    this.language = labels[this.configuration.language] ? this.configuration.language : "en";
    this.inputs = null;
    if (refresh && this.designer && configuration.template) {
      this.designer.updateTemplate(this.template);
      this.queueFieldListIndicatorSync();
    }
    if (refresh && this.designer && configuration.dataSources && this.configuration.autoResolve) this.refreshData().catch(() => {});
    if (refresh && this.fieldList && (configuration.template || Object.hasOwn(configuration, "mapping"))) this.renderFields(this.fieldSearch?.value || "");
    if (refresh && this.helpButton) this.helpButton.hidden = this.configuration.showHelp === false;
    if (refresh) this.updateStudioTitle();
    return this;
  }

  updateStudioTitle() {
    const t = labels[this.language];
    const configuredTitle = this.configuration.title;
    const templateTitle = resolveStudioTitle({
      title: configuredTitle,
      templateName: this.configuration.templateName,
      record: this.activeTemplateRecord,
      fallback: t.title
    });
    const shortTitle = configuredTitle || this.activeTemplateRecord?.name || this.configuration.templateName || t.shortTitle;
    if (this.titleFull) this.titleFull.textContent = String(templateTitle);
    if (this.titleShort) this.titleShort.textContent = String(shortTitle);
    if (this.titleElement) this.titleElement.title = String(templateTitle);
  }

  render() {
    ensureStyles();
    const t = labels[this.language];
    const catalogButton = `<button type="button" data-action="openTemplateCatalog" class="pdfme-web-button" title="${t.templates}">${icons.templates}<span class="pdfme-web-button-label">${t.templates}</span></button>`;
    this.root.innerHTML = `<section class="pdfme-web-studio" aria-busy="false"><header class="pdfme-web-toolbar"><button type="button" data-action="toggleData" class="pdfme-web-button icon-only pdfme-web-data-toggle" aria-controls="${this.dataPanelId}" aria-expanded="false" aria-label="${t.data}" title="${t.data}">${icons.data}</button><span class="pdfme-web-title"><span class="pdfme-web-title-full">${t.title}</span><span class="pdfme-web-title-short">${t.shortTitle}</span></span><div class="pdfme-web-actions"><div class="pdfme-web-action-group">${catalogButton}<button type="button" data-action="saveAction" class="pdfme-web-button" title="${t.save}">${icons.save}<span class="pdfme-web-button-label">${t.save}</span></button></div><div class="pdfme-web-action-group"><button type="button" data-action="preview" class="pdfme-web-button primary" title="${t.preview}">${icons.preview}<span class="pdfme-web-button-label">${t.preview}</span></button><button type="button" data-action="download" class="pdfme-web-button" title="${t.download}">${icons.download}<span class="pdfme-web-button-label">${t.download}</span></button><button type="button" data-action="print" class="pdfme-web-button" title="${t.print}">${icons.print}<span class="pdfme-web-button-label">${t.print}</span></button></div><div class="pdfme-web-action-group"><button type="button" data-action="openHelp" class="pdfme-web-button icon-only pdfme-web-help" aria-label="${t.help}" title="${t.help}"${this.configuration.showHelp === false ? " hidden" : ""}>${icons.help}</button><button type="button" data-action="toggleFullscreen" class="pdfme-web-button icon-only pdfme-web-fullscreen" aria-pressed="false" aria-label="${t.enterFullscreen}" title="${t.enterFullscreen}">${icons.fullscreen}</button></div></div></header><div class="pdfme-web-layout"><button type="button" data-action="closeData" class="pdfme-web-backdrop" aria-label="${t.close}" tabindex="-1"></button><aside id="${this.dataPanelId}" class="pdfme-web-sidebar" aria-label="${t.data}"><div class="pdfme-web-sidebar-header"><div class="pdfme-web-sidebar-title"><h2>${t.data}<span class="pdfme-web-count">0</span></h2></div><div class="pdfme-web-sidebar-actions"><button type="button" data-action="refreshData" class="pdfme-web-button icon-only" title="${t.refresh}" aria-label="${t.refresh}">${icons.refresh}</button><button type="button" data-action="closeData" class="pdfme-web-button icon-only pdfme-web-close-data" title="${t.close}" aria-label="${t.close}">${icons.close}</button></div></div><p class="pdfme-web-hint">${t.hint}</p><label class="pdfme-web-search">${icons.search}<input type="search" placeholder="${t.search}" aria-label="${t.search}"></label><div class="pdfme-web-fields"></div></aside><main class="pdfme-web-designer"></main></div></section>`;
    this.element = this.root.firstElementChild;
    this.fieldList = this.root.querySelector(".pdfme-web-fields");
    this.fieldCount = this.root.querySelector(".pdfme-web-count");
    this.fieldSearch = this.root.querySelector(".pdfme-web-search input");
    this.dataToggle = this.root.querySelector(".pdfme-web-data-toggle");
    this.fullscreenButton = this.root.querySelector(".pdfme-web-fullscreen");
    this.helpButton = this.root.querySelector(".pdfme-web-help");
    this.titleElement = this.root.querySelector(".pdfme-web-title");
    this.titleFull = this.root.querySelector(".pdfme-web-title-full");
    this.titleShort = this.root.querySelector(".pdfme-web-title-short");
    this.updateStudioTitle();
    this.handleFullscreenChange = () => this.syncFullscreenButton();
    this.handleFullscreenResize = () => {
      cancelAnimationFrame(this.fullscreenFrame);
      this.fullscreenFrame = requestAnimationFrame(() => this.syncFullscreenButton());
    };
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    window.addEventListener("resize", this.handleFullscreenResize);
    this.syncFullscreenButton();
    const designerRoot = this.root.querySelector(".pdfme-web-designer");
    const designerOptions = this.configuration.designerOptions || {};
    this.designer = new Designer({
      domContainer: designerRoot,
      template: this.template,
      plugins: this.plugins,
      options: {
        lang: this.language,
        ...designerOptions,
        labels: {
          fieldName: t.fieldIdentifier,
          fieldIdentifierHelp: t.fieldIdentifierHelp,
          fieldDataBound: t.fieldDataBound,
          fieldDataNotFound: t.fieldDataNotFound,
          editable: t.valueFromData,
          showLabel: t.showLabel,
          labelText: t.labelText,
          labelTextHelp: t.labelTextHelp,
          fixedPosition: t.fixedPosition,
          fixedPositionHelp: t.fixedPositionHelp,
          repeatOnEveryPage: t.repeatOnEveryPage,
          repeatOnEveryPageHelp: t.repeatOnEveryPageHelp,
          ...(designerOptions.labels || {})
        }
      }
    });
    this.designerRoot = designerRoot;
    this.setupFieldListIndicators();
    this.designer.onChangeTemplate?.((template) => {
      this.template = template;
      this.renderFields(this.fieldSearch?.value || "");
      this.queueFieldListIndicatorSync();
      this.emit("templateChange", { template });
    });
    this.designer.onSaveTemplate?.((template) => { this.template = template; this.emit("templateSave", { template }); });
    this.root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => Promise.resolve(this[button.dataset.action]()).catch((error) => this.handleError(button.dataset.action, error))));
    this.fieldSearch.addEventListener("input", () => this.renderFields(this.fieldSearch.value));
    this.handleKeydown = (event) => {
      if (event.key !== "Escape") return;
      this.closeData();
      clearTimeout(this.fullscreenSyncTimer);
      this.fullscreenSyncTimer = setTimeout(() => this.syncFullscreenButton(), 250);
    };
    this.root.addEventListener("keydown", this.handleKeydown);
    this.setupResponsiveDesigner();
  }

  setupFieldListIndicators() {
    this.fieldListIndicatorObserver?.disconnect();
    this.fieldListIndicatorObserver = new MutationObserver(() => this.queueFieldListIndicatorSync());
    this.fieldListIndicatorObserver.observe(this.designerRoot, { childList: true, subtree: true });
    this.queueFieldListIndicatorSync();
  }

  queueFieldListIndicatorSync() {
    cancelAnimationFrame(this.fieldListIndicatorFrame);
    this.fieldListIndicatorFrame = requestAnimationFrame(() => {
      const page = this.designer?.getPageCursor?.() || 0;
      syncFieldListIndicators(this.designerRoot, this.getTemplate()?.schemas?.[page] || []);
    });
  }

  emit(name, detail) {
    this.root.dispatchEvent(new CustomEvent(`pdfme:${name}`, { detail }));
    this.configuration[`on${name[0].toUpperCase()}${name.slice(1)}`]?.(detail);
  }

  registerDataProvider(type, provider) { this.resolver.registry.register(type, provider); return this; }
  registerLoader(name, loader) { this.loaders[name] = loader; return this; }
  registerFormatter(name, formatter) { this.mapper.registerFormatter(name, formatter); return this; }
  getTemplate() { return this.designer?.getTemplate() || this.template; }
  getResolvedData() { return this.resolvedData; }
  getInputs() { return this.inputs; }
  isDataBoundField(schema) { return isDataBoundField(schema, { mapping: this.mapping, autoMappings: this.autoMappings, resolvedData: this.resolvedData }); }
  getDataFieldOptions() { return getDataFieldOptions({ mapping: this.mapping, autoMappings: this.autoMappings, resolvedData: this.resolvedData }); }
  isUniqueFieldName(name, activeSchema) {
    return isUniqueFieldName(this.getTemplate(), name, activeSchema?.name);
  }

  mappingDefinition() {
    const configuredFields = this.mapping?.fields || this.mapping || {};
    const defaults = createDefaultFieldMappings(this.getTemplate(), configuredFields);
    Object.assign(defaults, this.autoMappings);
    if (!this.mapping) return { fields: defaults };
    return { ...this.mapping, fields: { ...defaults, ...(this.mapping.fields || this.mapping) } };
  }

  async refreshData() {
    this.setBusy(true);
    try {
      this.resolvedData = await this.resolver.resolve(this.dataSources || [], { loaders: this.loaders, fetch: this.configuration.fetch, signal: this.configuration.signal });
      this.inputs = this.mapper.mapInputs(this.resolvedData, this.mappingDefinition());
      this.renderFields(this.fieldSearch?.value || "");
      this.emit("dataResolved", { data: this.resolvedData, inputs: this.inputs });
      return this.resolvedData;
    } catch (error) { this.handleError("resolve", error); throw error; }
    finally { this.setBusy(false); }
  }

  renderFields(query = "") {
    const fields = flattenData(this.resolvedData);
    const includedPaths = getIncludedDataPaths(this.getTemplate(), this.mappingDefinition());
    const normalizedQuery = query.trim().toLocaleLowerCase(this.language);
    const visibleFields = normalizedQuery ? fields.filter((field) => `${field.path} ${String(field.value ?? "")}`.toLocaleLowerCase(this.language).includes(normalizedQuery)) : fields;
    this.fieldCount.textContent = String(fields.length);
    if (!visibleFields.length) {
      const empty = document.createElement("p");
      empty.className = "pdfme-web-empty";
      empty.textContent = labels[this.language].empty;
      this.fieldList.replaceChildren(empty);
      return;
    }
    this.fieldList.replaceChildren(...visibleFields.map((field) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pdfme-web-field";
      const preview = field.kind === "array" ? `${field.value.length} entries` : String(field.value ?? "");
      const included = includedPaths.has(canonicalDataPath(field.path));
      const name = document.createElement("strong");
      const sample = document.createElement("small");
      const status = document.createElement("span");
      name.textContent = field.path;
      sample.textContent = preview.slice(0, 90);
      status.className = `pdfme-web-field-status${included ? " is-included" : ""}`;
      status.textContent = labels[this.language][included ? "included" : "notIncluded"];
      button.dataset.included = String(included);
      button.append(name, sample, status);
      button.addEventListener("click", () => this.insertDataField(field.path, field.value));
      return button;
    }));
  }

  insertDataField(path, sampleValue) {
    const template = this.getTemplate() || createBlankTemplate();
    const page = this.designer?.getPageCursor?.() || 0;
    template.schemas[page] ||= [];
    const name = uniqueName(template, path);
    const row = template.schemas[page].length;
    if (Array.isArray(sampleValue)) {
      const first = sampleValue[0];
      const columns = first && typeof first === "object" && !Array.isArray(first) ? Object.keys(first) : [];
      const matrix = columns.length ? sampleValue.map((record) => columns.map((column) => String(record[column] ?? ""))) : sampleValue.map((value) => [String(value)]);
      template.schemas[page].push({ name, type: "table", position: { x: 20, y: 20 + (row % 10) * 18 }, width: 170, height: 35, content: JSON.stringify(matrix), showHead: true, head: columns.length ? columns : ["Value"], headWidthPercentages: new Array(columns.length || 1).fill(100 / (columns.length || 1)), tableStyles: { borderWidth: 0.3, borderColor: "#89919a" }, headStyles: { alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1, characterSpacing: 0, fontColor: "#fff", backgroundColor: "#0a6ed1", borderColor: "", borderWidth: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, bodyStyles: { alignment: "left", verticalAlignment: "middle", fontSize: 13, lineHeight: 1, characterSpacing: 0, fontColor: "#000", backgroundColor: "", alternateBackgroundColor: "#f5f5f5", borderColor: "#888", borderWidth: { top: .1, right: .1, bottom: .1, left: .1 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, columnStyles: {} });
      this.autoMappings[name] = { path, formatter: "table", options: { columns } };
    } else {
      template.schemas[page].push({ name, type: "text", position: { x: 20 + (row % 2) * 90, y: 20 + (row % 20) * 12 }, width: 75, height: 10, fontSize: 12, content: typeof sampleValue === "object" ? JSON.stringify(sampleValue) : String(sampleValue ?? "") });
      this.autoMappings[name] = path;
    }
    this.template = template;
    this.designer?.updateTemplate(template);
    if (this.resolvedData) this.inputs = this.mapper.mapInputs(this.resolvedData, this.mappingDefinition());
    this.renderFields(this.fieldSearch?.value || "");
    this.emit("fieldInsert", { fieldName: name, path });
    if (this.mobileMedia?.matches) this.closeData();
    return name;
  }

  toggleData() {
    const mobile = this.mobileMedia?.matches;
    if (mobile) this.element.classList.toggle("pdfme-web-data-open");
    else this.element.classList.toggle("pdfme-web-data-collapsed");
    const expanded = mobile ? this.element.classList.contains("pdfme-web-data-open") : !this.element.classList.contains("pdfme-web-data-collapsed");
    this.dataToggle?.setAttribute("aria-expanded", String(expanded));
  }

  closeData() {
    this.element.classList.remove("pdfme-web-data-open");
    this.dataToggle?.setAttribute("aria-expanded", "false");
  }

  async toggleFullscreen() {
    if (document.fullscreenElement === this.element) {
      await document.exitFullscreen();
      return false;
    }
    if (!this.element?.requestFullscreen) throw new Error(labels[this.language].fullscreenUnavailable);
    await this.element.requestFullscreen();
    return true;
  }

  syncFullscreenButton() {
    if (!this.fullscreenButton) return;
    const active = document.fullscreenElement === this.element;
    const label = labels[this.language][active ? "exitFullscreen" : "enterFullscreen"];
    this.fullscreenButton.innerHTML = active ? icons.exitFullscreen : icons.fullscreen;
    this.fullscreenButton.setAttribute("aria-pressed", String(active));
    this.fullscreenButton.setAttribute("aria-label", label);
    this.fullscreenButton.title = label;
  }

  setupResponsiveDesigner() {
    this.mobileMedia = window.matchMedia("(max-width: 800px)");
    this.handleResponsiveChange = () => {
      this.closeData();
      const sidebar = this.root.querySelector(".pdfme-designer-right-sidebar");
      const toggle = this.root.querySelector(".pdfme-designer-sidebar-toggle");
      if (this.mobileMedia.matches && sidebar && toggle && sidebar.getBoundingClientRect().width > 0) {
        toggle.click();
        this.autoCollapsedDesignerSidebar = true;
      } else if (!this.mobileMedia.matches && this.autoCollapsedDesignerSidebar && sidebar && toggle && sidebar.getBoundingClientRect().width === 0) {
        toggle.click();
        this.autoCollapsedDesignerSidebar = false;
      }
      this.dataToggle?.setAttribute("aria-expanded", String(!this.mobileMedia.matches && !this.element.classList.contains("pdfme-web-data-collapsed")));
    };
    if (this.mobileMedia.addEventListener) this.mobileMedia.addEventListener("change", this.handleResponsiveChange);
    else this.mobileMedia.addListener(this.handleResponsiveChange);
    this.responsiveFrame = requestAnimationFrame(() => this.handleResponsiveChange());
  }

  registerTemplateRepositoryProvider(type, provider) {
    if (!this.templateStore) this.templateStore = new TemplateStore([]);
    this.templateStore.register(type, provider);
    return this;
  }

  listTemplates(query = {}) {
    if (!this.templateStore) return Promise.reject(new Error("No template repository configured"));
    return this.templateStore.list(query);
  }

  async getTemplateRecord(id, options = {}) {
    if (!this.templateStore) throw new Error("No template repository configured");
    return this.templateStore.get(id, options);
  }

  applyNewTemplate(template) {
    this.activeTemplateRecord = null;
    this.autoMappings = {};
    this.inputs = null;
    this.configure({ template });
    this.emit("templateChange", { template: this.template });
    return this.template;
  }

  startBlankTemplate() {
    return this.applyNewTemplate(createBlankTemplate());
  }

  async importPdfTemplate(source) {
    return this.applyNewTemplate(await createTemplateFromPdf(source));
  }

  applyTemplateRecord(record) {
    if (!record?.template) throw new TypeError("The template record has no pdfme template");
    this.activeTemplateRecord = record;
    this.autoMappings = {};
    this.configure({ template: record.template, mapping: record.mapping || null });
    if (this.configuration.applyStoredDataSources && record.dataSources) this.configure({ dataSources: record.dataSources });
    this.emit("templateLoaded", { record });
    return record;
  }

  async loadTemplate(id, options = {}) {
    const record = typeof id === "object" && id.template ? id : await this.getTemplateRecord(id, options);
    return this.applyTemplateRecord(record);
  }

  async saveTemplateRecord(metadata = {}, options = {}) {
    if (!this.templateStore) throw new Error("No template repository configured");
    const previous = this.activeTemplateRecord || {};
    const record = {
      ...previous,
      ...metadata,
      id: metadata.id ?? previous.id ?? "",
      name: metadata.name || previous.name || this.configuration.templateName || "Untitled template",
      template: this.getTemplate(),
      mapping: metadata.mapping || this.mapping || previous.mapping || null
    };
    if (this.configuration.persistDataSources === true) record.dataSources = this.dataSources;
    else delete record.dataSources;
    const saved = await this.templateStore.save(record, { repositoryId: options.repositoryId || metadata.repositoryId || previous.repositoryId });
    this.activeTemplateRecord = saved;
    this.updateStudioTitle();
    this.emit("templateSaved", { record: saved });
    return saved;
  }

  openTemplateCatalog() {
    const t = labels[this.language];
    const dialog = document.createElement("dialog");
    dialog.className = "pdfme-web-dialog pdfme-web-template-dialog";
    const header = document.createElement("header");
    header.append(document.createTextNode(t.templates));
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "pdfme-web-button";
    closeButton.textContent = t.close;
    header.append(closeButton);
    const host = document.createElement("div");
    host.className = "pdfme-web-template-catalog-host";
    dialog.append(header, host);
    document.body.append(dialog);
    const catalog = new WebTemplateCatalog(host, {
      store: this.templateStore,
      language: this.language,
      onTemplateOpen: ({ template }) => { this.applyTemplateRecord(template); dialog.close(); },
      onBlankTemplate: () => { this.startBlankTemplate(); dialog.close(); },
      onPdfImport: async ({ file }) => { await this.importPdfTemplate(file); dialog.close(); },
      onError: ({ error }) => this.handleError("templateCatalog", error)
    });
    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { catalog.destroy(); dialog.remove(); }, { once: true });
    dialog.showModal();
    return catalog;
  }

  openHelp() {
    const t = labels[this.language];
    const url = resolveHelpUrl(this.language, this.configuration.helpUrl);
    this.helpDialog?.close();
    const dialog = document.createElement("dialog");
    this.helpDialog = dialog;
    dialog.className = "pdfme-web-dialog pdfme-web-help-dialog";
    const header = document.createElement("header");
    header.append(document.createTextNode(t.helpTitle));
    const headerClose = document.createElement("button");
    headerClose.type = "button";
    headerClose.className = "pdfme-web-button icon-only";
    headerClose.setAttribute("aria-label", t.close);
    headerClose.title = t.close;
    headerClose.innerHTML = icons.close;
    header.append(headerClose);
    const content = document.createElement("div");
    content.className = "pdfme-web-help-content";
    const intro = document.createElement("p");
    intro.textContent = t.helpIntro;
    const steps = document.createElement("ol");
    steps.append(...t.helpSteps.map((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      return item;
    }));
    const actions = document.createElement("div");
    actions.className = "pdfme-web-help-actions";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "pdfme-web-button";
    closeButton.textContent = t.close;
    const guideLink = document.createElement("a");
    guideLink.className = "pdfme-web-button primary";
    guideLink.href = url;
    guideLink.target = "_blank";
    guideLink.rel = "noopener noreferrer";
    guideLink.textContent = t.openGuide;
    actions.append(closeButton, guideLink);
    content.append(intro, steps, actions);
    dialog.append(header, content);
    document.body.append(dialog);
    const close = () => dialog.close();
    headerClose.addEventListener("click", close);
    closeButton.addEventListener("click", close);
    dialog.addEventListener("close", () => { if (this.helpDialog === dialog) this.helpDialog = null; dialog.remove(); }, { once: true });
    dialog.showModal();
    this.emit("help", { url });
    return dialog;
  }

  openTemplateSaveDialog() {
    if (!this.templateStore?.repositories.length) throw new Error("No template repository configured");
    const t = labels[this.language];
    const dialog = document.createElement("dialog");
    dialog.className = "pdfme-web-dialog";
    dialog.style.height = "auto";
    dialog.style.width = "min(34rem,94vw)";
    const header = document.createElement("header");
    header.textContent = t.saveAs;
    const form = document.createElement("form");
    form.method = "dialog";
    form.className = "pdfme-template-save-form";
    const field = (labelText, control) => { const label = document.createElement("label"); label.append(document.createTextNode(labelText), control); return label; };
    const name = document.createElement("input");
    name.name = "name";
    name.required = true;
    name.value = this.activeTemplateRecord?.name || this.configuration.templateName || "";
    const description = document.createElement("textarea");
    description.name = "description";
    description.rows = 3;
    description.value = this.activeTemplateRecord?.description || "";
    const tags = document.createElement("input");
    tags.name = "tags";
    tags.value = (this.activeTemplateRecord?.tags || []).join(", ");
    const status = document.createElement("select");
    status.name = "status";
    ["draft", "published", "archived"].forEach((value) => { const item = document.createElement("option"); item.value = value; item.textContent = value; status.append(item); });
    status.value = this.activeTemplateRecord?.status || "draft";
    const repository = document.createElement("select");
    repository.name = "repositoryId";
    this.templateStore.repositories.forEach((source) => { const item = document.createElement("option"); item.value = source.id; item.textContent = source.name || source.id; repository.append(item); });
    repository.value = this.activeTemplateRecord?.repositoryId || this.templateStore.source().id;
    const actions = document.createElement("div");
    actions.className = "pdfme-template-save-form-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "pdfme-web-button";
    cancel.textContent = t.cancel;
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "pdfme-web-button primary";
    submit.textContent = t.save;
    actions.append(cancel, submit);
    form.append(field(t.name, name), field(t.description, description), field(t.tags, tags), field(t.status, status), field(t.source, repository), actions);
    dialog.append(header, form);
    document.body.append(dialog);
    cancel.addEventListener("click", () => dialog.close());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await this.saveTemplateRecord({ name: name.value, description: description.value, tags: tags.value.split(",").map((tag) => tag.trim()).filter(Boolean), status: status.value, repositoryId: repository.value });
        dialog.close();
      } catch (error) { submit.disabled = false; this.handleError("saveTemplate", error); }
    });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
    name.focus();
    return dialog;
  }

  async saveAction() {
    await this.save();
    if (!this.templateStore?.repositories.length) return this.getTemplate();
    if (this.activeTemplateRecord?.id) return this.saveTemplateRecord();
    this.openTemplateSaveDialog();
    return this.getTemplate();
  }

  save() { this.designer?.saveTemplate?.(); return Promise.resolve(this.getTemplate()); }

  async generate() {
    this.setBusy(true);
    try {
      if (!this.inputs) await this.refreshData();
      const template = this.getTemplate();
      checkTemplate(template);
      const preparedTemplate = prepareTemplateForGeneration(template);
      const preparedInputs = prepareInputsForGeneration(preparedTemplate, this.inputs || [{}]);
      const bytes = await generate({ template: preparedTemplate, inputs: preparedInputs, plugins: this.plugins, options: this.configuration.generatorOptions || {} });
      this.emit("generated", { bytes, blob: new Blob([bytes], { type: "application/pdf" }) });
      return bytes;
    } catch (error) { this.handleError("generate", error); throw error; }
    finally { this.setBusy(false); }
  }

  async preview() {
    const bytes = await this.generate();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const dialog = document.createElement("dialog");
    dialog.className = "pdfme-web-dialog";
    dialog.innerHTML = `<header>${labels[this.language].preview}<button class="pdfme-web-button">${labels[this.language].close}</button></header><iframe title="PDF preview"></iframe>`;
    dialog.querySelector("iframe").src = url;
    const close = () => { URL.revokeObjectURL(url); dialog.remove(); };
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", close, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    return bytes;
  }

  async download() {
    const bytes = await this.generate();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const anchor = Object.assign(document.createElement("a"), { href: url, download: this.filename });
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return bytes;
  }

  async print() {
    const bytes = await this.generate();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const frame = Object.assign(document.createElement("iframe"), { src: url, hidden: true });
    document.body.append(frame);
    frame.addEventListener("load", () => { frame.contentWindow?.print(); setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 30000); }, { once: true });
    return bytes;
  }

  setBusy(busy) { this.element?.classList.toggle("pdfme-web-busy", busy); this.element?.setAttribute("aria-busy", String(busy)); }
  handleError(operation, error) { this.emit("error", { operation, error }); }
  destroy() {
    this.helpDialog?.close();
    cancelAnimationFrame(this.responsiveFrame);
    cancelAnimationFrame(this.fieldListIndicatorFrame);
    this.fieldListIndicatorObserver?.disconnect();
    this.root.removeEventListener("keydown", this.handleKeydown);
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    window.removeEventListener("resize", this.handleFullscreenResize);
    cancelAnimationFrame(this.fullscreenFrame);
    clearTimeout(this.fullscreenSyncTimer);
    if (document.fullscreenElement === this.element) document.exitFullscreen().catch(() => {});
    if (this.mobileMedia && this.handleResponsiveChange) {
      if (this.mobileMedia.removeEventListener) this.mobileMedia.removeEventListener("change", this.handleResponsiveChange);
      else this.mobileMedia.removeListener(this.handleResponsiveChange);
    }
    this.designer?.destroy();
    this.root.replaceChildren();
  }
}
