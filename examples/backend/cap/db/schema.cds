namespace ui5.pdfme;

using { managed } from '@sap/cds/common';

entity PdfTemplates : managed {
  key ID           : String(128);
  name             : String(160) not null;
  description      : String(1024) not null default '';
  tags             : String(4096) not null default '[]';
  status           : String(20) not null default 'draft';
  version          : Integer not null default 1;
  templateJson     : LargeString not null;
  mappingJson      : LargeString;
  metadataJson     : LargeString not null default '{}';
  dataSourcesJson  : LargeString;
}
