create table if not exists pdf_templates (
  id uuid primary key,
  name varchar(160) not null,
  description text not null default '',
  tags jsonb not null default '[]'::jsonb,
  status varchar(20) not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version > 0),
  template_json jsonb not null,
  mapping_json jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  data_sources_json jsonb,
  created_by varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_by varchar(255) not null,
  updated_at timestamptz not null default now(),
  constraint pdf_templates_schema check (jsonb_typeof(template_json -> 'schemas') = 'array')
);

create index if not exists pdf_templates_status_updated_idx on pdf_templates (status, updated_at desc);
create index if not exists pdf_templates_tags_idx on pdf_templates using gin (tags);
create index if not exists pdf_templates_search_idx on pdf_templates using gin (to_tsvector('simple', name || ' ' || description));

-- Enforce tenant/owner authorization in policies or the service layer before exposing this table.
