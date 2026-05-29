-- 0003 — care_relationships: explicit patient ↔ doctor link.
--
-- Replaces the implicit `patients.doctorIds[]` array in Firestore with a
-- proper many-to-many table. `is_primary` is a forward-looking flag for the
-- future care-team feature; at most one primary doctor per patient is enforced
-- with a partial unique index.
--
-- Lifecycle: a relationship can be 'paused' (e.g. patient pauses care) or
-- 'terminated' (doctor no longer treats this patient). Terminated rows are
-- retained for audit; new relationships create new rows rather than mutating.

-- Up Migration

CREATE TABLE care_relationships (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id   uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id    uuid NOT NULL REFERENCES doctor_profiles(id)  ON DELETE RESTRICT,
    status       varchar(20) NOT NULL DEFAULT 'active',
    is_primary   boolean NOT NULL DEFAULT false,
    started_at   timestamptz NOT NULL DEFAULT now(),
    ended_at     timestamptz,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cr_status_chk
        CHECK (status IN ('active', 'paused', 'terminated')),
    CONSTRAINT cr_ended_implies_terminated
        CHECK (
            (ended_at IS NULL AND status IN ('active', 'paused'))
            OR
            (ended_at IS NOT NULL AND status = 'terminated')
        )
);

-- Exactly one ACTIVE link per (patient, doctor) pair.
-- Allows re-establishing care after a 'terminated' link without resurrecting it.
CREATE UNIQUE INDEX care_relationships_active_uidx
    ON care_relationships (patient_id, doctor_id)
    WHERE status = 'active';

-- At most one PRIMARY doctor per patient at any time.
CREATE UNIQUE INDEX care_relationships_primary_uidx
    ON care_relationships (patient_id)
    WHERE is_primary = true AND status = 'active';

-- Hot-path indexes for authorization checks:
--   "Can doctor X see patient Y?"  → care_relationships WHERE doctor_id=X AND patient_id=Y AND status='active'
CREATE INDEX care_relationships_patient_active_idx
    ON care_relationships (patient_id)
    WHERE status = 'active';

CREATE INDEX care_relationships_doctor_active_idx
    ON care_relationships (doctor_id)
    WHERE status = 'active';

CREATE TRIGGER care_relationships_set_updated_at
    BEFORE UPDATE ON care_relationships
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE care_relationships IS
    'Explicit patient ↔ doctor links. Replaces the patient.doctorIds[] array. Used by the authorization layer ("can doctor X see patient Y?"). Terminated rows are retained for audit.';

-- Down Migration

DROP TABLE IF EXISTS care_relationships;
