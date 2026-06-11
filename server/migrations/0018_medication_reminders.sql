-- 0018 — medication_reminders: pre-generated reminder rows (Phase 5).
--
-- Replaces the compute-live-on-cron approach. The hourly generator pre-creates
-- rows for the next 14 days (schedule times are LOCAL; converted to UTC at
-- generation using the patient's notification_preferences.timezone). The
-- per-minute dispatcher claims due rows with FOR UPDATE SKIP LOCKED.
--
-- Lifecycle:
--   pending → sent → (taken | skipped)        normal flow
--   pending → missed                          stale sweep (>6h old, never sent)
--   pending → cancelled                       schedule edited/deleted; regeneration re-inserts
--   pending|sent → snoozed                    snooze spawns a CHILD row (parent_reminder_id)
--
-- Idempotent generation: at most one GENERATED row per (schedule, UTC instant).
-- The partial unique index excludes snooze children (parent_reminder_id IS NOT
-- NULL) and cancelled rows — so cancel-then-regenerate after a schedule edit
-- re-inserts cleanly at the same instant.
--
-- Rows are never hard-deleted (taken/skipped history is adherence data — a
-- medical record). FKs are RESTRICT; terminal statuses are the soft end-state.

-- Up Migration

CREATE TABLE medication_reminders (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_schedule_id  uuid NOT NULL REFERENCES medication_schedules(id) ON DELETE RESTRICT,
    patient_id              uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    scheduled_at_utc        timestamptz NOT NULL,
    scheduled_local         varchar(5),                 -- 'HH:MM' as the patient sees it (audit/debug)
    timezone                varchar(40),                -- tz used for the local→UTC conversion
    status                  varchar(20) NOT NULL DEFAULT 'pending',
    parent_reminder_id      uuid REFERENCES medication_reminders(id) ON DELETE SET NULL,
    sent_at                 timestamptz,
    acknowledged_at         timestamptz,
    attempts                integer NOT NULL DEFAULT 0,
    last_error              text,
    region_id               varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mrem_status_chk CHECK (
        status IN ('pending', 'sent', 'taken', 'skipped', 'missed', 'cancelled', 'snoozed')
    ),
    CONSTRAINT mrem_attempts_nonneg CHECK (attempts >= 0)
);

-- Idempotent generation key. ON CONFLICT (medication_schedule_id, scheduled_at_utc)
-- WHERE parent_reminder_id IS NULL AND status <> 'cancelled' DO NOTHING.
CREATE UNIQUE INDEX medication_reminders_generated_uidx
    ON medication_reminders (medication_schedule_id, scheduled_at_utc)
    WHERE parent_reminder_id IS NULL AND status <> 'cancelled';

-- Dispatcher hot path: due pending rows in time order.
CREATE INDEX medication_reminders_dispatch_idx
    ON medication_reminders (scheduled_at_utc)
    WHERE status = 'pending';

-- Patient-facing list ("my reminders this week") + adherence queries.
CREATE INDEX medication_reminders_patient_idx
    ON medication_reminders (patient_id, scheduled_at_utc DESC);

CREATE TRIGGER medication_reminders_set_updated_at
    BEFORE UPDATE ON medication_reminders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE medication_reminders IS
    'Pre-generated reminder rows (14-day horizon, hourly generator). Dispatched per-minute via FOR UPDATE SKIP LOCKED. Never hard-deleted: taken/skipped history is adherence data.';
COMMENT ON COLUMN medication_reminders.scheduled_at_utc IS
    'UTC instant computed at generation from the schedule''s LOCAL HH:MM and the patient''s timezone.';
COMMENT ON COLUMN medication_reminders.parent_reminder_id IS
    'Set on snooze children. Generated rows have it NULL — the partial unique index only governs generated rows.';

-- Down Migration

DROP TABLE IF EXISTS medication_reminders;
