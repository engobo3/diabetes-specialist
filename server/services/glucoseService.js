/**
 * glucoseService — Postgres glucose_readings access for the cutover.
 *
 * CUTOVER STAGE (expand): this turn wires the DUAL-WRITE rail only. Live
 * glucose vitals written through database.addVital are additionally inserted
 * into Postgres glucose_readings (best-effort). Reads still come from
 * Firestore — `listByPatient` exists and is correct, but no controller is
 * pointed at it yet. Switching reads to PG-first happens AFTER the loader has
 * backfilled real RDS data and `--verify` is green (a separate, approved step).
 *
 * Everything here no-ops gracefully when:
 *   - DATABASE_URL_PG is unset / pg uninstalled (query → _skipped)
 *   - the patient hasn't been migrated to Postgres yet (resolver → null)
 *
 * Never throws into the request path.
 */

const { query } = require('../db/client');
const { logError } = require('../utils/safeLogger');
const { deterministicUuid } = require('../utils/deterministicUuid');
const patientResolver = require('./patientResolver');

const GLUCOSE_CONTEXTS = ['fasting', 'pre_meal', 'post_meal', 'bedtime', 'random', 'unknown'];

function normalizeContext(v) {
    if (!v) return 'unknown';
    const k = String(v).toLowerCase().replace(/[\s-]+/g, '_');
    return GLUCOSE_CONTEXTS.includes(k) ? k : 'unknown';
}

/** Is this vital a glucose reading? (type Glucose, or untyped legacy = glucose) */
function isGlucoseVital(vital) {
    if (!vital) return false;
    const t = vital.type || vital.category;
    return !t || t === 'Glucose' || t === 'glucose';
}

/** Extract an integer mg/dL from a vital that may carry `glucose` (number) or `value` (string). */
function extractMgDl(vital) {
    if (typeof vital.glucose === 'number' && Number.isFinite(vital.glucose)) {
        return Math.round(vital.glucose);
    }
    if (vital.value != null) {
        const n = parseFloat(String(vital.value));
        if (Number.isFinite(n)) return Math.round(n);
    }
    return null;
}

/**
 * Best-effort dual-write of a glucose reading to Postgres.
 *
 * @param {string|number} firestorePatientId  the patient id used by the legacy API
 * @param {object} vital  the vital just saved to Firestore (its id, if present, makes the write idempotent)
 * @returns {Promise<string|null>} inserted glucose_readings.id, or null if skipped
 */
async function dualWriteFromVital(firestorePatientId, vital, savedVitalId = null) {
    try {
        if (!isGlucoseVital(vital)) return null;

        const mg = extractMgDl(vital);
        if (mg == null) return null;
        if (mg < 0 || mg > 2000) return null; // matches the table's sanity bound

        const profileId = await patientResolver.toProfileId(firestorePatientId);
        if (!profileId) return null; // patient not migrated yet

        // Idempotency key: prefer the client-supplied one; otherwise derive the
        // SAME deterministic UUID the loader would use for this Firestore vital,
        // so a later loader run dedupes against this live write.
        const vitalId = savedVitalId || vital.id || null;
        const clientUuid = vital.client_uuid
            || vital.clientUuid
            || (vitalId ? deterministicUuid('glucose_readings', String(firestorePatientId), String(vitalId)) : null);

        const measuredAt = vital.date ? new Date(vital.date) : new Date();
        const measuredAtValid = Number.isFinite(measuredAt.getTime()) ? measuredAt : new Date();

        const res = await query(
            `INSERT INTO glucose_readings
                (patient_id, value_mg_dl, measured_at, recorded_at, context, source, notes, client_uuid)
             VALUES ($1, $2, $3, now(), $4, $5, $6, $7)
             ON CONFLICT (client_uuid) DO NOTHING
             RETURNING id`,
            [
                profileId,
                mg,
                measuredAtValid,
                normalizeContext(vital.subtype || vital.context),
                'manual',
                vital.notes || null,
                clientUuid
            ]
        );
        if (res._skipped) return null;
        return res.rows?.[0]?.id || null;
    } catch (err) {
        logError('glucoseService.dualWriteFromVital failed', err, {
            firestorePatientId: String(firestorePatientId)
        });
        return null;
    }
}

/**
 * Read glucose readings for a patient, Postgres-first.
 * Returns { source, readings }. source==='postgres' when PG served the data;
 * source==='none' means the caller should fall back to Firestore.
 *
 * Not yet wired to any controller — reads cut over after backfill is verified.
 */
async function listByPatient(firestorePatientId, { limit = 200 } = {}) {
    try {
        const profileId = await patientResolver.toProfileId(firestorePatientId);
        if (!profileId) return { source: 'none', readings: [] };

        const res = await query(
            `SELECT id, value_mg_dl, measured_at, recorded_at, context, source, notes
             FROM glucose_readings
             WHERE patient_id = $1 AND deleted_at IS NULL
             ORDER BY measured_at DESC
             LIMIT $2`,
            [profileId, limit]
        );
        if (res._skipped) return { source: 'none', readings: [] };
        return { source: 'postgres', readings: res.rows };
    } catch (err) {
        logError('glucoseService.listByPatient failed', err, {
            firestorePatientId: String(firestorePatientId)
        });
        return { source: 'none', readings: [] };
    }
}

module.exports = {
    dualWriteFromVital,
    listByPatient,
    isGlucoseVital,
    extractMgDl,
    normalizeContext
};
