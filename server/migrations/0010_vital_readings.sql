-- 0010 — vital_readings: non-glucose vitals (BP, weight, heart rate, etc.).
--
-- Glucose lives in its own table (0009) because it's the high-volume
-- diabetes time-series and a TimescaleDB hypertable candidate. Everything
-- else lands here.
--
-- value_numeric is numeric(8,2) — these are physical measurements, NOT money,
-- so the "integer minor units" rule does not apply. Blood pressure is the
-- exception: it carries systolic + diastolic instead of a single value.

-- Up Migration

CREATE TABLE vital_readings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    vital_type      varchar(20) NOT NULL,
    value_numeric   numeric(8,2),
    systolic        integer,
    diastolic       integer,
    unit            varchar(16),
    measured_at     timestamptz NOT NULL,
    recorded_at     timestamptz NOT NULL DEFAULT now(),
    source          varchar(20) NOT NULL DEFAULT 'manual',
    notes           text,
    client_uuid     uuid,
    region_id       varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT vr_type_chk CHECK (
        vital_type IN ('blood_pressure', 'weight', 'heart_rate', 'temperature', 'other')
    ),
    CONSTRAINT vr_source_chk CHECK (source IN ('manual', 'device')),
    -- BP must carry systolic + diastolic; everything else must carry value_numeric.
    CONSTRAINT vr_shape_chk CHECK (
        (vital_type = 'blood_pressure' AND systolic IS NOT NULL AND diastolic IS NOT NULL)
        OR (vital_type <> 'blood_pressure' AND value_numeric IS NOT NULL)
    ),
    CONSTRAINT vr_bp_range_chk CHECK (
        vital_type <> 'blood_pressure'
        OR (systolic BETWEEN 40 AND 300 AND diastolic BETWEEN 20 AND 200)
    )
);

CREATE INDEX vital_readings_patient_type_measured_idx
    ON vital_readings (patient_id, vital_type, measured_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX vital_readings_client_uuid_uidx
    ON vital_readings (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE vital_readings IS
    'Non-glucose vitals. Append-only by convention (corrections insert new rows). Blood pressure carries systolic/diastolic; all others carry value_numeric.';

-- Down Migration

DROP TABLE IF EXISTS vital_readings;
