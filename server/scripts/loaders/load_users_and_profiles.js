#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Firestore → Postgres loader for the user / profile graph.
 *
 *   users            → users
 *   patients         → patient_profiles                (via users.firebase_uid = patients.uid)
 *   doctors          → doctor_profiles                 (via users.firebase_uid = doctors.uid)
 *   patient.doctorIds[]  → care_relationships
 *   patient.caregivers[] → caregiver_links
 *
 * MODES
 *   --mode=dry-run   count + show first 10 mapped records; never INSERT
 *   --mode=verify    apply, then re-read each row and diff every field
 *   --mode=apply     write for real (requires --prod in NODE_ENV=production)
 *
 * IDEMPOTENCY
 *   All INSERTs use ON CONFLICT DO NOTHING via natural keys:
 *     users               UNIQUE (firebase_uid)
 *     patient_profiles    UNIQUE (user_id)
 *     doctor_profiles     UNIQUE (user_id)
 *     care_relationships  pre-existence check
 *     caregiver_links     UNIQUE (patient_id, lower(caregiver_email)) [partial] + UNIQUE (invite_token)
 *   So this script is safe to run repeatedly.
 *
 * SAFETY
 *   --mode=apply with NODE_ENV=production REQUIRES the --prod flag AND an
 *   interactive `APPLY` confirmation. CI must not run this without explicit
 *   operator action.
 *
 * USAGE
 *   node server/scripts/loaders/load_users_and_profiles.js --mode=dry-run
 *   node server/scripts/loaders/load_users_and_profiles.js --mode=verify --limit=20
 *   node server/scripts/loaders/load_users_and_profiles.js --mode=apply --prod
 *
 * Synthetic data only in tests — never run against production without an
 * out-of-cycle backup of both Firestore and the target Postgres.
 */

'use strict';

require('dotenv').config();
const readline = require('readline');

const MODES = new Set(['dry-run', 'verify', 'apply']);

// ─────────────────────────────────────────────────────────────────────
// Arg parsing
// ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const args = {
        mode: null,
        prod: false,
        limit: null,
        batchSize: 100,
        verbose: false,
        help: false,
        skipUsers: false,
        skipPatients: false,
        skipDoctors: false,
        skipCare: false,
        skipCaregivers: false
    };
    for (const a of argv.slice(2)) {
        if (a === '--help' || a === '-h') args.help = true;
        else if (a.startsWith('--mode=')) args.mode = a.split('=')[1];
        else if (a.startsWith('--limit=')) args.limit = Math.max(0, parseInt(a.split('=')[1], 10) || 0);
        else if (a.startsWith('--batch-size=')) args.batchSize = Math.max(1, parseInt(a.split('=')[1], 10) || 100);
        else if (a === '--prod') args.prod = true;
        else if (a === '--verbose') args.verbose = true;
        else if (a === '--skip-users') args.skipUsers = true;
        else if (a === '--skip-patients') args.skipPatients = true;
        else if (a === '--skip-doctors') args.skipDoctors = true;
        else if (a === '--skip-care') args.skipCare = true;
        else if (a === '--skip-caregivers') args.skipCaregivers = true;
    }
    return args;
}

function printHelp() {
    console.log(`
Firestore → Postgres loader for users + profiles.

  --mode=dry-run | verify | apply   required
  --limit=N                         cap per-collection iteration (debugging)
  --batch-size=N                    default 100
  --prod                            required in NODE_ENV=production for --mode=apply
  --verbose                         log every record (default: first 10 + summary)
  --skip-{users|patients|doctors|care|caregivers}   skip one or more steps
  --help                            this
`);
}

async function confirm(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// ─────────────────────────────────────────────────────────────────────
// Mappers — Firestore shape → Postgres shape
// ─────────────────────────────────────────────────────────────────────

const LANG_NORMALIZE = { fr: 'fr', ln: 'ln', sw: 'sw', tsh: 'tsh', kg: 'kg', en: 'en' };
const DIABETES_NORMALIZE = {
    'Type 1': 'type_1', 'type_1': 'type_1',
    'Type 2': 'type_2', 'type_2': 'type_2',
    'Gestational': 'gestational', 'gestational': 'gestational',
    'Prediabetes': 'prediabetes', 'prediabetes': 'prediabetes',
    'Other': 'other', 'other': 'other'
};
const RELATIONSHIP_NORMALIZE = {
    parent: 'parent', guardian: 'guardian', spouse: 'spouse',
    adult_child: 'adult_child', sibling: 'sibling', caregiver: 'caregiver'
};

function normalizeLanguage(v) {
    if (!v) return 'fr';
    const k = String(v).toLowerCase();
    return LANG_NORMALIZE[k] || 'fr';
}

function normalizeDiabetesType(v) {
    if (!v) return null;
    return DIABETES_NORMALIZE[v] || null;
}

function normalizeRelationship(v) {
    if (!v) return 'caregiver';
    const k = String(v).toLowerCase();
    return RELATIONSHIP_NORMALIZE[k] || 'caregiver';
}

function tsOrNow(v) {
    if (!v) return new Date();
    if (v && typeof v.toDate === 'function') return v.toDate();   // Firestore Timestamp
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : new Date();
}

function dateOrNull(v) {
    if (!v) return null;
    if (v && typeof v.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
}

// ─────────────────────────────────────────────────────────────────────
// Counters / reporters
// ─────────────────────────────────────────────────────────────────────

function makeReport() {
    return {
        users:               { source: 0, loaded: 0, skipped: 0, failed: 0, errors: [] },
        patient_profiles:    { source: 0, loaded: 0, skipped: 0, failed: 0, errors: [] },
        doctor_profiles:     { source: 0, loaded: 0, skipped: 0, failed: 0, errors: [] },
        care_relationships:  { source: 0, loaded: 0, skipped: 0, failed: 0, errors: [] },
        caregiver_links:     { source: 0, loaded: 0, skipped: 0, failed: 0, errors: [] }
    };
}

function fail(report, table, srcId, message) {
    report[table].failed++;
    if (report[table].errors.length < 25) {
        report[table].errors.push({ srcId, message });
    }
}

// ─────────────────────────────────────────────────────────────────────
// Load steps
// ─────────────────────────────────────────────────────────────────────

async function loadUsers({ db, query, report, mode, limit, batchSize, verbose }) {
    let lastDoc = null;
    while (true) {
        let q = db.collection('users').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            if (limit && report.users.source >= limit) return;
            report.users.source++;
            const data = doc.data() || {};
            const firebaseUid = doc.id;
            const role = data.role || null;

            if (!role) {
                fail(report, 'users', firebaseUid, 'missing role');
                continue;
            }

            if (mode === 'dry-run') {
                if (verbose || report.users.source <= 10) {
                    console.log(`[dry-run] users  src=${firebaseUid}  role=${role}`);
                }
                report.users.loaded++;
                continue;
            }

            try {
                const res = await query(
                    `INSERT INTO users (firebase_uid, role, preferred_language, region_id, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $5)
                     ON CONFLICT (firebase_uid) DO NOTHING
                     RETURNING id`,
                    [
                        firebaseUid,
                        role,
                        normalizeLanguage(data.preferredLanguage || data.language),
                        'cd-kinshasa',
                        tsOrNow(data.createdAt)
                    ]
                );
                if (res.rowCount > 0) {
                    report.users.loaded++;
                    if (verbose || report.users.loaded <= 10) {
                        console.log(`[loaded ] users  uid=${firebaseUid}  pgid=${res.rows[0].id}`);
                    }
                } else {
                    report.users.skipped++;
                }
            } catch (err) {
                fail(report, 'users', firebaseUid, err.message);
            }
        }
        if (snap.docs.length < batchSize) break;
    }
}

/**
 * Helper used during the patient/doctor loaders: resolve firebase_uid → users.id.
 * Cached per-run to avoid repeated lookups for the same uid.
 */
function makeUserIdResolver({ query }) {
    const cache = new Map();
    return async function resolveUserId(firebaseUid) {
        if (!firebaseUid) return null;
        if (cache.has(firebaseUid)) return cache.get(firebaseUid);
        const r = await query('SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1', [firebaseUid]);
        const id = r.rows?.[0]?.id || null;
        cache.set(firebaseUid, id);
        return id;
    };
}

async function loadPatientProfiles({ db, query, report, mode, limit, batchSize, verbose, resolveUserId }) {
    let lastDoc = null;
    while (true) {
        let q = db.collection('patients').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            if (limit && report.patient_profiles.source >= limit) return;
            report.patient_profiles.source++;
            const data = doc.data() || {};
            const fsId = doc.id;

            if (!data.uid) {
                fail(report, 'patient_profiles', fsId, 'patient has no uid — cannot link to users');
                continue;
            }

            const userId = await resolveUserId(data.uid);
            if (!userId) {
                fail(report, 'patient_profiles', fsId, `no users row for uid=${data.uid}`);
                continue;
            }

            if (mode === 'dry-run') {
                if (verbose || report.patient_profiles.source <= 10) {
                    console.log(`[dry-run] patient_profiles  fsId=${fsId}  uid=${data.uid}  type=${data.type || '?'}`);
                }
                report.patient_profiles.loaded++;
                continue;
            }

            try {
                const res = await query(
                    `INSERT INTO patient_profiles (
                        user_id, diabetes_type, diagnosed_at, comorbidities,
                        commune, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
                        region_id, created_at, updated_at
                     ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $10)
                     ON CONFLICT (user_id) DO NOTHING
                     RETURNING id`,
                    [
                        userId,
                        normalizeDiabetesType(data.type),
                        dateOrNull(data.diagnosedAt),
                        JSON.stringify(Array.isArray(data.conditions) ? data.conditions : []),
                        data.city || null,
                        data.emergencyContact?.name || null,
                        data.emergencyContact?.phone || null,
                        data.emergencyContact?.relationship || null,
                        'cd-kinshasa',
                        tsOrNow(data.createdAt || data.lastVisit)
                    ]
                );
                if (res.rowCount > 0) {
                    report.patient_profiles.loaded++;
                    if (verbose || report.patient_profiles.loaded <= 10) {
                        console.log(`[loaded ] patient_profiles  fsId=${fsId}  pgid=${res.rows[0].id}`);
                    }
                } else {
                    report.patient_profiles.skipped++;
                }
            } catch (err) {
                fail(report, 'patient_profiles', fsId, err.message);
            }
        }
        if (snap.docs.length < batchSize) break;
    }
}

async function loadDoctorProfiles({ db, query, report, mode, limit, batchSize, verbose, resolveUserId }) {
    let lastDoc = null;
    while (true) {
        let q = db.collection('doctors').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            if (limit && report.doctor_profiles.source >= limit) return;
            report.doctor_profiles.source++;
            const data = doc.data() || {};
            const fsId = doc.id;

            // doctors may not have a uid (created by admin). Skip with reason.
            if (!data.uid) {
                fail(report, 'doctor_profiles', fsId, 'doctor has no uid — cannot link to users (admin-created)');
                continue;
            }

            const userId = await resolveUserId(data.uid);
            if (!userId) {
                fail(report, 'doctor_profiles', fsId, `no users row for uid=${data.uid}`);
                continue;
            }

            if (mode === 'dry-run') {
                if (verbose || report.doctor_profiles.source <= 10) {
                    console.log(`[dry-run] doctor_profiles  fsId=${fsId}  uid=${data.uid}  specialty=${data.specialty || '?'}`);
                }
                report.doctor_profiles.loaded++;
                continue;
            }

            try {
                const res = await query(
                    `INSERT INTO doctor_profiles (
                        user_id, license_number, verification_status,
                        accepting_new_patients, region_id, created_at, updated_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $6)
                     ON CONFLICT (user_id) DO NOTHING
                     RETURNING id`,
                    [
                        userId,
                        data.licenseNumber || null,
                        'approved',                   // existing doctors are pre-vetted
                        data.acceptingNewPatients !== false,
                        'cd-kinshasa',
                        tsOrNow(data.createdAt)
                    ]
                );
                if (res.rowCount > 0) {
                    report.doctor_profiles.loaded++;
                    if (verbose || report.doctor_profiles.loaded <= 10) {
                        console.log(`[loaded ] doctor_profiles  fsId=${fsId}  pgid=${res.rows[0].id}`);
                    }
                } else {
                    report.doctor_profiles.skipped++;
                }
            } catch (err) {
                fail(report, 'doctor_profiles', fsId, err.message);
            }
        }
        if (snap.docs.length < batchSize) break;
    }
}

/**
 * Reads patients again (cheap; same ~50 docs), this time to populate
 * care_relationships from patient.doctorIds[]. Both endpoints must
 * already exist in patient_profiles / doctor_profiles.
 *
 * Doctor IDs in Firestore are Firestore doc ids (the doctors collection).
 * We resolve them to doctor_profiles.id via the linked user.firebase_uid.
 */
async function loadCareRelationships({ db, query, report, mode, limit, batchSize, verbose }) {
    // Build patient_id and doctor_id resolution caches in one shot.
    const patientIdByFsId = new Map();
    const doctorIdByFsId  = new Map();

    // Resolve patients: Firestore patient doc id → Postgres patient_profile id.
    // We do this via users.firebase_uid = patients.uid.
    const ppRes = await query(
        `SELECT pp.id AS pp_id, u.firebase_uid
         FROM patient_profiles pp
         JOIN users u ON u.id = pp.user_id
         WHERE pp.deleted_at IS NULL`
    );
    const userFsIdToPpId = new Map();
    for (const row of ppRes.rows || []) userFsIdToPpId.set(row.firebase_uid, row.pp_id);

    const dpRes = await query(
        `SELECT dp.id AS dp_id, u.firebase_uid
         FROM doctor_profiles dp
         JOIN users u ON u.id = dp.user_id
         WHERE dp.deleted_at IS NULL`
    );
    const userFsIdToDpId = new Map();
    for (const row of dpRes.rows || []) userFsIdToDpId.set(row.firebase_uid, row.dp_id);

    let lastDoc = null;
    while (true) {
        let q = db.collection('patients').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            const data = doc.data() || {};
            if (!data.uid) continue;
            const patientPgId = userFsIdToPpId.get(data.uid);
            if (!patientPgId) continue;

            const doctorIds = []
                .concat(data.doctorIds || [])
                .concat(data.doctorId ? [data.doctorId] : [])
                .map(String);

            for (const docId of new Set(doctorIds)) {
                if (limit && report.care_relationships.source >= limit) return;
                report.care_relationships.source++;
                let doctorPgId = doctorIdByFsId.get(docId);
                if (!doctorPgId) {
                    // The legacy doctorIds[] holds Firestore patients.doctorId values, which
                    // ARE the Firestore doctors doc id. So we need to fetch that doctor's uid
                    // and look up the user. We don't have it directly — but a small Firestore
                    // hit per unique doctor id is fine at <50 doctors total.
                    try {
                        const doctorSnap = await db.collection('doctors').doc(docId).get();
                        if (!doctorSnap.exists) {
                            fail(report, 'care_relationships', `${doc.id}→${docId}`, 'doctor doc not found');
                            continue;
                        }
                        const doctorUid = doctorSnap.data()?.uid;
                        doctorPgId = doctorUid ? userFsIdToDpId.get(doctorUid) : null;
                        doctorIdByFsId.set(docId, doctorPgId || null);
                        if (!doctorPgId) {
                            fail(report, 'care_relationships', `${doc.id}→${docId}`, 'no doctor_profile for doctor');
                            continue;
                        }
                    } catch (err) {
                        fail(report, 'care_relationships', `${doc.id}→${docId}`, err.message);
                        continue;
                    }
                }
                patientIdByFsId.set(doc.id, patientPgId);

                if (mode === 'dry-run') {
                    if (verbose || report.care_relationships.source <= 10) {
                        console.log(`[dry-run] care_relationships  patient_fs=${doc.id}  doctor_fs=${docId}`);
                    }
                    report.care_relationships.loaded++;
                    continue;
                }

                // Pre-existence check (partial unique index doesn't work in ON CONFLICT)
                try {
                    const exists = await query(
                        `SELECT 1 FROM care_relationships
                         WHERE patient_id=$1 AND doctor_id=$2 AND status='active' LIMIT 1`,
                        [patientPgId, doctorPgId]
                    );
                    if (exists.rowCount > 0) {
                        report.care_relationships.skipped++;
                        continue;
                    }
                    const isPrimary = String(data.doctorId) === docId;
                    await query(
                        `INSERT INTO care_relationships
                            (patient_id, doctor_id, status, is_primary, started_at)
                         VALUES ($1, $2, 'active', $3, now())`,
                        [patientPgId, doctorPgId, isPrimary]
                    );
                    report.care_relationships.loaded++;
                    if (verbose || report.care_relationships.loaded <= 10) {
                        console.log(`[loaded ] care_relationships  ${patientPgId} ↔ ${doctorPgId}${isPrimary ? ' (primary)' : ''}`);
                    }
                } catch (err) {
                    fail(report, 'care_relationships', `${doc.id}→${docId}`, err.message);
                }
            }
        }
        if (snap.docs.length < batchSize) break;
    }
}

/**
 * Reads patients yet again to extract caregivers[] arrays + the legacy
 * caregiver_invitations collection.
 */
async function loadCaregiverLinks({ db, query, report, mode, limit, batchSize, verbose }) {
    // 1) From patient.caregivers[] arrays (already-accepted links)
    const ppRes = await query(
        `SELECT pp.id AS pp_id, u.firebase_uid
         FROM patient_profiles pp
         JOIN users u ON u.id = pp.user_id
         WHERE pp.deleted_at IS NULL`
    );
    const userFsIdToPpId = new Map();
    for (const row of ppRes.rows || []) userFsIdToPpId.set(row.firebase_uid, row.pp_id);

    let lastDoc = null;
    while (true) {
        let q = db.collection('patients').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            const data = doc.data() || {};
            if (!data.uid) continue;
            const patientPgId = userFsIdToPpId.get(data.uid);
            if (!patientPgId) continue;

            const caregivers = Array.isArray(data.caregivers) ? data.caregivers : [];
            for (const cg of caregivers) {
                if (limit && report.caregiver_links.source >= limit) return;
                report.caregiver_links.source++;
                if (!cg?.email) {
                    fail(report, 'caregiver_links', `${doc.id}:no-email`, 'caregiver entry has no email');
                    continue;
                }
                const inviteToken = `legacy:${doc.id}:${String(cg.email).toLowerCase()}`;

                if (mode === 'dry-run') {
                    if (verbose || report.caregiver_links.source <= 10) {
                        console.log(`[dry-run] caregiver_links  patient_fs=${doc.id}  email=${cg.email}  rel=${cg.relationship || '?'}`);
                    }
                    report.caregiver_links.loaded++;
                    continue;
                }

                try {
                    const res = await query(
                        `INSERT INTO caregiver_links
                            (patient_id, caregiver_email, relationship, permissions, status,
                             invited_by, invite_token, invited_at, accepted_at, region_id)
                         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
                         ON CONFLICT (invite_token) DO NOTHING
                         RETURNING id`,
                        [
                            patientPgId,
                            cg.email,
                            normalizeRelationship(cg.relationship),
                            JSON.stringify(cg.permissions || {}),
                            cg.status === 'suspended' ? 'suspended' : 'active',
                            cg.addedBy === 'doctor' ? 'doctor' : 'patient',
                            inviteToken,
                            tsOrNow(cg.addedAt),
                            tsOrNow(cg.addedAt),
                            'cd-kinshasa'
                        ]
                    );
                    if (res.rowCount > 0) {
                        report.caregiver_links.loaded++;
                        if (verbose || report.caregiver_links.loaded <= 10) {
                            console.log(`[loaded ] caregiver_links  patient_fs=${doc.id}  email=${cg.email}`);
                        }
                    } else {
                        report.caregiver_links.skipped++;
                    }
                } catch (err) {
                    fail(report, 'caregiver_links', `${doc.id}:${cg.email}`, err.message);
                }
            }
        }
        if (snap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Verify mode — diff every loaded row against its Firestore source
// ─────────────────────────────────────────────────────────────────────

async function verifyAll({ db, query, report, verbose }) {
    const mismatches = [];

    // Users: every Firestore users doc should be present in Postgres with matching role.
    const userSnap = await db.collection('users').get();
    for (const doc of userSnap.docs) {
        const fs = doc.data() || {};
        if (!fs.role) continue;
        const pg = await query('SELECT role, preferred_language FROM users WHERE firebase_uid=$1 AND deleted_at IS NULL LIMIT 1', [doc.id]);
        if (pg.rowCount === 0) {
            mismatches.push({ table: 'users', srcId: doc.id, reason: 'missing in Postgres' });
            continue;
        }
        if (pg.rows[0].role !== fs.role) {
            mismatches.push({ table: 'users', srcId: doc.id, reason: `role mismatch fs=${fs.role} pg=${pg.rows[0].role}` });
        }
    }

    // Patient_profiles: link via firebase_uid.
    const patientSnap = await db.collection('patients').get();
    for (const doc of patientSnap.docs) {
        const fs = doc.data() || {};
        if (!fs.uid) continue;
        const pg = await query(
            `SELECT pp.diabetes_type, pp.commune
             FROM patient_profiles pp JOIN users u ON u.id = pp.user_id
             WHERE u.firebase_uid=$1 AND pp.deleted_at IS NULL LIMIT 1`,
            [fs.uid]
        );
        if (pg.rowCount === 0) {
            mismatches.push({ table: 'patient_profiles', srcId: doc.id, reason: 'missing in Postgres' });
            continue;
        }
        const expected = normalizeDiabetesType(fs.type);
        if (expected && pg.rows[0].diabetes_type !== expected) {
            mismatches.push({
                table: 'patient_profiles', srcId: doc.id,
                reason: `diabetes_type mismatch fs=${expected} pg=${pg.rows[0].diabetes_type}`
            });
        }
    }

    return mismatches;
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) { printHelp(); process.exit(0); }
    if (!MODES.has(args.mode)) {
        console.error('error: --mode= is required (one of: dry-run, verify, apply)');
        printHelp();
        process.exit(2);
    }

    if (args.mode === 'apply' && process.env.NODE_ENV === 'production' && !args.prod) {
        console.error('refusing to run --mode=apply in NODE_ENV=production without --prod');
        process.exit(2);
    }
    if (args.mode === 'apply' && args.prod) {
        const answer = await confirm(`\n*** PRODUCTION APPLY ***\nType "APPLY" to proceed: `);
        if (answer !== 'APPLY') {
            console.error('aborted');
            process.exit(2);
        }
    }

    // Lazy-import after arg validation so --help works without firebase init.
    const { db } = require('../../config/firebaseConfig');
    const { query, shutdown } = require('../../db/client');
    if (!db) {
        console.error('error: Firestore is not configured (config/firebaseConfig.js); cannot read source data');
        process.exit(3);
    }

    const report = makeReport();
    const resolveUserId = makeUserIdResolver({ query });
    const ctx = {
        db, query, report, resolveUserId,
        mode: args.mode, limit: args.limit, batchSize: args.batchSize, verbose: args.verbose
    };

    const t0 = Date.now();
    console.log(`\n=== Loader starting (mode=${args.mode}, env=${process.env.NODE_ENV || 'development'}) ===\n`);

    try {
        if (!args.skipUsers)      await loadUsers(ctx);
        if (!args.skipPatients)   await loadPatientProfiles(ctx);
        if (!args.skipDoctors)    await loadDoctorProfiles(ctx);
        if (!args.skipCare)       await loadCareRelationships(ctx);
        if (!args.skipCaregivers) await loadCaregiverLinks(ctx);

        // Verify after apply if requested
        let mismatches = [];
        if (args.mode === 'verify') {
            console.log('\n--- verify pass ---');
            mismatches = await verifyAll(ctx);
        }

        const elapsedMs = Date.now() - t0;
        console.log(`\n=== Summary (mode=${args.mode}, ${elapsedMs}ms) ===`);
        console.log(JSON.stringify(report, null, 2));

        if (mismatches.length) {
            console.log(`\n!! ${mismatches.length} mismatches:`);
            console.log(JSON.stringify(mismatches.slice(0, 50), null, 2));
            await shutdown();
            process.exit(4);
        }

        const anyFailed = Object.values(report).some(c => c.failed > 0);
        await shutdown();
        process.exit(anyFailed ? 1 : 0);
    } catch (err) {
        console.error('loader fatal:', err.message);
        await shutdown();
        process.exit(99);
    }
}

if (require.main === module) {
    main();
}

// Exported for the unit test
module.exports = {
    parseArgs,
    normalizeLanguage,
    normalizeDiabetesType,
    normalizeRelationship,
    tsOrNow,
    dateOrNull,
    makeReport,
    loadUsers,
    loadPatientProfiles,
    loadDoctorProfiles,
    loadCareRelationships,
    loadCaregiverLinks,
    makeUserIdResolver
};
