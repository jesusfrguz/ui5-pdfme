create table if not exists pdf_templates (
  id varchar(128) primary key check (id ~ '^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$'),
  name varchar(160) not null,
  description varchar(1024) not null default '',
  tags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tags) = 'array' and jsonb_array_length(tags) <= 32 and length(tags::text) <= 4096),
  status varchar(20) not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version between 1 and 2147483647),
  template_json jsonb not null,
  mapping_json jsonb check (mapping_json is null or jsonb_typeof(mapping_json) = 'object'),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  data_sources_json jsonb check (data_sources_json is null or jsonb_typeof(data_sources_json) = 'array'),
  created_by varchar(128) not null,
  created_at timestamptz not null default now(),
  updated_by varchar(128) not null,
  updated_at timestamptz not null default now(),
  constraint pdf_templates_schema check (
    jsonb_typeof(template_json) = 'object'
    and template_json ? 'schemas'
    and jsonb_typeof(template_json -> 'schemas') = 'array'
  )
);

create index if not exists pdf_templates_status_updated_idx on pdf_templates (status, updated_at desc);
create index if not exists pdf_templates_tags_idx on pdf_templates using gin (tags);
create index if not exists pdf_templates_search_idx on pdf_templates using gin (to_tsvector('simple', name || ' ' || description));

-- Enforce tenant/owner authorization in policies or the service layer before exposing this table.
-- Validate tag item lengths/uniqueness and the 5,000,000-character request limit in the service layer.
