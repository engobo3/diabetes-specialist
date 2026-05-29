-- 0014 — medication_schedules.
--
-- The patient-facing recurring medication plan. `times` are stored as LOCAL
-- HH:MM strings (per the brief: store local, convert to UTC at reminder
-- generation using the patient's timezone from notification_preferences).
--
-- prescription_item_id is nullable: legacy schedules in Firestore aren't
-- linked to a prescription, and may never be. The reminder generator (Phase 5)
-- reads from this table, not from prescriptions.

-- Up Migration

CREATE TABLE medication_schedules (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id              uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    prescription_item_id    uuid REFERENCES prescription_items(id) ON DELETE SET NULL,
    medication              varchar(256) NOT NULL,
    dosage                  varchar(128),
    times                   jsonb NOT NULL DEFAULT '[]'::jsonb,
    frequency               varchar(20) NOT NULL DEFAULT 'daily',
    start_date              date NOT NULL,
    end_date                date,
    active                  boolean NOT NULL DEFAULT true,
    created_by              uuid REFERENCES doctor_profiles(id) ON DELETE SET NULL,
    client_uuid             uuid,
    region_id               varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    deleted_at              timestamptz,
    CONSTRAINT ms_freq_chk CHECK (
        frequency IN ('daily', 'twice_daily', 'three_times', 'weekly', 'custom')
    ),
    CONSTRAINT ms_times_is_array CHECK (jsonb_typeof(times) = 'array'),
    CONSTRAINT ms_date_order_chk CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX medication_schedules_patient_active_idx
    ON medication_schedules (patient_id)
    WHERE active = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX medication_schedules_client_uuid_uidx
    ON medication_schedules (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER medication_schedules_set_updated_at
    BEFORE UPDATE ON medication_schedules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN medication_schedules.times IS
    'Array of LOCAL HH:MM strings, e.g. ["08:00","20:00"]. Converted to UTC at reminder generation using the patient timezone (notification_preferences.timezone).';

-- Down Migration

DROP TABLE IF EXISTS medication_schedules;
