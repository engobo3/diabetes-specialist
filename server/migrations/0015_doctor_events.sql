-- 0015 — doctor_events: calendar blocks (vacation, lunch, meeting, etc.).
--
-- Used by the scheduling layer to know when a doctor is unavailable, so the
-- slot generator can exclude these windows.

-- Up Migration

CREATE TABLE doctor_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id       uuid NOT NULL REFERENCES doctor_profiles(id) ON DELETE RESTRICT,
    title           varchar(256) NOT NULL,
    category        varchar(20) NOT NULL,
    event_date      date NOT NULL,
    start_time      time,
    end_time        time,
    all_day         boolean NOT NULL DEFAULT false,
    notes           text,
    client_uuid     uuid,
    region_id       varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT de_category_chk CHECK (
        category IN ('break', 'lunch', 'meeting', 'admin', 'personal',
                     'vacation', 'conference', 'sick', 'other')
    ),
    CONSTRAINT de_time_shape_chk CHECK (
        all_day = true OR (start_time IS NOT NULL AND end_time IS NOT NULL)
    )
);

CREATE INDEX doctor_events_doctor_date_idx
    ON doctor_events (doctor_id, event_date)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX doctor_events_client_uuid_uidx
    ON doctor_events (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER doctor_events_set_updated_at
    BEFORE UPDATE ON doctor_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS doctor_events;
