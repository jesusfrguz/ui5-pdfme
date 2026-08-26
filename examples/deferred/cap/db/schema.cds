namespace ui5.pdfme.deferred;

using { managed } from '@sap/cds/common';

entity Templates : managed {
  key ID          : String(128);
  Name            : String(160) not null;
  Status          : String(20) not null default 'draft';
  Version         : Integer not null default 1;
  TemplateJson    : LargeString not null;
  MappingJson     : LargeString not null default '{}';
  MetadataJson    : LargeString not null default '{}';
}

entity GenerationJobs : managed {
  key ID              : UUID;
  TemplateID          : String(128) not null;
  TemplateVersion     : Integer;
  Status              : String(20) not null default 'QUEUED';
  RunAt               : Timestamp not null;
  PayloadJson         : LargeString not null default '{}';
  Filename            : String(255) not null;
  MimeType            : String(100) not null default 'application/pdf';
  Result              : LargeBinary;
  InputCount          : Integer;
  Attempts            : Integer not null default 0;
  MaxAttempts         : Integer not null default 5;
  IdempotencyKey      : String(128);
  ErrorMessage        : LargeString;
  RequestedBy         : String(255);
}
