/**
 * Medication-schedule dual-write (Phase 5 expand).
 *
 * Live schedule create/update/delete still goes to Firestore (source of
 * truth). This service additionally mirrors the change into Postgres
 * medication_schedules — same expand pattern as glucoseService — so the
 * reminder generator (which reads Postgres) covers live edits, not just
 * loader-backfilled data.
 *
 * Idempotency: client_uuid = deterministicUuid('medication_schedules', <fs id>)
 * — identical to what load_clinical_content.js derives, so the loader and
 * live dual-writes upsert the same row.
 *
 * On every upsert: future pending reminders for the schedule are cancelled and
 * regenerated (the brief: "prescription edits cancel future pending reminders
 * and regenerate"). On delete: soft-delete + cancel.
 *
 * Best-effort: no-ops without RDS or for unmigrated patients; never throws.
 */

const { query } = require('../db/client');
const { logError } = require('../utils/safeLogger');
const { deterministicUuid } = require('../utils/deterministicUuid');
const patientResolver = require('./patientResolver');
const reminderService = require('./reminderService');

const FREQUENCIES = ['daily', 'twice_daily', 'three_times', 'weekly', 'custom'];

function normalizeFrequency(v) {
    if (!v) return 'daily';
    return FREQUENCIES.includes(v) ? v : 'custom';
}

/**
 * Mirror a Firestore schedule create/update into Postgres, then refresh its
 * reminders. Returns the Postgres schedule id or null if skipped.
 *
 * @param {string} firestoreScheduleId  the Firestore doc id
 * @param {object} data  the schedule as saved to Firestore (post-merge for updates)
 */
async function upsertFromFirestore(firestoreScheduleId, data) {
    try {
        if (!firestoreScheduleId || !data || !data.patientId || !data.medication) return null;
        if (!Array.isArray(data.times) || !data.startDate) return null;

        const profileId = await patientResolver.toProfileId(data.patientId);
        if (!profileId) return null;   // patient not migrated yet

        const clientUuid = deterministicUuid('medication_schedules', String(firestoreScheduleId));
        const r = await query(
            `INSERT INTO medication_schedules
                (patient_id, medication, dosage, times, frequency,
                 start_date, end_date, active, client_uuid)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
             ON CONFLICT (client_uuid)
                WHERE client_uuid IS NOT NULL AND deleted_at IS NULL
                DO UPDATE SET
                    medication = EXCLUDED.medication,
                    dosage     = EXCLUDED.dosage,
                    times      = EXCLUDED.times,
                    frequency  = EXCLUDED.frequency,
                    start_date = EXCLUDED.start_date,
                    end_date   = EXCLUDED.end_date,
                    active     = EXCLUDED.active
             RETURNING id`,
            [
                profileId,
                data.medication,
                data.dosage || null,
                JSON.stringify(data.times),
                normalizeFrequency(data.frequency),
                data.startDate,
                data.endDate || null,
                data.active !== false,
                clientUuid
            ]
        );
        if (r._skipped || r.rowCount === 0) return null;
        const pgScheduleId = r.rows[0].id;

        // Refresh reminders: cancel future pending, regenerate for current times.
        await reminderService.cancelForSchedule(pgScheduleId);
        if (data.active !== false) {
            await reminderService.generateForSchedule(pgScheduleId);
        }
        return pgScheduleId;
    } catch (err) {
        logError('medicationScheduleSync.upsertFromFirestore failed', err, {
            firestoreScheduleId: String(firestoreScheduleId)
        });
        return null;
    }
}

/**
 * Mirror a Firestore schedule deactivation/delete: soft-delete the Postgres
 * row and cancel its future pending reminders.
 */
async function removeByFirestoreId(firestoreScheduleId) {
    try {
        if (!firestoreScheduleId) return null;
        const clientUuid = deterministicUuid('medication_schedules', String(firestoreScheduleId));
        const r = await query(
            `UPDATE medication_schedules
             SET active = false, deleted_at = now()
             WHERE client_uuid = $1 AND deleted_at IS NULL
             RETURNING id`,
            [clientUuid]
        );
        if (r._skipped || r.rowCount === 0) return null;
        const pgScheduleId = r.rows[0].id;
        await reminderService.cancelForSchedule(pgScheduleId);
        return pgScheduleId;
    } catch (err) {
        logError('medicationScheduleSync.removeByFirestoreId failed', err, {
            firestoreScheduleId: String(firestoreScheduleId)
        });
        return null;
    }
}

module.exports = { upsertFromFirestore, removeByFirestoreId, normalizeFrequency };
