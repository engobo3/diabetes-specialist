-- 0008 — auth_sessions: Postgres-backed session tracking.
--
-- Replaces the Firestore user_sessions collection (which the existing
-- sessionService writes to). Phase 2 only CREATES this table; the existing
-- sessionService keeps writing to Firestore. A later phase adds dual-write
-- then cuts over.
--
-- firebase_uid is denormalized for fast lookup on every request — we don't
-- want to join through users on the hot path.
--
-- expires_at uses absolute (not interval) so timezone-sensitive bugs in the
-- app don't drift the session window. The application computes expires_at
-- from `now() + idle_timeout` at session creation.

-- Up Migration

CREATE TABLE auth_sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    device_id           uuid REFERENCES user_devices(id) ON DELETE SET NULL,
    firebase_uid        varchar(128) NOT NULL,
    status              varchar(20) NOT NULL DEFAULT 'active',
    ip_address          inet,
    user_agent          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    last_activity_at    timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,
    revoked_reason      varchar(64),
    CONSTRAINT as_status_chk CHECK (
        status IN ('active', 'idle_timeout', 'absolute_timeout', 'revoked', 'replaced')
    ),
    CONSTRAINT as_revoked_consistency CHECK (
        (status = 'active' AND revoked_at IS NULL)
        OR (status <> 'active' AND revoked_at IS NOT NULL)
    )
);

-- Hot path: "is this session still active?" lookup by id
-- (covered by the PRIMARY KEY; no extra index needed)

-- "How many active sessions does this user have?" — for the concurrent-session limit
CREATE INDEX auth_sessions_user_active_idx
    ON auth_sessions (user_id)
    WHERE status = 'active';

-- "Look up active sessions by firebase_uid for cross-tab logout broadcasts"
CREATE INDEX auth_sessions_firebase_uid_active_idx
    ON auth_sessions (firebase_uid)
    WHERE status = 'active';

-- For the expiration sweeper
CREATE INDEX auth_sessions_expires_at_idx
    ON auth_sessions (expires_at)
    WHERE status = 'active';

COMMENT ON TABLE auth_sessions IS
    'Postgres-backed session tracking. Replaces Firestore user_sessions collection. Phase 2 creates the table; Phase 5 dual-writes; Phase 6 cuts over.';
COMMENT ON COLUMN auth_sessions.firebase_uid IS
    'Denormalized from users.firebase_uid for fast lookup on every request. Updated only if the parent user row is rotated (rare).';
COMMENT ON COLUMN auth_sessions.status IS
    'Lifecycle: active → (idle_timeout | absolute_timeout | revoked | replaced). Terminal states all carry revoked_at and revoked_reason.';

-- Down Migration

DROP TABLE IF EXISTS auth_sessions;
