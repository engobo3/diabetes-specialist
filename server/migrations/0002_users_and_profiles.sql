-- 0002 — Core identity tables: users + patient_profiles + doctor_profiles.
--
-- Identity model:
--   - Firebase Auth remains the identity provider (verifyIdToken keeps working).
--   - users.firebase_uid is the bridge between a Firebase UID and our UUID PK.
--   - Each user has at most one patient_profile OR doctor_profile (per the
--     UNIQUE (user_id) constraint on each).
--   - Caregivers and admins live in `users` only; they don't get a profile row.
--
-- Money columns: integer minor units + currency in the column name. Never floats.
--
-- Phase 1 is empty/additive — no rows written until later phases.

-- Up Migration

-- ── users ─────────────────────────────────────────────────────────────
CREATE TABLE users (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid          varchar(128) NOT NULL UNIQUE,
    role                  varchar(20) NOT NULL,
    preferred_language    varchar(8)  NOT NULL DEFAULT 'fr',
    region_id             varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz,
    CONSTRAINT users_role_chk
        CHECK (role IN ('patient', 'doctor', 'caregiver', 'admin', 'receptionist')),
    CONSTRAINT users_lang_chk
        CHECK (preferred_language IN ('fr', 'ln', 'sw', 'tsh', 'kg', 'en'))
);

-- firebase_uid lookups are the hot path (every request).
CREATE INDEX users_firebase_uid_active_idx
    ON users (firebase_uid)
    WHERE deleted_at IS NULL;

CREATE INDEX users_role_active_idx
    ON users (role)
    WHERE deleted_at IS NULL;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE users IS
    'Identity + role mapping. Firebase Auth remains the identity provider; this table joins firebase_uid to our UUID PK and role.';
COMMENT ON COLUMN users.deleted_at IS
    'Soft delete. All app queries MUST filter `WHERE deleted_at IS NULL`. Never hard-delete.';

-- ── patient_profiles ──────────────────────────────────────────────────
CREATE TABLE patient_profiles (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    diabetes_type               varchar(20),
    diagnosed_at                date,
    comorbidities               jsonb NOT NULL DEFAULT '[]'::jsonb,
    commune                     varchar(64),
    emergency_contact_name      text,             -- plaintext for now; encrypted in a later phase
    emergency_contact_phone     text,             -- plaintext for now; encrypted in a later phase
    emergency_contact_relation  varchar(64),
    region_id                   varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    client_uuid                 uuid,             -- offline-sync idempotency key
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    deleted_at                  timestamptz,
    CONSTRAINT pp_user_unique UNIQUE (user_id),
    CONSTRAINT pp_dtype_chk CHECK (
        diabetes_type IS NULL OR diabetes_type IN
            ('type_1', 'type_2', 'gestational', 'prediabetes', 'other')
    ),
    CONSTRAINT pp_comorbidities_is_array CHECK (jsonb_typeof(comorbidities) = 'array')
);

-- client_uuid: partial unique index — only enforced when set AND not soft-deleted.
CREATE UNIQUE INDEX patient_profiles_client_uuid_uidx
    ON patient_profiles (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX patient_profiles_user_active_idx
    ON patient_profiles (user_id)
    WHERE deleted_at IS NULL;

CREATE TRIGGER patient_profiles_set_updated_at
    BEFORE UPDATE ON patient_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN patient_profiles.client_uuid IS
    'Offline-sync idempotency key — assigned by the client when the row is created offline. Partial unique index allows reused UUIDs after soft-delete.';
COMMENT ON COLUMN patient_profiles.emergency_contact_phone IS
    'TODO: encrypt via pgcrypto + KMS in a later phase. Plaintext for Phase 1.';

-- ── doctor_profiles ───────────────────────────────────────────────────
CREATE TABLE doctor_profiles (
    id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    license_number                  text,
    verification_status             varchar(20) NOT NULL DEFAULT 'pending',
    consultation_fee_cdf_minor      bigint,           -- e.g. 5_000_000 = 50,000 CDF
    consultation_fee_usd_minor      bigint,           -- e.g. 5000     = $50.00 USD
    accepting_new_patients          boolean NOT NULL DEFAULT true,
    region_id                       varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    client_uuid                     uuid,
    created_at                      timestamptz NOT NULL DEFAULT now(),
    updated_at                      timestamptz NOT NULL DEFAULT now(),
    deleted_at                      timestamptz,
    CONSTRAINT dp_user_unique UNIQUE (user_id),
    CONSTRAINT dp_vstatus_chk CHECK (
        verification_status IN ('pending', 'submitted', 'approved', 'rejected', 'revoked')
    ),
    CONSTRAINT dp_fee_cdf_nonneg
        CHECK (consultation_fee_cdf_minor IS NULL OR consultation_fee_cdf_minor >= 0),
    CONSTRAINT dp_fee_usd_nonneg
        CHECK (consultation_fee_usd_minor IS NULL OR consultation_fee_usd_minor >= 0)
);

CREATE UNIQUE INDEX doctor_profiles_client_uuid_uidx
    ON doctor_profiles (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX doctor_profiles_verification_idx
    ON doctor_profiles (verification_status)
    WHERE deleted_at IS NULL;

CREATE INDEX doctor_profiles_accepting_idx
    ON doctor_profiles (accepting_new_patients)
    WHERE accepting_new_patients = true AND deleted_at IS NULL;

CREATE TRIGGER doctor_profiles_set_updated_at
    BEFORE UPDATE ON doctor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN doctor_profiles.consultation_fee_cdf_minor IS
    'Fee in CDF minor units (centimes). Integer only — never float. 50,000 CDF == 5000000.';
COMMENT ON COLUMN doctor_profiles.consultation_fee_usd_minor IS
    'Fee in USD minor units (cents). Integer only — never float. $50.00 == 5000.';
COMMENT ON COLUMN doctor_profiles.verification_status IS
    'State machine: pending → submitted → (approved | rejected | revoked). Audited in doctor_verification_events (added in later phase).';

-- Down Migration

DROP TABLE IF EXISTS doctor_profiles;
DROP TABLE IF EXISTS patient_profiles;
DROP TABLE IF EXISTS users;
