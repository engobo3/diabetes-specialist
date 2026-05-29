# Firestore → Postgres Loaders

One-time scripts that copy data from the live Firestore project into the Postgres schema introduced in Phase 1+ migrations. Loaders are **idempotent** (safe to re-run) and **never** delete from Firestore.

## Order

Run in this order — `load_clinical_content` depends on the profiles created by
`load_users_and_profiles` (it resolves patient/doctor foreign keys through them).

| # | Script | Reads | Writes |
|---|---|---|---|
| 1 | `load_users_and_profiles.js` | `users`, `patients`, `doctors`, `patient.doctorIds[]`, `patient.caregivers[]` | `users`, `patient_profiles`, `doctor_profiles`, `care_relationships`, `caregiver_links` |
| 2 | `load_clinical_content.js` | `patients/{id}/vitals`, `prescriptions`, `medical_records`, `appointments`, `medication_schedules`, `doctor_events`, `notification_preferences`, `patients/{id}/documents` | `glucose_readings`, `vital_readings`, `prescriptions`+`prescription_items`, `medical_records`, `lab_results`, `appointments`, `medication_schedules`, `doctor_events`, `notification_preferences`, `patient_documents` |

**Not migrated by these loaders** (deferred to their subsystem phases): `messages`
(Phase 6 chat), `payment_transactions` (Phase 7), `medication_reminders` (Phase 5,
generated), `notifications` (transient).

### load_clinical_content idempotency

Clinical rows have no natural business key, so the loader assigns a **deterministic
`client_uuid`** = `uuidv5(MIGRATION_NS, "<table>:<firestore-doc-id>")`. Re-running
produces the same UUID → `ON CONFLICT (client_uuid) DO NOTHING`. (Exception:
`notification_preferences` dedupes on `patient_id`.)

### load_clinical_content transforms

| Source | Routing / transform |
|---|---|
| `vitals.type = Glucose` (or missing) | → `glucose_readings`; parses `glucose` number or `value` string; non-numeric → `failed` |
| `vitals.type = Blood Pressure` | → `vital_readings`; parses `"120/80"` or `{systolic,diastolic}`; missing → `failed` |
| `vitals.type` = Weight/Heart Rate/… | → `vital_readings.value_numeric` |
| `medical_records.type = lab_result` | → `lab_results` (with `structured_values` from metadata) |
| `appointments.status` | normalized: `Pending/Scheduled/No Show/...` → `pending/confirmed/no_show/...`; unknown → `failed` |

## Modes

Every loader supports three modes:

```bash
# Count + show first 10 records; never INSERTs.
node server/scripts/loaders/load_users_and_profiles.js --mode=dry-run

# Apply, then re-read each Postgres row and diff fields against Firestore.
# Exit code 4 on any mismatch.
node server/scripts/loaders/load_users_and_profiles.js --mode=verify

# Write for real. In production, requires --prod + interactive APPLY prompt.
node server/scripts/loaders/load_users_and_profiles.js --mode=apply --prod
```

## Safety rules

- **Never** run `--mode=apply` against production without an out-of-cycle backup.
- `NODE_ENV=production` + `--mode=apply` requires the **`--prod`** flag **and** an interactive
  confirmation typing "APPLY". CI must not bypass this.
- Loader is **idempotent** via natural-key ON CONFLICT DO NOTHING. Re-running cannot create
  duplicates or update existing Postgres rows. To force re-load a record, delete its
  Postgres row first (and only do so when the row has never been read).
- Each step is independently skippable: `--skip-users`, `--skip-patients`,
  `--skip-doctors`, `--skip-care`, `--skip-caregivers`.

## Environment

Both env vars must be set in the shell:

```bash
export DATABASE_URL_PG=postgres://app_rw:****@.../glucosoin?sslmode=require
# Firebase Admin SDK creds (one of these):
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'        # production
# OR a serviceAccountKey.json file at server/config/serviceAccountKey.json   # development
```

## Recommended sequence

```bash
# 1. Sanity: empty/staging Postgres, scratch Firestore project
node ... --mode=dry-run --verbose             # eyeball the counts

# 2. Apply against staging
node ... --mode=apply --limit=5               # tiny smoke test first
node ... --mode=apply                         # full

# 3. Verify against staging
node ... --mode=verify                        # exits 4 on any field mismatch

# 4. Production (only after staging is green for >24h)
node ... --mode=apply --prod
node ... --mode=verify
```

## Idempotency contract

| Table | Natural key | Behavior on conflict |
|---|---|---|
| `users` | `firebase_uid` UNIQUE | skip (preserves any drift on `role` / `preferred_language` — re-loading does NOT overwrite) |
| `patient_profiles` | `user_id` UNIQUE | skip |
| `doctor_profiles` | `user_id` UNIQUE | skip |
| `care_relationships` | active link on (`patient_id`, `doctor_id`) | pre-existence check; skip if active link exists |
| `caregiver_links` | `invite_token` UNIQUE | skip; token format is `legacy:{patient_doc_id}:{lowercase_email}` for migrated rows |

If you need to OVERWRITE existing Postgres rows during the loader run (e.g. after a
schema-shape change), do it via a separate cleanup script that deletes the conflicting
rows first — do not modify the loader to UPDATE on conflict.

## What this loader does NOT do

- Does not migrate patient/doctor **content** collections (vitals, prescriptions,
  appointments, messages, payments) — those are Phase 3 work.
- Does not delete any Firestore data.
- Does not flip the application read path. The `authMiddleware` will start hitting
  Postgres-first only after `userService` is wired (already done in this commit).
  Firestore stays the fallback until Phase 3 cutover.
