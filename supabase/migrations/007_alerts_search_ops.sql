-- Saved searches and alert delivery log (Phase 7)
-- Requires: 002_ontology_search_ops.sql

create table if not exists saved_searches (
  id text primary key,
  org_id uuid references organisations(id) default '00000000-0000-0000-0000-000000000001',
  name text not null,
  query text not null,
  filters_json jsonb not null default '{}',
  schedule text default 'manual',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alert_deliveries (
  id bigserial primary key,
  alert_event_id bigint references alert_events(id) on delete cascade,
  channel text not null default 'in_app',
  status text not null default 'pending',
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_org on saved_searches (org_id, updated_at desc);

alter table saved_searches enable row level security;
alter table alert_deliveries enable row level security;

create policy deny_anon_saved_searches on saved_searches for all to anon using (false);
create policy deny_anon_alert_deliveries on alert_deliveries for all to anon using (false);

insert into feature_flags (key, enabled, description) values
  ('stooq_markets', true, 'Stooq EOD default market quotes'),
  ('prometheus_metrics', true, 'Expose /api/v1/metrics for self-host SLOs')
on conflict (key) do update set description = excluded.description;
