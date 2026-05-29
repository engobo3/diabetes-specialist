-- 0013 — appointments.
--
-- The legacy Firestore status enum is mixed-case and inconsistent
-- ('Pending' AND 'pending', 'Completed' AND 'completed', plus 'Scheduled',
-- 'No Show'). The loader normalizes all of them to the lowercase snake set
-- below; unknown values are reported as failures, never silently coerced.
--
-- A partial unique index prevents double-booking the same doctor's slot for
-- pending/confirmed appointments — the existing Firestore code does this with
-- an appointment_slots lock document; in Postgres the constraint does it.

-- Up Migration

CREATE TABLE appointments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id           uuid REFERENCES doctor_profiles(id) ON DELETE SET NULL,
    scheduled_date      date NOT NULL,
    scheduled_time      time,
    status              varchar(20) NOT NULL DEFAULT 'pending',
    reason              text,
    appointment_type    varchar(32),
    notes               text,
    client_uuid         uuid,
    region_id           varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz,
    CONSTRAINT appt_status_chk CHECK (
        status IN ('pending', 'confirmed', 'rejected', 'completed', 'cancelled', 'no_show')
    )
);

CREATE INDEX appointments_patient_idx
    ON appointments (patient_id, scheduled_date DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX appointments_doctor_date_idx
    ON appointments (doctor_id, scheduled_date)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX appointments_client_uuid_uidx
    ON appointments (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

-- No two live (pending/confirmed) appointments for the same doctor+date+time.
CREATE UNIQUE INDEX appointments_doctor_slot_uidx
    ON appointments (doctor_id, scheduled_date, scheduled_time)
    WHERE status IN ('pending', 'confirmed')
      AND scheduled_time IS NOT NULL
      AND deleted_at IS NULL;

CREATE TRIGGER appointments_set_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN appointments.status IS
    'Normalized: pending|confirmed|rejected|completed|cancelled|no_show. Loader maps legacy mixed-case (Pending, Scheduled, No Show) into this set.';

-- Down Migration

DROP TABLE IF EXISTS appointments;
