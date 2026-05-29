-- 0007 — user_devices: device binding table.
--
-- FORWARD-LOOKING: empty in Phase 2. Populated when the offline-sync work
-- (Phase 4) starts issuing device IDs and storing them in IndexedDB.
-- We create it now so that auth_sessions can reference it without a
-- circular migration in Phase 4.
--
-- device_id is client-generated. For the web PWA it's a UUID stored under
-- localStorage:device_id (rotated on logout-all). For a future Expo app it
-- would come from expo-application + expo-secure-store.

-- Up Migration

CREATE TABLE user_devices (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    device_id       varchar(128) NOT NULL,
    platform        varchar(16) NOT NULL DEFAULT 'web',
    user_agent      text,
    app_version     varchar(32),
    last_seen_at    timestamptz,
    push_token      text,
    region_id       varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    deleted_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ud_platform_chk CHECK (platform IN ('web','ios','android'))
);

-- A given (user, device) pair can only have one ACTIVE row.
CREATE UNIQUE INDEX user_devices_user_device_uidx
    ON user_devices (user_id, device_id)
    WHERE deleted_at IS NULL;

CREATE INDEX user_devices_user_active_idx
    ON user_devices (user_id)
    WHERE deleted_at IS NULL;

-- For the push-token lifecycle worker
CREATE INDEX user_devices_push_token_idx
    ON user_devices (push_token)
    WHERE push_token IS NOT NULL AND deleted_at IS NULL;

-- For session cleanup ("which devices haven't been seen recently?")
CREATE INDEX user_devices_last_seen_idx
    ON user_devices (last_seen_at DESC NULLS LAST)
    WHERE deleted_at IS NULL;

CREATE TRIGGER user_devices_set_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE user_devices IS
    'Device binding table. device_id is client-generated and stored in browser localStorage / secure storage. Phase 2 leaves this empty; Phase 4 (offline sync) starts populating it.';
COMMENT ON COLUMN user_devices.device_id IS
    'Client-generated identifier. NOT a uuid because some platforms generate non-UUID device IDs (ASCII iOS identifierForVendor, Android SSAID, browser-generated nanoid). Treated as opaque.';

-- Down Migration

DROP TABLE IF EXISTS user_devices;
