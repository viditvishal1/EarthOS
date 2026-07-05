-- Provider governance, health and audit (Phase 0)

CREATE TABLE IF NOT EXISTS data_providers (
  id text PRIMARY KEY,
  auth_class text NOT NULL,
  cost_class text NOT NULL,
  license_url text,
  attribution text,
  default_policy text NOT NULL DEFAULT 'default',
  schedule_seconds int NOT NULL DEFAULT 600,
  content_policy text NOT NULL DEFAULT 'metadata_only',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_health (
  provider_id text NOT NULL REFERENCES data_providers(id) ON DELETE CASCADE,
  state text NOT NULL,
  latency_ms int,
  record_count int NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, observed_at)
);

CREATE TABLE IF NOT EXISTS provider_quotas (
  provider_id text PRIMARY KEY REFERENCES data_providers(id) ON DELETE CASCADE,
  window_seconds int NOT NULL DEFAULT 3600,
  max_requests int,
  used_requests int NOT NULL DEFAULT 0,
  reset_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_health_provider ON provider_health(provider_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

ALTER TABLE data_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
