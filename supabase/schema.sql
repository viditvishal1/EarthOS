-- EarthOS Supabase schema — run in SQL editor when enabling cloud persistence.
-- Tables mirror the in-process stores so swapping backends is drop-in.

create table if not exists article_cache (
  id text primary key,
  url text not null,
  title text,
  paragraphs jsonb,
  pdf_url text,
  content_type text not null default 'html',
  fetched_at timestamptz not null default now()
);

create index if not exists article_cache_fetched_at on article_cache (fetched_at desc);

create table if not exists ingested_items (
  id text primary key,
  connector_id text not null,
  module text not null,
  title text not null,
  payload jsonb not null,
  ingested_at timestamptz not null default now()
);

create index if not exists ingested_items_connector on ingested_items (connector_id, ingested_at desc);

create table if not exists event_log (
  id bigserial primary key,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists event_log_type on event_log (type, created_at desc);

-- Optional: saved bookmarks synced from clients (future auth hook-up)
create table if not exists bookmarks (
  id text primary key,
  user_id uuid,
  item jsonb not null,
  created_at timestamptz not null default now()
);
