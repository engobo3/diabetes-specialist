/**
 * User Service — single canonical lookup for the authenticated user's
 * identity, role, and profile foreign keys.
 *
 * Phase 2 behavior:
 *   1. Try Postgres (`users` joined to `patient_profiles` / `doctor_profiles`).
 *   2. On a miss (or if Postgres is unconfigured), fall back to the legacy
 *      Firestore `users/{uid}` doc.
 *   3. Return `null` only if neither source has the user.
 *
 * Phase 3 removes the Firestore fallback once we've verified Postgres
 * coverage for every active test user.
 *
 * Return shape — STABLE CONTRACT. Anything that consumes req.user.role |
 * patientId | doctorId today reads this shape, so do not rename without
 * checking authMiddleware callers.
 *
 *   {
 *     source:            'postgres' | 'firestore',
 *     id:                uuid | null,        // null only when source==='firestore' (PG miss)
 *     firebaseUid:       string,
 *     role:              'patient' | 'doctor' | 'caregiver' | 'admin' | 'receptionist' | null,
 *     patientId:         uuid | string | null,   // PG uuid OR legacy Firestore patient id
 *     doctorId:          uuid | string | null,
 *     preferredLanguage: 'fr' | 'ln' | 'sw' | 'tsh' | 'kg' | 'en',
 *     regionId:          string
 *   }
 */

const { query } = require('../db/client');
const { logError } = require('../utils/safeLogger');

// Lazy-load Firestore — auditServiceV2's dual-write pattern. Keeps unit tests
// from booting the firebase-admin SDK unless they explicitly want to.
let _firestoreDb = null;
function getFirestoreDb() {
    if (_firestoreDb !== null) return _firestoreDb;
    try {
        _firestoreDb = require('../config/firebaseConfig').db || false;
    } catch (err) {
        _firestoreDb = false;
    }
    return _firestoreDb;
}

const LOOKUP_SQL = `
    SELECT
        u.id                AS user_id,
        u.firebase_uid      AS firebase_uid,
        u.role              AS role,
        u.preferred_language AS preferred_language,
        u.region_id         AS region_id,
        pp.id               AS patient_profile_id,
        dp.id               AS doctor_profile_id
    FROM users u
    LEFT JOIN patient_profiles pp
        ON pp.user_id = u.id AND pp.deleted_at IS NULL
    LEFT JOIN doctor_profiles dp
        ON dp.user_id = u.id AND dp.deleted_at IS NULL
    WHERE u.firebase_uid = $1 AND u.deleted_at IS NULL
    LIMIT 1
`;

/**
 * Lookup a user by their Firebase Auth UID.
 *
 * @param {string} firebaseUid
 * @returns {Promise<object|null>}
 */
async function lookupUserByFirebaseUid(firebaseUid) {
    if (!firebaseUid || typeof firebaseUid !== 'string') return null;

    // ── 1. Postgres first ─────────────────────────────────────────────
    try {
        const result = await query(LOOKUP_SQL, [firebaseUid]);
        if (!result._skipped && result.rowCount > 0) {
            const r = result.rows[0];
            return {
                source: 'postgres',
                id: r.user_id,
                firebaseUid: r.firebase_uid,
                role: r.role,
                patientId: r.patient_profile_id || null,
                doctorId: r.doctor_profile_id || null,
                preferredLanguage: r.preferred_language || 'fr',
                regionId: r.region_id || 'cd-kinshasa'
            };
        }
    } catch (err) {
        // Don't fail the request on a Postgres glitch — log and fall through.
        logError('userService: Postgres lookup failed; falling back to Firestore', err, {
            firebaseUid_present: Boolean(firebaseUid)
        });
    }

    // ── 2. Firestore fallback (legacy path) ───────────────────────────
    const db = getFirestoreDb();
    if (!db) return null;
    try {
        const doc = await db.collection('users').doc(firebaseUid).get();
        if (!doc.exists) return null;
        const data = doc.data() || {};
        return {
            source: 'firestore',
            id: null,
            firebaseUid,
            role: data.role || null,
            patientId: data.patientId != null ? String(data.patientId) : null,
            doctorId: data.doctorId != null ? String(data.doctorId) : null,
            preferredLanguage: data.preferredLanguage || 'fr',
            regionId: 'cd-kinshasa'
        };
    } catch (err) {
        logError('userService: Firestore fallback lookup failed', err, {
            firebaseUid_present: Boolean(firebaseUid)
        });
        return null;
    }
}

/**
 * Internal — exposed for tests to reset the lazy-loaded Firestore handle.
 */
function _resetFirestoreCache() {
    _firestoreDb = null;
}

module.exports = {
    lookupUserByFirebaseUid,
    _resetFirestoreCache
};
