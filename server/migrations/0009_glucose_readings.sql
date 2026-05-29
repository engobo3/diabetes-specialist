-- 0009 — glucose_readings: append-only glucose time-series.
--
-- The core diabetes metric. Append-only: corrections insert a new row, never
-- UPDATE (hence no updated_at column). Soft-delete still allowed for
-- mistaken-entry removal (medical-data retention rule).
--
-- TimescaleDB-ready: to convert later, recreate the PK as (id, measured_at)
-- and run create_hypertable('glucose_readings', 'measured_at'). Indexes are
-- already keyed on (patient_id, measured_at) which is the expected access
-- pattern.
--
-- measured_at vs recorded_at are deliberately separate (offline sync: a device
-- can record a reading hours before it syncs to the server).

-- Up Migration

CREATE TABLE glucose_readings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    value_mg_dl     integer NOT NULL,
    measured_at     timestamptz NOT NULL,
    recorded_at     timestamptz NOT NULL DEFAULT now(),
    context         varchar(20) NOT NULL DEFAULT 'unknown',
    source          varchar(20) NOT NULL DEFAULT 'manual',
    notes           text,
    client_uuid     uuid,
    region_id       varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT gr_context_chk CHECK (
        context IN ('fasting', 'pre_meal', 'post_meal', 'bedtime', 'random', 'unknown')
    ),
    CONSTRAINT gr_source_chk CHECK (source IN ('manual', 'glucometer', 'cgm')),
    -- Sanity bound: meters read up to ~600 ("HI"); 2000 is a generous ceiling
    -- that still rejects obviously-corrupt values (negatives, 5-digit typos).
    CONSTRAINT gr_value_range_chk CHECK (value_mg_dl >= 0 AND value_mg_dl <= 2000)
);

CREATE INDEX glucose_readings_patient_measured_idx
    ON glucose_readings (patient_id, measured_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX glucose_readings_client_uuid_uidx
    ON glucose_readings (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE glucose_readings IS
    'Append-only glucose time-series (mg/dL). No updated_at — corrections insert a new row. TimescaleDB-ready: convert by recreating PK as (id, measured_at) + create_hypertable on measured_at.';
COMMENT ON COLUMN glucose_readings.measured_at IS
    'When the reading was physically taken (device/patient clock).';
COMMENT ON COLUMN glucose_readings.recorded_at IS
    'When the reading reached the server (server clock). Separate from measured_at for offline sync.';

-- Down Migration

DROP TABLE IF EXISTS glucose_readings;
