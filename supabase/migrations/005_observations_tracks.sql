-- Normalized observations and track partitions (Phase 2–3)

CREATE TABLE IF NOT EXISTS observations (
  id text PRIMARY KEY,
  provider_id text NOT NULL,
  source_record_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  summary text,
  url text,
  severity numeric,
  observed_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  geometry geography(POINT, 4326),
  region text,
  tags jsonb DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (provider_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_observations_observed ON observations (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_category ON observations (category, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_geom ON observations USING GIST (geometry);

CREATE TABLE IF NOT EXISTS event_clusters (
  id text PRIMARY KEY,
  canonical_title text NOT NULL,
  member_count int NOT NULL DEFAULT 1,
  sources jsonb DEFAULT '[]'::jsonb,
  latest_at timestamptz NOT NULL,
  centroid geography(POINT, 4326),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aircraft_positions (
  id bigserial PRIMARY KEY,
  icao24 text NOT NULL,
  callsign text,
  observed_at timestamptz NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  altitude_m double precision,
  heading double precision,
  velocity_ms double precision,
  provider text NOT NULL,
  provenance jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_aircraft_positions_icao_time ON aircraft_positions (icao24, observed_at DESC);

CREATE TABLE IF NOT EXISTS airports (
  icao text PRIMARY KEY,
  iata text,
  name text NOT NULL,
  country text,
  timezone text,
  geometry geography(POINT, 4326)
);

CREATE INDEX IF NOT EXISTS idx_airports_geom ON airports USING GIST (geometry);

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE aircraft_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE airports ENABLE ROW LEVEL SECURITY;
