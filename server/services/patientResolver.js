/**
 * patientResolver — map a legacy Firestore patient id to its Postgres
 * patient_profiles UUID.
 *
 * The existing controllers operate on Firestore patient ids (from URL params
 * or req.user.patientId). Dual-writing to Postgres needs the patient_profiles
 * UUID, which is reached via: Firestore patient doc → uid → users.firebase_uid
 * → patient_profiles.id.
 *
 * Resolution is cached (successful hits only — never cache a null, so a
 * patient that gets migrated later resolves on the next attempt). All failures
 * degrade to null; this is a best-effort helper for dual-write and must never
 * throw into the request path.
 */

const { query } = require('../db/client');
const { logError } = require('../utils/safeLogger');

// Successful resolutions only. Firestore patient id (string) → profile UUID.
const _cache = new Map();
const CACHE_MAX = 10000;

let _db = null;
function getDb() {
    if (_db !== null) return _db;
    try {
        _db = require('../config/firebaseConfig').db || false;
    } catch (err) {
        _db = false;
    }
    return _db;
}

/**
 * @param {string|number} firestorePatientId
 * @returns {Promise<string|null>} patient_profiles.id (uuid) or null
 */
async function toProfileId(firestorePatientId) {
    if (firestorePatientId == null) return null;
    const key = String(firestorePatientId);
    if (_cache.has(key)) return _cache.get(key);

    try {
        // 1. Firestore patient doc → uid
        const db = getDb();
        if (!db) return null;
        const doc = await db.collection('patients').doc(key).get();
        if (!doc.exists) return null;
        const uid = doc.data()?.uid;
        if (!uid) return null;

        // 2. uid → patient_profiles.id via Postgres
        const r = await query(
            `SELECT pp.id
             FROM patient_profiles pp
             JOIN users u ON u.id = pp.user_id
             WHERE u.firebase_uid = $1 AND pp.deleted_at IS NULL
             LIMIT 1`,
            [uid]
        );
        if (r._skipped || r.rowCount === 0) return null;

        const profileId = r.rows[0].id;
        if (_cache.size >= CACHE_MAX) _cache.clear(); // crude bound
        _cache.set(key, profileId);
        return profileId;
    } catch (err) {
        logError('patientResolver.toProfileId failed', err, { firestorePatientId: key });
        return null;
    }
}

function _clearCache() {
    _cache.clear();
}

module.exports = { toProfileId, _clearCache };
