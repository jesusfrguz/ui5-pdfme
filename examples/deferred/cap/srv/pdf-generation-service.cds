using { ui5.pdfme.deferred as db } from '../db/schema';

@protocol: 'odata-v4'
@path: 'pdf-generation'
service PdfGenerationService {
  @restrict: [
    { grant: 'READ', to: ['PdfViewer', 'PdfGenerator', 'TemplateEditor'] },
    { grant: ['CREATE', 'UPDATE'], to: 'TemplateEditor' }
  ]
  entity Templates as projection on db.Templates;

  @readonly
  @restrict: [{ grant: 'READ', to: ['PdfViewer', 'PdfGenerator', 'TemplateEditor'] }]
  entity Jobs as projection on db.GenerationJobs excluding { PayloadJson, Result };

  @requires: 'PdfGenerator'
  action enqueue(
    templateID: String(128),
    payloadJson: LargeString,
    filename: String(255),
    runAt: Timestamp,
    idempotencyKey: String(128)
  ) returns Jobs;

  @requires: 'PdfGenerator'
  action retry(jobID: UUID) returns Jobs;

  @requires: 'PdfViewer'
  action download(jobID: UUID) returns LargeBinary;

  event RenderRequested {
    jobID: UUID;
  }
}
