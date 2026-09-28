ALTER TABLE users
  ADD COLUMN role text NOT NULL DEFAULT 'user'
  CONSTRAINT users_role_check CHECK (role IN ('readonly', 'user', 'admin'));

ALTER TABLE installation
  ADD COLUMN registration_enabled boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN registration_default_role text NOT NULL DEFAULT 'user'
    CONSTRAINT installation_registration_role_check CHECK (registration_default_role IN ('readonly', 'user'));

CREATE TABLE admin_audit_events (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('web', 'cli')),
  actor_id uuid,
  target_id uuid,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  before_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX admin_audit_events_occurred_idx ON admin_audit_events(occurred_at DESC, id DESC);
CREATE INDEX admin_audit_events_target_idx ON admin_audit_events(target_id, occurred_at DESC);
