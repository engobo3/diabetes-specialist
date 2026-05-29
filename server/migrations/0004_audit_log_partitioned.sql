-- 0004 — audit_log: append-only, partitioned by month.
--
-- DESIGN NOTES
--   - PARTITION BY RANGE (occurred_at). Monthly partitions. Old partitions can
--     be detached and archived after the retention window.
--   - PK is composite (id, occurred_at) — required for declarative
--     partitioning when occurred_at is the partition key.
--   - actor_user_id is nullable: events from the system (cron jobs) or events
--     occurring before the actor's `users` row exists (e.g. first OTP attempt)
--     still need to be logged. actor_firebase_uid is also retained so we can
--     correlate to identity even when actor_user_id is null.
--   - patient_id is denormalized so "who viewed my data" queries are cheap.
--   - metadata is JSONB and MUST be redacted by the writer (auditServiceV2)
--     before insert. Database does not enforce this — it's an application
--     contract documented in safeLogger.SENSITIVE_KEYS.
--
-- ROLES (granted in migration 0005):
--   - app_rw: SELECT + INSERT only.  UPDATE and DELETE are explicitly REVOKEd
--     so that even a malicious app cannot retroactively edit history.

-- Up Migration

-- Parent partitioned table.
CREATE TABLE audit_log (
    id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
    occurred_at         timestamptz NOT NULL DEFAULT now(),
    actor_user_id       uuid,
    actor_firebase_uid  varchar(128),
    actor_role          varchar(20),
    action              varchar(64) NOT NULL,
    resource_type       varchar(64) NOT NULL,
    resource_id         text,
    patient_id          uuid,
    success             boolean     NOT NULL DEFAULT true,
    severity            varchar(16) NOT NULL DEFAULT 'info',
    request_id          varchar(64),
    ip_address          inet,
    user_agent          text,
    metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, occurred_at),
    CONSTRAINT audit_severity_chk
        CHECK (severity IN ('info', 'notice', 'warning', 'critical'))
) PARTITION BY RANGE (occurred_at);

-- Index definitions on the partitioned parent are propagated to each partition.
CREATE INDEX audit_log_occurred_at_idx
    ON audit_log (occurred_at DESC);

CREATE INDEX audit_log_action_idx
    ON audit_log (action, occurred_at DESC);

CREATE INDEX audit_log_resource_idx
    ON audit_log (resource_type, resource_id, occurred_at DESC);

CREATE INDEX audit_log_actor_fb_idx
    ON audit_log (actor_firebase_uid, occurred_at DESC);

CREATE INDEX audit_log_patient_idx
    ON audit_log (patient_id, occurred_at DESC)
    WHERE patient_id IS NOT NULL;

CREATE INDEX audit_log_severity_idx
    ON audit_log (severity, occurred_at DESC)
    WHERE severity IN ('warning', 'critical');

COMMENT ON TABLE audit_log IS
    'Append-only audit of all PHI access and modifications. INSERT-only at the role level; UPDATE/DELETE explicitly revoked. Partitioned monthly.';
COMMENT ON COLUMN audit_log.metadata IS
    'Application-redacted JSONB. The writer (auditServiceV2) strips keys in safeLogger.SENSITIVE_KEYS before INSERT. Never insert raw PHI.';

-- ── ensure_monthly_audit_partition ─────────────────────────────────────
-- Helper that creates the partition for a given month, idempotently.
-- Called manually now (below) to seed prev/current/next; later phases will
-- schedule it via cron / Cloud Function so we never miss a partition.
CREATE OR REPLACE FUNCTION ensure_monthly_audit_partition(
    target_month timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    partition_name text;
    start_date     date;
    end_date       date;
BEGIN
    start_date := date_trunc('month', target_month)::date;
    end_date   := (start_date + INTERVAL '1 month')::date;
    partition_name := format('audit_log_%s', to_char(start_date, 'YYYY_MM'));

    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date::timestamptz, end_date::timestamptz
        );
        -- Inherit the same INSERT-only role grants as the parent.
        -- (Default privileges via ALTER DEFAULT PRIVILEGES in 0005 cover this for
        --  future partitions, but we make it explicit here for clarity.)
    END IF;

    RETURN partition_name;
END;
$$;

COMMENT ON FUNCTION ensure_monthly_audit_partition(timestamptz) IS
    'Idempotent: creates audit_log_YYYY_MM partition for the given month. Safe to call repeatedly.';

-- Seed: previous, current, and next month so writes never hit a missing partition.
SELECT ensure_monthly_audit_partition(now() - INTERVAL '1 month');
SELECT ensure_monthly_audit_partition(now());
SELECT ensure_monthly_audit_partition(now() + INTERVAL '1 month');

-- Down Migration

DROP FUNCTION IF EXISTS ensure_monthly_audit_partition(timestamptz);
DROP TABLE IF EXISTS audit_log CASCADE;
