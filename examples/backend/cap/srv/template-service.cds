using { ui5.pdfme as db } from '../db/schema';

@protocol: 'odata-v4'
@path: 'pdf-templates'
@cds.server.body_parser.limit: '5mb'
@cds.query.limit: { default: 100, max: 1000 }
service PdfTemplateService {
  @restrict: [
    { grant: 'READ', to: ['TemplateViewer', 'TemplateEditor'] },
    { grant: ['CREATE', 'UPDATE'], to: 'TemplateEditor' }
  ]
  entity Templates as projection on db.PdfTemplates {
    key ID,
        name            as Name,
        description     as Description,
        tags            as Tags,
        status          as Status,
        version as Version @odata.etag,
        templateJson    as TemplateJson,
        mappingJson     as MappingJson,
        metadataJson    as MetadataJson,
        dataSourcesJson as DataSourcesJson,
        createdAt       as CreatedAt,
        modifiedAt      as UpdatedAt
  };
}

annotate PdfTemplateService.Templates with {
  CreatedAt @readonly;
  UpdatedAt @readonly;
};

annotate PdfTemplateService.Templates with @Core.OptimisticConcurrency: [Version];
