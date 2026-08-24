namespace ui5.pdfme;

using { cuid, managed } from '@sap/cds/common';

entity PdfTemplates : cuid, managed {
  name            : String(160) not null;
  description     : LargeString;
  tags            : LargeString default '[]';
  status          : String(20) default 'draft';
  version         : Integer default 1;
  templateJson    : LargeString not null;
  mappingJson     : LargeString;
  metadataJson    : LargeString default '{}';
  dataSourcesJson : LargeString;
}
