-- 0016 — notification_preferences (1:1 with patient).
--
-- Adds `timezone` (NOT in the Firestore shape) so Phase 5 reminders can
-- convert LOCAL medication/vital times to UTC per patient instead of the
-- current hardcoded Africa/Kinshasa. Defaults to Africa/Kinshasa so existing
-- behavior is preserved.

-- Up Migration

CREATE TABLE notification_preferences (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                  uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    vital_reminder_enabled      boolean NOT NULL DEFAULT true,
    morning_reminder_time       time NOT NULL DEFAULT '07:00',
    evening_reminder_enabled    boolean NOT NULL DEFAULT false,
    evening_reminder_time       time NOT NULL DEFAULT '19:00',
    medication_reminder_enabled boolean NOT NULL DEFAULT true,
    escalation_enabled          boolean NOT NULL DEFAULT true,
    escalation_days             integer NOT NULL DEFAULT 3,
    timezone                    varchar(40) NOT NULL DEFAULT 'Africa/Kinshasa',
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT np_patient_unique UNIQUE (patient_id),
    CONSTRAINT np_escalation_days_chk CHECK (escalation_days >= 1 AND escalation_days <= 14)
);

CREATE TRIGGER notification_preferences_set_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN notification_preferences.timezone IS
    'IANA timezone for this patient. Phase 5 reminder generation converts local schedule times to UTC using this. Defaults to Africa/Kinshasa (existing behavior).';

-- Down Migration

DROP TABLE IF EXISTS notification_preferences;
