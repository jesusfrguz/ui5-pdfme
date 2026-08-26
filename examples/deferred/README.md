# Deferred PDF generation examples

This directory contains the runnable code behind [`agents/DEFERRED_GENERATION.md`](../../agents/DEFERRED_GENERATION.md) and the [Spanish web manual](../../docs/deferred/index.html).

| Directory | Purpose |
| --- | --- |
| [`renderer`](renderer/) | Shared, UI-free `DataResolver` → `MappingEngine` → `generatePdf` pipeline |
| [`node`](node/) | Plain Node HTTP API, polling worker, memory/PostgreSQL stores and filesystem output |
| [`docker`](docker/) | Non-root image plus memory and PostgreSQL compose configurations |
| [`cap`](cap/) | CAP Node.js/OData V4 example using persistent CAP event queues |

Start with the manual rather than copying isolated files. Authentication, tenant filtering, SAP data loading and output retention belong to the host application.
