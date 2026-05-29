#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Firestore → Postgres loader for clinical content.
 *
 *   patients/{id}/vitals  → glucose_readings (type=Glucose) | vital_readings (else)
 *   prescriptions         → prescriptions (header) + prescription_items (1 item each)
 *   medical_records       → lab_results (type=lab_result) | medical_records (else)
 *   appointments          → appointments  (status normalized)
 *   medication_schedules  → medication_schedules
 *   doctor_events         → doctor_events
 *   notification_preferences (doc id = patientId) → notification_preferences
 *   patients/{id}/documents → patient_documents
 *
 * MODES   --mode=dry-run | verify | apply   (see README)
 * SAFETY  --mode=apply in production requires --prod + interactive APPLY.
 *
 * IDEMPOTENCY
 *   Each row gets a deterministic client_uuid = uuidv5(namespace, "<table>:<firestore-id>").
 *   Re-running yields the same client_uuid → ON CONFLICT (client_uuid) DO NOTHING.
 *   notification_preferences uses ON CONFLICT (patient_id) instead.
 *
 * Synthetic data only in tests; never run --apply against prod without backups.
 */

'use strict';

require('dotenv').config();
const crypto = require('crypto');
const readline = require('readline');

const MODES = new Set(['dry-run', 'verify', 'apply']);

// Fixed namespace so deterministic UUIDs are stable across runs/machines.
const MIGRATION_NS = '8f2b1c4e-3a5d-4e6f-9b0a-1c2d3e4f5a6b';

// ─────────────────────────────────────────────────────────────────────
// Deterministic UUID (RFC-4122 v5-style: SHA1 of namespace + name)
// ─────────────────────────────────────────────────────────────────────

function deterministicUuid(...parts) {
    const name = parts.map(String).join(':');
    const hash = crypto.createHash('sha1')
        .update(MIGRATION_NS)
        .update(':')
        .update(name)
        .digest('hex');
    // Take first 16 bytes; set version (5) and variant (RFC 4122) bits.
    const bytes = Buffer.from(hash.slice(0, 32), 'hex');
    bytes[6] = (bytes[6] & 0x0f) | 0x50;   // version 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80;   // variant 10xx
    const h = bytes.toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// ─────────────────────────────────────────────────────────────────────
// Arg parsing / prompt
// ─────────────────────────────────────────────────────────────────────

const STEP_FLAGS = ['vitals', 'prescriptions', 'records', 'appointments', 'schedules', 'events', 'prefs', 'documents'];

function parseArgs(argv) {
    const args = { mode: null, prod: false, limit: null, batchSize: 100, verbose: false, help: false, skip: new Set() };
    for (const a of argv.slice(2)) {
        if (a === '--help' || a === '-h') args.help = true;
        else if (a.startsWith('--mode=')) args.mode = a.split('=')[1];
        else if (a.startsWith('--limit=')) args.limit = Math.max(0, parseInt(a.split('=')[1], 10) || 0);
        else if (a.startsWith('--batch-size=')) args.batchSize = Math.max(1, parseInt(a.split('=')[1], 10) || 100);
        else if (a === '--prod') args.prod = true;
        else if (a === '--verbose') args.verbose = true;
        else if (a.startsWith('--skip-')) args.skip.add(a.slice('--skip-'.length));
    }
    return args;
}

function printHelp() {
    console.log(`
Firestore → Postgres clinical-content loader.

  --mode=dry-run | verify | apply       required
  --limit=N                             cap per-collection iteration
  --batch-size=N                        default 100
  --prod                                required in production for --mode=apply
  --verbose                             log every record
  --skip-{${STEP_FLAGS.join('|')}}      skip step(s)
`);
}

async function confirm(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, (a) => { rl.close(); resolve(a.trim()); });
    });
}

// ─────────────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────────────

const APPT_STATUS = {
    pending: 'pending', Pending: 'pending',
    confirmed: 'confirmed', Confirmed: 'confirmed', Scheduled: 'confirmed',
    rejected: 'rejected', Rejected: 'rejected',
    completed: 'completed', Completed: 'completed',
    cancelled: 'cancelled', Cancelled: 'cancelled', Canceled: 'cancelled',
    no_show: 'no_show', 'No Show': 'no_show', 'no show': 'no_show', NoShow: 'no_show'
};

const VITAL_TYPE = {
    'Blood Pressure': 'blood_pressure', blood_pressure: 'blood_pressure', BloodPressure: 'blood_pressure',
    Weight: 'weight', weight: 'weight',
    'Heart Rate': 'heart_rate', heart_rate: 'heart_rate', HeartRate: 'heart_rate',
    Temperature: 'temperature', temperature: 'temperature'
};

const GLUCOSE_CONTEXT = {
    Fasting: 'fasting', fasting: 'fasting',
    'Pre-meal': 'pre_meal', pre_meal: 'pre_meal', 'Before meal': 'pre_meal',
    'Post-meal': 'post_meal', post_meal: 'post_meal', 'After meal': 'post_meal',
    Bedtime: 'bedtime', bedtime: 'bedtime',
    Random: 'random', random: 'random'
};

function normalizeApptStatus(v) {
    if (v == null) return 'pending';
    return APPT_STATUS[v] || APPT_STATUS[String(v).toLowerCase()] || null;
}

function normalizeVitalType(v) {
    if (v == null) return null;
    return VITAL_TYPE[v] || VITAL_TYPE[String(v)] || 'other';
}

function normalizeGlucoseContext(v) {
    if (v == null) return 'unknown';
    return GLUCOSE_CONTEXT[v] || GLUCOSE_CONTEXT[String(v).toLowerCase()] || 'unknown';
}

function normalizeFrequency(v) {
    const allowed = ['daily', 'twice_daily', 'three_times', 'weekly', 'custom'];
    if (!v) return 'daily';
    return allowed.includes(v) ? v : 'custom';
}

/** Extract an integer mg/dL from a vital doc that may store glucose|value. */
function extractGlucose(data) {
    if (typeof data.glucose === 'number' && Number.isFinite(data.glucose)) {
        return Math.round(data.glucose);
    }
    if (data.value != null) {
        const n = parseFloat(String(data.value));
        if (Number.isFinite(n)) return Math.round(n);
    }
    return null;
}

/** Parse "120/80" or {systolic,diastolic} into {systolic, diastolic}. */
function extractBloodPressure(data) {
    if (typeof data.systolic === 'number' && typeof data.diastolic === 'number') {
        return { systolic: Math.round(data.systolic), diastolic: Math.round(data.diastolic) };
    }
    if (typeof data.value === 'string' && data.value.includes('/')) {
        const [s, d] = data.value.split('/').map((x) => parseInt(x.trim(), 10));
        if (Number.isFinite(s) && Number.isFinite(d)) return { systolic: s, diastolic: d };
    }
    return null;
}

function tsOrNull(v) {
    if (!v) return null;
    if (v && typeof v.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
}

function tsOrNow(v) {
    return tsOrNull(v) || new Date();
}

function dateOrNull(v) {
    const d = tsOrNull(v);
    return d;
}

// ─────────────────────────────────────────────────────────────────────
// Report helpers
// ─────────────────────────────────────────────────────────────────────

function makeReport() {
    const tables = [
        'glucose_readings', 'vital_readings', 'prescriptions', 'prescription_items',
        'medical_records', 'lab_results', 'appointments', 'medication_schedules',
        'doctor_events', 'notification_preferences', 'patient_documents'
    ];
    const r = {};
    for (const t of tables) r[t] = { source: 0, loaded: 0, skipped: 0, failed: 0, errors: [] };
    return r;
}

function fail(report, table, srcId, message) {
    report[table].failed++;
    if (report[table].errors.length < 25) report[table].errors.push({ srcId, message });
}

// ─────────────────────────────────────────────────────────────────────
// Resolvers — Firestore patient/doctor id (any of docId|id|uid) → PG profile id
// ─────────────────────────────────────────────────────────────────────

async function buildPatientResolver({ db, query }) {
    // PG: patient_profile.id by firebase_uid
    const pg = await query(
        `SELECT pp.id AS pp_id, u.firebase_uid
         FROM patient_profiles pp JOIN users u ON u.id = pp.user_id
         WHERE pp.deleted_at IS NULL`
    );
    const uidToPp = new Map();
    for (const row of pg.rows || []) uidToPp.set(row.firebase_uid, row.pp_id);

    // Firestore: map every key a patient might be referenced by → its uid
    const map = new Map();   // key (docId|legacy id|uid) → pp_id
    let lastDoc = null;
    while (true) {
        let q = db.collection('patients').limit(200);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];
        for (const doc of snap.docs) {
            const data = doc.data() || {};
            const ppId = data.uid ? uidToPp.get(data.uid) : null;
            if (!ppId) continue;
            map.set(String(doc.id), ppId);
            if (data.id != null) map.set(String(data.id), ppId);
            if (data.uid) map.set(String(data.uid), ppId);
        }
        if (snap.docs.length < 200) break;
    }
    return map;
}

async function buildDoctorResolver({ db, query }) {
    const pg = await query(
        `SELECT dp.id AS dp_id, u.firebase_uid
         FROM doctor_profiles dp JOIN users u ON u.id = dp.user_id
         WHERE dp.deleted_at IS NULL`
    );
    const uidToDp = new Map();
    for (const row of pg.rows || []) uidToDp.set(row.firebase_uid, row.dp_id);

    const map = new Map();
    let lastDoc = null;
    while (true) {
        let q = db.collection('doctors').limit(200);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];
        for (const doc of snap.docs) {
            const data = doc.data() || {};
            const dpId = data.uid ? uidToDp.get(data.uid) : null;
            if (!dpId) continue;
            map.set(String(doc.id), dpId);
            if (data.id != null) map.set(String(data.id), dpId);
            if (data.uid) map.set(String(data.uid), dpId);
        }
        if (snap.docs.length < 200) break;
    }
    return map;
}

// ─────────────────────────────────────────────────────────────────────
// Generic helper: insert with deterministic client_uuid, ON CONFLICT skip
// ─────────────────────────────────────────────────────────────────────

async function insertIdempotent({ query, report, table, srcId, clientUuid, sql, params, verbose }) {
    try {
        const res = await query(sql, params);
        if (res.rowCount > 0 && !res._skipped) {
            report[table].loaded++;
            if (verbose || report[table].loaded <= 10) {
                console.log(`[loaded ] ${table}  src=${srcId}`);
            }
            return res.rows?.[0]?.id || null;
        }
        report[table].skipped++;
        return null;
    } catch (err) {
        fail(report, table, srcId, err.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Step: vitals → glucose_readings | vital_readings
// ─────────────────────────────────────────────────────────────────────

async function loadVitals(ctx) {
    const { db, query, report, mode, limit, batchSize, verbose, patientMap } = ctx;
    // Iterate patients, read each patient's vitals subcollection.
    let lastP = null;
    while (true) {
        let pq = db.collection('patients').limit(batchSize);
        if (lastP) pq = pq.startAfter(lastP);
        const psnap = await pq.get();
        if (psnap.empty) break;
        lastP = psnap.docs[psnap.docs.length - 1];

        for (const pdoc of psnap.docs) {
            const ppId = patientMap.get(String(pdoc.id));
            if (!ppId) continue;
            const vitalsSnap = await db.collection('patients').doc(pdoc.id).collection('vitals').get();

            for (const vdoc of vitalsSnap.docs) {
                const data = vdoc.data() || {};
                const type = data.type || data.category;
                const measuredAt = tsOrNow(data.date);
                const isGlucose = !type || type === 'Glucose' || type === 'glucose';

                if (isGlucose) {
                    if (limit && report.glucose_readings.source >= limit) continue;
                    report.glucose_readings.source++;
                    const mg = extractGlucose(data);
                    if (mg == null) {
                        fail(report, 'glucose_readings', `${pdoc.id}/${vdoc.id}`, 'no numeric glucose value');
                        continue;
                    }
                    const clientUuid = deterministicUuid('glucose_readings', pdoc.id, vdoc.id);
                    if (mode === 'dry-run') {
                        report.glucose_readings.loaded++;
                        if (verbose || report.glucose_readings.source <= 10) console.log(`[dry-run] glucose  ${pdoc.id}/${vdoc.id}  ${mg}mg/dL`);
                        continue;
                    }
                    await insertIdempotent({
                        query, report, table: 'glucose_readings', srcId: `${pdoc.id}/${vdoc.id}`, verbose,
                        sql: `INSERT INTO glucose_readings
                                (patient_id, value_mg_dl, measured_at, recorded_at, context, source, notes, client_uuid)
                              VALUES ($1,$2,$3,$3,$4,$5,$6,$7)
                              ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                        params: [ppId, mg, measuredAt, normalizeGlucoseContext(data.subtype || data.context), 'manual', data.notes || null, clientUuid]
                    });
                } else {
                    if (limit && report.vital_readings.source >= limit) continue;
                    report.vital_readings.source++;
                    const vtype = normalizeVitalType(type);
                    const clientUuid = deterministicUuid('vital_readings', pdoc.id, vdoc.id);
                    let valueNumeric = null, systolic = null, diastolic = null;

                    if (vtype === 'blood_pressure') {
                        const bp = extractBloodPressure(data);
                        if (!bp) { fail(report, 'vital_readings', `${pdoc.id}/${vdoc.id}`, 'BP missing systolic/diastolic'); continue; }
                        systolic = bp.systolic; diastolic = bp.diastolic;
                    } else {
                        const n = parseFloat(String(data.value ?? data.glucose ?? ''));
                        if (!Number.isFinite(n)) { fail(report, 'vital_readings', `${pdoc.id}/${vdoc.id}`, 'non-numeric vital value'); continue; }
                        valueNumeric = n;
                    }
                    if (mode === 'dry-run') {
                        report.vital_readings.loaded++;
                        if (verbose || report.vital_readings.source <= 10) console.log(`[dry-run] vital  ${pdoc.id}/${vdoc.id}  ${vtype}`);
                        continue;
                    }
                    await insertIdempotent({
                        query, report, table: 'vital_readings', srcId: `${pdoc.id}/${vdoc.id}`, verbose,
                        sql: `INSERT INTO vital_readings
                                (patient_id, vital_type, value_numeric, systolic, diastolic, unit, measured_at, recorded_at, source, notes, client_uuid)
                              VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10)
                              ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                        params: [ppId, vtype, valueNumeric, systolic, diastolic, data.unit || null, measuredAt, 'manual', data.notes || null, clientUuid]
                    });
                }
            }
        }
        if (psnap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Step: prescriptions → prescriptions + prescription_items
// ─────────────────────────────────────────────────────────────────────

async function loadPrescriptions(ctx) {
    const { db, query, report, mode, limit, batchSize, verbose, patientMap, doctorMap } = ctx;
    let lastDoc = null;
    while (true) {
        let q = db.collection('prescriptions').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            if (limit && report.prescriptions.source >= limit) return;
            report.prescriptions.source++;
            const data = doc.data() || {};
            const ppId = patientMap.get(String(data.patientId));
            if (!ppId) { fail(report, 'prescriptions', doc.id, `no patient_profile for patientId=${data.patientId}`); continue; }
            if (!data.medication) { fail(report, 'prescriptions', doc.id, 'missing medication'); continue; }

            const dpId = data.doctorId ? (doctorMap.get(String(data.doctorId)) || null) : null;
            const rxUuid = deterministicUuid('prescriptions', doc.id);
            const itemUuid = deterministicUuid('prescription_items', doc.id);
            const status = ['active', 'completed', 'discontinued'].includes(String(data.status || '').toLowerCase())
                ? String(data.status).toLowerCase() : 'active';

            if (mode === 'dry-run') {
                report.prescriptions.source && report.prescriptions.loaded++;
                report.prescription_items.loaded++;
                if (verbose || report.prescriptions.source <= 10) console.log(`[dry-run] prescription  ${doc.id}  ${data.medication}`);
                continue;
            }

            const rxId = await insertIdempotent({
                query, report, table: 'prescriptions', srcId: doc.id, verbose,
                sql: `INSERT INTO prescriptions (patient_id, doctor_id, prescribed_at, status, notes, client_uuid)
                      VALUES ($1,$2,$3,$4,$5,$6)
                      ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                params: [ppId, dpId, dateOrNull(data.date || data.startDate) || new Date(), status, data.notes || null, rxUuid]
            });

            // Resolve the header id even if it already existed (skipped), so the
            // item can attach. On skip, look it up by client_uuid.
            let headerId = rxId;
            if (!headerId) {
                const found = await query('SELECT id FROM prescriptions WHERE client_uuid=$1 LIMIT 1', [rxUuid]);
                headerId = found.rows?.[0]?.id || null;
            }
            if (!headerId) { fail(report, 'prescription_items', doc.id, 'could not resolve header'); continue; }

            report.prescription_items.source++;
            await insertIdempotent({
                query, report, table: 'prescription_items', srcId: doc.id, verbose,
                sql: `INSERT INTO prescription_items
                        (prescription_id, medication, dosage, frequency, instructions, start_date, end_date, client_uuid)
                      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                      ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                params: [headerId, data.medication, data.dosage || null, data.frequency || null,
                         data.instructions || null, dateOrNull(data.startDate), dateOrNull(data.endDate), itemUuid]
            });
        }
        if (snap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Step: medical_records → lab_results | medical_records
// ─────────────────────────────────────────────────────────────────────

async function loadMedicalRecords(ctx) {
    const { db, query, report, mode, limit, batchSize, verbose, patientMap, doctorMap } = ctx;
    let lastDoc = null;
    while (true) {
        let q = db.collection('medical_records').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            const data = doc.data() || {};
            const ppId = patientMap.get(String(data.patientId));
            if (!ppId) { fail(report, 'medical_records', doc.id, `no patient_profile for patientId=${data.patientId}`); continue; }
            const dpId = data.doctorId ? (doctorMap.get(String(data.doctorId)) || null) : null;

            if (data.type === 'lab_result') {
                if (limit && report.lab_results.source >= limit) continue;
                report.lab_results.source++;
                const clientUuid = deterministicUuid('lab_results', doc.id);
                if (mode === 'dry-run') { report.lab_results.loaded++; continue; }
                await insertIdempotent({
                    query, report, table: 'lab_results', srcId: doc.id, verbose,
                    sql: `INSERT INTO lab_results (patient_id, doctor_id, test_name, test_date, file_url, structured_values, notes, client_uuid)
                          VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
                          ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                    params: [ppId, dpId, data.title || 'Lab result', dateOrNull(data.date),
                             data.metadata?.fileUrl || null, JSON.stringify(data.metadata?.values || data.metadata || {}),
                             data.content || null, clientUuid]
                });
            } else {
                if (limit && report.medical_records.source >= limit) continue;
                report.medical_records.source++;
                const rt = ['diagnosis', 'procedure', 'clinical_note', 'referral'].includes(data.type) ? data.type : 'clinical_note';
                if (!data.title || !data.content) { fail(report, 'medical_records', doc.id, 'missing title/content'); continue; }
                const clientUuid = deterministicUuid('medical_records', doc.id);
                if (mode === 'dry-run') { report.medical_records.loaded++; continue; }
                await insertIdempotent({
                    query, report, table: 'medical_records', srcId: doc.id, verbose,
                    sql: `INSERT INTO medical_records (patient_id, doctor_id, record_type, title, content, recorded_at, metadata, client_uuid)
                          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
                          ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                    params: [ppId, dpId, rt, data.title, data.content, dateOrNull(data.date) || new Date(),
                             JSON.stringify(data.metadata || {}), clientUuid]
                });
            }
        }
        if (snap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Step: appointments
// ─────────────────────────────────────────────────────────────────────

async function loadAppointments(ctx) {
    const { db, query, report, mode, limit, batchSize, verbose, patientMap, doctorMap } = ctx;
    let lastDoc = null;
    while (true) {
        let q = db.collection('appointments').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            if (limit && report.appointments.source >= limit) return;
            report.appointments.source++;
            const data = doc.data() || {};
            const ppId = patientMap.get(String(data.patientId));
            if (!ppId) { fail(report, 'appointments', doc.id, `no patient_profile for patientId=${data.patientId}`); continue; }
            if (!data.date) { fail(report, 'appointments', doc.id, 'missing date'); continue; }

            const status = normalizeApptStatus(data.status);
            if (!status) { fail(report, 'appointments', doc.id, `unknown status "${data.status}"`); continue; }

            const dpId = data.doctorId ? (doctorMap.get(String(data.doctorId)) || null) : null;
            const clientUuid = deterministicUuid('appointments', doc.id);
            if (mode === 'dry-run') {
                report.appointments.loaded++;
                if (verbose || report.appointments.source <= 10) console.log(`[dry-run] appointment  ${doc.id}  ${data.date} ${status}`);
                continue;
            }
            await insertIdempotent({
                query, report, table: 'appointments', srcId: doc.id, verbose,
                sql: `INSERT INTO appointments (patient_id, doctor_id, scheduled_date, scheduled_time, status, reason, appointment_type, notes, client_uuid)
                      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                      ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                params: [ppId, dpId, data.date, data.time || null, status, data.reason || null, data.type || null, data.notes || null, clientUuid]
            });
        }
        if (snap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Step: medication_schedules
// ─────────────────────────────────────────────────────────────────────

async function loadMedicationSchedules(ctx) {
    const { db, query, report, mode, limit, batchSize, verbose, patientMap, doctorMap } = ctx;
    let lastDoc = null;
    while (true) {
        let q = db.collection('medication_schedules').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            if (limit && report.medication_schedules.source >= limit) return;
            report.medication_schedules.source++;
            const data = doc.data() || {};
            const ppId = patientMap.get(String(data.patientId));
            if (!ppId) { fail(report, 'medication_schedules', doc.id, `no patient_profile for patientId=${data.patientId}`); continue; }
            if (!data.medication || !Array.isArray(data.times) || !data.startDate) {
                fail(report, 'medication_schedules', doc.id, 'missing medication/times/startDate'); continue;
            }
            const createdBy = data.createdBy ? (doctorMap.get(String(data.createdBy)) || null) : null;
            const clientUuid = deterministicUuid('medication_schedules', doc.id);
            if (mode === 'dry-run') { report.medication_schedules.loaded++; continue; }
            await insertIdempotent({
                query, report, table: 'medication_schedules', srcId: doc.id, verbose,
                sql: `INSERT INTO medication_schedules
                        (patient_id, medication, dosage, times, frequency, start_date, end_date, active, created_by, client_uuid)
                      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10)
                      ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                params: [ppId, data.medication, data.dosage || null, JSON.stringify(data.times),
                         normalizeFrequency(data.frequency), data.startDate, data.endDate || null,
                         data.active !== false, createdBy, clientUuid]
            });
        }
        if (snap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Step: doctor_events
// ─────────────────────────────────────────────────────────────────────

async function loadDoctorEvents(ctx) {
    const { db, query, report, mode, limit, batchSize, verbose, doctorMap } = ctx;
    let lastDoc = null;
    while (true) {
        let q = db.collection('doctor_events').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            if (limit && report.doctor_events.source >= limit) return;
            report.doctor_events.source++;
            const data = doc.data() || {};
            const dpId = doctorMap.get(String(data.doctorId));
            if (!dpId) { fail(report, 'doctor_events', doc.id, `no doctor_profile for doctorId=${data.doctorId}`); continue; }
            const allDay = data.allDay === true;
            if (!allDay && (!data.startTime || !data.endTime)) {
                fail(report, 'doctor_events', doc.id, 'non-all-day event missing start/end time'); continue;
            }
            const clientUuid = deterministicUuid('doctor_events', doc.id);
            if (mode === 'dry-run') { report.doctor_events.loaded++; continue; }
            await insertIdempotent({
                query, report, table: 'doctor_events', srcId: doc.id, verbose,
                sql: `INSERT INTO doctor_events (doctor_id, title, category, event_date, start_time, end_time, all_day, notes, client_uuid)
                      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                      ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                params: [dpId, data.title || 'Event', data.category || 'other', data.date,
                         allDay ? null : data.startTime, allDay ? null : data.endTime, allDay, data.notes || null, clientUuid]
            });
        }
        if (snap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Step: notification_preferences (doc id = patientId)
// ─────────────────────────────────────────────────────────────────────

async function loadNotificationPreferences(ctx) {
    const { db, query, report, mode, limit, batchSize, verbose, patientMap } = ctx;
    let lastDoc = null;
    while (true) {
        let q = db.collection('notification_preferences').limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];

        for (const doc of snap.docs) {
            if (limit && report.notification_preferences.source >= limit) return;
            report.notification_preferences.source++;
            const data = doc.data() || {};
            const ppId = patientMap.get(String(doc.id)) || patientMap.get(String(data.patientId));
            if (!ppId) { fail(report, 'notification_preferences', doc.id, `no patient_profile for ${doc.id}`); continue; }
            if (mode === 'dry-run') { report.notification_preferences.loaded++; continue; }
            await insertIdempotent({
                query, report, table: 'notification_preferences', srcId: doc.id, verbose,
                sql: `INSERT INTO notification_preferences
                        (patient_id, vital_reminder_enabled, morning_reminder_time, evening_reminder_enabled,
                         evening_reminder_time, medication_reminder_enabled, escalation_enabled, escalation_days, timezone)
                      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                      ON CONFLICT (patient_id) DO NOTHING RETURNING id`,
                params: [ppId,
                         data.vitalReminderEnabled !== false, data.morningReminderTime || '07:00',
                         data.eveningReminderEnabled === true, data.eveningReminderTime || '19:00',
                         data.medicationReminderEnabled !== false, data.escalationEnabled !== false,
                         Math.min(14, Math.max(1, data.escalationDays || 3)), 'Africa/Kinshasa']
            });
        }
        if (snap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Step: patient documents (subcollection)
// ─────────────────────────────────────────────────────────────────────

async function loadPatientDocuments(ctx) {
    const { db, query, report, mode, limit, batchSize, verbose, patientMap } = ctx;
    let lastP = null;
    while (true) {
        let pq = db.collection('patients').limit(batchSize);
        if (lastP) pq = pq.startAfter(lastP);
        const psnap = await pq.get();
        if (psnap.empty) break;
        lastP = psnap.docs[psnap.docs.length - 1];

        for (const pdoc of psnap.docs) {
            const ppId = patientMap.get(String(pdoc.id));
            if (!ppId) continue;
            const docsSnap = await db.collection('patients').doc(pdoc.id).collection('documents').get();
            for (const ddoc of docsSnap.docs) {
                if (limit && report.patient_documents.source >= limit) continue;
                report.patient_documents.source++;
                const data = ddoc.data() || {};
                if (!data.url && !data.fileUrl) { fail(report, 'patient_documents', `${pdoc.id}/${ddoc.id}`, 'missing url'); continue; }
                const clientUuid = deterministicUuid('patient_documents', pdoc.id, ddoc.id);
                if (mode === 'dry-run') { report.patient_documents.loaded++; continue; }
                await insertIdempotent({
                    query, report, table: 'patient_documents', srcId: `${pdoc.id}/${ddoc.id}`, verbose,
                    sql: `INSERT INTO patient_documents (patient_id, name, file_url, doc_type, size_bytes, uploaded_at, client_uuid)
                          VALUES ($1,$2,$3,$4,$5,$6,$7)
                          ON CONFLICT (client_uuid) DO NOTHING RETURNING id`,
                    params: [ppId, data.name || 'document', data.url || data.fileUrl, data.type || null,
                             Number.isFinite(data.size) ? data.size : null, tsOrNow(data.uploadedAt || data.date), clientUuid]
                });
            }
        }
        if (psnap.docs.length < batchSize) break;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) { printHelp(); process.exit(0); }
    if (!MODES.has(args.mode)) { console.error('error: --mode= required (dry-run|verify|apply)'); printHelp(); process.exit(2); }
    if (args.mode === 'apply' && process.env.NODE_ENV === 'production' && !args.prod) {
        console.error('refusing --mode=apply in production without --prod'); process.exit(2);
    }
    if (args.mode === 'apply' && args.prod) {
        const a = await confirm('\n*** PRODUCTION APPLY (clinical content) ***\nType "APPLY" to proceed: ');
        if (a !== 'APPLY') { console.error('aborted'); process.exit(2); }
    }

    const { db } = require('../../config/firebaseConfig');
    const { query, shutdown } = require('../../db/client');
    if (!db) { console.error('error: Firestore not configured'); process.exit(3); }

    const report = makeReport();
    console.log(`\n=== Clinical loader (mode=${args.mode}, env=${process.env.NODE_ENV || 'development'}) ===\n`);
    console.log('Building patient/doctor resolvers...');
    const patientMap = await buildPatientResolver({ db, query });
    const doctorMap = await buildDoctorResolver({ db, query });
    console.log(`  patients resolvable: ${new Set(patientMap.values()).size}, doctors resolvable: ${new Set(doctorMap.values()).size}\n`);

    const ctx = { db, query, report, patientMap, doctorMap, mode: args.mode, limit: args.limit, batchSize: args.batchSize, verbose: args.verbose };
    const t0 = Date.now();

    try {
        if (!args.skip.has('vitals'))        await loadVitals(ctx);
        if (!args.skip.has('prescriptions')) await loadPrescriptions(ctx);
        if (!args.skip.has('records'))       await loadMedicalRecords(ctx);
        if (!args.skip.has('appointments'))  await loadAppointments(ctx);
        if (!args.skip.has('schedules'))     await loadMedicationSchedules(ctx);
        if (!args.skip.has('events'))        await loadDoctorEvents(ctx);
        if (!args.skip.has('prefs'))         await loadNotificationPreferences(ctx);
        if (!args.skip.has('documents'))     await loadPatientDocuments(ctx);

        console.log(`\n=== Summary (mode=${args.mode}, ${Date.now() - t0}ms) ===`);
        console.log(JSON.stringify(report, null, 2));
        const anyFailed = Object.values(report).some(c => c.failed > 0);
        await shutdown();
        process.exit(anyFailed ? 1 : 0);
    } catch (err) {
        console.error('loader fatal:', err.message);
        await shutdown();
        process.exit(99);
    }
}

if (require.main === module) main();

module.exports = {
    parseArgs, deterministicUuid, makeReport,
    normalizeApptStatus, normalizeVitalType, normalizeGlucoseContext, normalizeFrequency,
    extractGlucose, extractBloodPressure, tsOrNull, tsOrNow, dateOrNull,
    buildPatientResolver, buildDoctorResolver,
    loadVitals, loadPrescriptions, loadMedicalRecords, loadAppointments,
    loadMedicationSchedules, loadDoctorEvents, loadNotificationPreferences, loadPatientDocuments
};
