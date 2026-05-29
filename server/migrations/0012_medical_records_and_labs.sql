-- 0012 — medical_records + lab_results.
--
-- The legacy Firestore `medical_records` collection has a `type` enum:
-- diagnosis | lab_result | procedure | clinical_note | referral. The loader
-- routes type='lab_result' into the dedicated lab_results table (which has
-- structured_values for things like {"hba1c": 7.2}); the other four types
-- land in medical_records.

-- Up Migration

CREATE TABLE medical_records (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id       uuid REFERENCES doctor_profiles(id) ON DELETE SET NULL,
    record_type     varchar(20) NOT NULL,
    title           varchar(256) NOT NULL,
    content         text NOT NULL,
    recorded_at     date NOT NULL DEFAULT current_date,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    client_uuid     uuid,
    region_id       varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT mr_type_chk CHECK (
        record_type IN ('diagnosis', 'procedure', 'clinical_note', 'referral')
    )
);

CREATE INDEX medical_records_patient_idx
    ON medical_records (patient_id, recorded_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX medical_records_client_uuid_uidx
    ON medical_records (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER medical_records_set_updated_at
    BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE lab_results (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id           uuid REFERENCES doctor_profiles(id) ON DELETE SET NULL,
    test_name           varchar(128) NOT NULL,
    test_date           date,
    file_url            text,
    structured_values   jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes               text,
    client_uuid         uuid,
    region_id           varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);

CREATE INDEX lab_results_patient_idx
    ON lab_results (patient_id, test_date DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX lab_results_client_uuid_uidx
    ON lab_results (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER lab_results_set_updated_at
    BEFORE UPDATE ON lab_results
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN lab_results.structured_values IS
    'Parsed lab values, e.g. {"hba1c": 7.2, "fasting_glucose": 130}. Queryable via JSONB operators.';

-- Down Migration

DROP TABLE IF EXISTS lab_results;
DROP TABLE IF EXISTS medical_records;
