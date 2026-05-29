-- 0011 — prescriptions (header) + prescription_items (lines).
--
-- The legacy Firestore `prescriptions` collection is flat: one medication per
-- document. The loader maps each flat document to one header + one item, so
-- the data is preserved while the schema supports multi-drug prescriptions
-- going forward.
--
-- `schedule` on an item is list-shaped JSONB (dose times etc.) — not queried
-- or joined, so JSONB is appropriate per the schema principles.

-- Up Migration

CREATE TABLE prescriptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id       uuid REFERENCES doctor_profiles(id) ON DELETE SET NULL,
    prescribed_at   date NOT NULL DEFAULT current_date,
    status          varchar(20) NOT NULL DEFAULT 'active',
    notes           text,
    client_uuid     uuid,
    region_id       varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT rx_status_chk CHECK (status IN ('active', 'completed', 'discontinued'))
);

CREATE INDEX prescriptions_patient_idx
    ON prescriptions (patient_id, prescribed_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX prescriptions_client_uuid_uidx
    ON prescriptions (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER prescriptions_set_updated_at
    BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE prescription_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE RESTRICT,
    medication      varchar(256) NOT NULL,
    dosage          varchar(128),
    frequency       varchar(128),
    instructions    text,
    schedule        jsonb NOT NULL DEFAULT '{}'::jsonb,
    start_date      date,
    end_date        date,
    client_uuid     uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX prescription_items_rx_idx
    ON prescription_items (prescription_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX prescription_items_client_uuid_uidx
    ON prescription_items (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER prescription_items_set_updated_at
    BEFORE UPDATE ON prescription_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE prescriptions IS
    'Prescription header. Legacy flat Firestore prescriptions map 1:1 header + item via the loader.';
COMMENT ON COLUMN prescription_items.schedule IS
    'List-shaped dose schedule (JSONB). Not queried/joined — display-only. medication_schedules (0014) holds the queryable reminder times.';

-- Down Migration

DROP TABLE IF EXISTS prescription_items;
DROP TABLE IF EXISTS prescriptions;
