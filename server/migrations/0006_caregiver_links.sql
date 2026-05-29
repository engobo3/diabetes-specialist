-- 0006 — caregiver_links: patient ↔ caregiver email-based relationships.
--
-- Replaces the patients.caregivers[] embedded array + the
-- caregiver_invitations Firestore collection. A "link" goes through these
-- states: pending → active → (suspended | revoked).
--
-- caregiver_user_id is nullable: caregivers are invited by email, but they
-- only get a users row once they sign up. The loader populates the email and
-- leaves caregiver_user_id NULL; later, when the caregiver authenticates,
-- userService will backfill the link.
--
-- Idempotency for the loader:
--   - UNIQUE (patient_id, lower(caregiver_email)) WHERE status IN ('pending','active')
--     prevents duplicate active invitations.
--   - UNIQUE (invite_token) — re-running the loader with the same Firestore
--     invitation token short-circuits via ON CONFLICT DO NOTHING.

-- Up Migration

CREATE TABLE caregiver_links (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id              uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    caregiver_email         text NOT NULL,
    caregiver_user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
    relationship            varchar(20) NOT NULL,
    permissions             jsonb NOT NULL DEFAULT '{}'::jsonb,
    status                  varchar(20) NOT NULL DEFAULT 'pending',
    invited_by              varchar(20) NOT NULL,
    invited_by_user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
    doctor_approved_by      uuid REFERENCES doctor_profiles(id) ON DELETE SET NULL,
    doctor_approved_at      timestamptz,
    invite_token            varchar(128) NOT NULL,
    invited_at              timestamptz NOT NULL DEFAULT now(),
    accepted_at             timestamptz,
    suspended_at            timestamptz,
    revoked_at              timestamptz,
    expires_at              timestamptz,
    notes                   text,
    region_id               varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    client_uuid             uuid,
    deleted_at              timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cl_relationship_chk CHECK (
        relationship IN ('parent','guardian','spouse','adult_child','sibling','caregiver')
    ),
    CONSTRAINT cl_status_chk CHECK (
        status IN ('pending','active','suspended','revoked')
    ),
    CONSTRAINT cl_invited_by_chk CHECK (
        invited_by IN ('patient','doctor')
    ),
    CONSTRAINT cl_permissions_is_object CHECK (jsonb_typeof(permissions) = 'object')
);

-- One active or pending link per (patient, caregiver_email) at a time.
-- lower() so 'Foo@bar.com' and 'foo@BAR.com' don't both get to be pending.
CREATE UNIQUE INDEX caregiver_links_active_pending_uidx
    ON caregiver_links (patient_id, lower(caregiver_email))
    WHERE status IN ('pending','active') AND deleted_at IS NULL;

CREATE UNIQUE INDEX caregiver_links_invite_token_uidx
    ON caregiver_links (invite_token);

CREATE UNIQUE INDEX caregiver_links_client_uuid_uidx
    ON caregiver_links (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

-- Hot path: "what patients does this caregiver have access to?"
CREATE INDEX caregiver_links_caregiver_email_active_idx
    ON caregiver_links (lower(caregiver_email))
    WHERE status = 'active' AND deleted_at IS NULL;

-- Hot path: "show me all caregivers for this patient"
CREATE INDEX caregiver_links_patient_status_idx
    ON caregiver_links (patient_id, status)
    WHERE deleted_at IS NULL;

CREATE TRIGGER caregiver_links_set_updated_at
    BEFORE UPDATE ON caregiver_links
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE caregiver_links IS
    'Patient ↔ caregiver email-based access. Replaces patients.caregivers[] embedded array + caregiver_invitations collection in Firestore. State machine: pending → active → (suspended | revoked).';
COMMENT ON COLUMN caregiver_links.caregiver_user_id IS
    'Nullable: caregivers are invited by email; this is backfilled when the caregiver signs up (userService.linkCaregiverByEmail in a later phase).';
COMMENT ON COLUMN caregiver_links.invite_token IS
    'Opaque token bridging the Firestore caregiver_invitations.inviteToken value. Used by the loader for idempotency and by the accept-invitation flow.';

-- Down Migration

DROP TABLE IF EXISTS caregiver_links;
