-- 0001 — Extensions and shared helper functions.
--
-- This migration is intentionally tiny so that subsequent migrations can rely
-- on gen_random_uuid() and the set_updated_at() trigger function being
-- available. Both are idempotent.
--
-- Note: extensions are NOT dropped on `down` — they may be in use by other
-- schemas. Helper functions are dropped.

-- Up Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS btree_gist;      -- needed for EXCLUDE constraints later

-- Shared trigger: stamps updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
    'Trigger function: stamps updated_at = now() on every row UPDATE. Attached to every business table.';

-- Down Migration

DROP FUNCTION IF EXISTS public.set_updated_at();
-- Extensions intentionally left in place; dropping them can affect other tenants.
