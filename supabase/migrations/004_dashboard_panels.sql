-- Dashboard panels and persisted layouts (Phase 1)

CREATE TABLE IF NOT EXISTS dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  org_id uuid,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  config jsonb DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS panel_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  panel_key text NOT NULL,
  x int NOT NULL DEFAULT 0,
  y int NOT NULL DEFAULT 0,
  w int NOT NULL DEFAULT 4,
  h int NOT NULL DEFAULT 3,
  tab_group text,
  config jsonb DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shared_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  permissions text NOT NULL DEFAULT 'read',
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_panel_instances_dashboard ON panel_instances(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_id);

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_views ENABLE ROW LEVEL SECURITY;
