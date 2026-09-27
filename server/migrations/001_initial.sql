CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE installation (
  singleton boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  installation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  recovery_epoch uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO installation (singleton) VALUES (TRUE) ON CONFLICT DO NOTHING;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 128),
  password_hash text,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  csrf_hash bytea NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_owner_active_idx ON sessions(owner_id, idle_expires_at) WHERE revoked_at IS NULL;

CREATE TABLE account_setup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_setup_codes_owner_idx ON account_setup_codes(owner_id, expires_at) WHERE consumed_at IS NULL;

CREATE TABLE user_games (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  deleted boolean NOT NULL DEFAULT FALSE,
  document jsonb,
  name text,
  owned_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, entity_id),
  CHECK ((deleted AND document IS NULL) OR (NOT deleted AND document IS NOT NULL))
);
CREATE INDEX user_games_owner_name_idx ON user_games(owner_id, lower(name)) WHERE NOT deleted;
CREATE INDEX user_games_owner_owned_idx ON user_games(owner_id, owned_at DESC) WHERE NOT deleted AND owned_at IS NOT NULL;

CREATE TABLE players (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  deleted boolean NOT NULL DEFAULT FALSE,
  document jsonb,
  display_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, entity_id),
  CHECK ((deleted AND document IS NULL) OR (NOT deleted AND document IS NOT NULL))
);
CREATE INDEX players_owner_name_idx ON players(owner_id, lower(display_name)) WHERE NOT deleted;

CREATE TABLE plays (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  deleted boolean NOT NULL DEFAULT FALSE,
  document jsonb,
  played_at timestamptz,
  status text CHECK (status IN ('draft', 'complete')),
  game_name text,
  game_ref uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, entity_id),
  CHECK ((deleted AND document IS NULL) OR (NOT deleted AND document IS NOT NULL))
);
CREATE INDEX plays_owner_played_idx ON plays(owner_id, played_at DESC) WHERE NOT deleted;
CREATE INDEX plays_owner_game_idx ON plays(owner_id, game_ref, played_at DESC) WHERE NOT deleted;

CREATE TABLE sync_state (
  owner_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_sequence bigint NOT NULL DEFAULT 0 CHECK (current_sequence >= 0)
);

CREATE TABLE changes (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sequence bigint NOT NULL CHECK (sequence > 0),
  entity_type text NOT NULL CHECK (entity_type IN ('game', 'player', 'play')),
  entity_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  deleted boolean NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, sequence)
);
CREATE INDEX changes_owner_entity_idx ON changes(owner_id, entity_type, entity_id, sequence DESC);

CREATE TABLE mutation_receipts (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mutation_id uuid NOT NULL,
  request_fingerprint bytea NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, mutation_id)
);

CREATE TABLE adoption_receipts (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_workspace_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('game', 'player', 'play')),
  source_id text NOT NULL,
  source_fingerprint bytea NOT NULL,
  target_id uuid NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, source_workspace_id, entity_type, source_id)
);
CREATE INDEX adoption_receipts_target_idx ON adoption_receipts(owner_id, entity_type, target_id);

