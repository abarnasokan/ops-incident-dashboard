CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'Engineer' CHECK (role IN ('Engineer','Lead')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(4) NOT NULL CHECK (severity IN ('SEV1','SEV2','SEV3','SEV4')),
  status VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Mitigated','Resolved')),
  category VARCHAR(40) NOT NULL DEFAULT 'Application',
  service VARCHAR(80) NOT NULL DEFAULT 'Unspecified',
  assigned_to INTEGER REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS status_history (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS incident_events (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  kind VARCHAR(30) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS telemetry_events (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  kind VARCHAR(40) NOT NULL,
  trace_id VARCHAR(32),
  message TEXT NOT NULL,
  duration_ms DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_queue ON incidents(status, severity, created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS incident_events_time ON incident_events(incident_id, created_at);
CREATE INDEX IF NOT EXISTS comments_incident ON comments(incident_id, created_at);
CREATE INDEX IF NOT EXISTS telemetry_incident ON telemetry_events(incident_id, created_at DESC);
