using { ui5.pdfme as db } from '../db/schema';

@path: '/odata/v4/pdf-templates'
service PdfTemplateService @(requires: 'TemplateEditor') {
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
        version         as Version,
        templateJson    as TemplateJson,
        mappingJson     as MappingJson,
        metadataJson    as MetadataJson,
        dataSourcesJson as DataSourcesJson,
        createdAt       as CreatedAt,
        modifiedAt      as UpdatedAt
  };
}
