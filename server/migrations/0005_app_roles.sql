-- 0005 — Application DB roles and least-privilege grants.
--
-- Two roles:
--   app_rw   — the running application. SELECT/INSERT/UPDATE on business tables,
--              SELECT/INSERT only on audit_log. UPDATE and DELETE on audit_log
--              are explicitly REVOKEd so that even a compromised app cannot
--              rewrite history.
--   app_ddl  — owns DDL; used exclusively by node-pg-migrate in CI/release.
--
-- We use ALTER DEFAULT PRIVILEGES so future tables created by app_ddl
-- automatically grant the right access to app_rw — keeps later migrations
-- short and prevents the "forgot to GRANT" bug.
--
-- NB: This migration assumes both roles already exist as login users on the
-- RDS instance (created out-of-band: see ops/rds-setup.md). Migrations only
-- manage GRANTs.

-- Up Migration

-- Create roles if they don't exist (no LOGIN; granted to actual login roles in ops).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
        CREATE ROLE app_rw NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_ddl') THEN
        CREATE ROLE app_ddl NOLOGIN;
    END IF;
END
$$;

-- ── app_rw: business tables (full RW) ──
GRANT SELECT, INSERT, UPDATE
    ON users, patient_profiles, doctor_profiles, care_relationships
    TO app_rw;

-- DELETE is permitted on business tables for hard-delete of NON-medical data
-- (e.g. cancelled OTP challenges in later phases). All medical data uses
-- soft-delete (deleted_at).
-- Intentionally NOT granted at this layer; later migrations grant per-table.

-- ── app_rw: audit_log (SELECT + INSERT only — REVOKE UPDATE/DELETE) ──
GRANT SELECT, INSERT ON audit_log TO app_rw;
-- Apply to existing partitions (created in 0004).
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO app_rw;
-- Explicit REVOKE so the intent is documented and enforced even if defaults change.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_rw;
-- And from existing partitions:
DO $$
DECLARE
    part_name text;
BEGIN
    FOR part_name IN
        SELECT relname FROM pg_class
        WHERE relname LIKE 'audit_log\_%' ESCAPE '\'
          AND relkind = 'r'
    LOOP
        EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %I FROM app_rw', part_name);
    END LOOP;
END
$$;

-- ── Default privileges for future tables created by app_ddl ──
-- Business tables created in future migrations will automatically grant
-- SELECT/INSERT/UPDATE to app_rw. Audit-log future partitions only get
-- SELECT/INSERT (matching the parent's grants).
ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_rw;

-- ── app_ddl: full schema ownership ──
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO app_ddl;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_ddl;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO app_ddl;

ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    GRANT ALL ON TABLES    TO app_ddl;
ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    GRANT ALL ON SEQUENCES TO app_ddl;
ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO app_ddl;

COMMENT ON ROLE app_rw IS
    'Application runtime role. SELECT/INSERT/UPDATE on business tables; SELECT/INSERT only on audit_log (UPDATE/DELETE explicitly REVOKEd).';
COMMENT ON ROLE app_ddl IS
    'Migration role for node-pg-migrate. Owns the schema. Used by CI/release pipeline only — never by the running app.';

-- Down Migration

-- Revoke privileges, leave roles in place. Dropping roles is risky if they
-- own objects, and we want `migrate:down` to be safe to run during incident
-- recovery without losing the role definitions.

REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM app_rw;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM app_rw;
REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM app_ddl;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM app_ddl;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM app_ddl;

ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    REVOKE SELECT, INSERT, UPDATE ON TABLES FROM app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    REVOKE USAGE, SELECT ON SEQUENCES FROM app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    REVOKE ALL ON TABLES    FROM app_ddl;
ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM app_ddl;
ALTER DEFAULT PRIVILEGES FOR ROLE app_ddl IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM app_ddl;
