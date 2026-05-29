/**
 * Tests for the clinical-content loader.
 *
 * Same approach as load_users_and_profiles.test.js: synthetic Firestore mock +
 * an in-memory query recorder. Focuses on the risky transforms — vitals split,
 * BP parsing, glucose extraction, appointment-status normalization, lab routing,
 * and deterministic-uuid idempotency.
 *
 * Synthetic data only.
 */

const loader = require('../scripts/loaders/load_clinical_content');

// ─── Synthetic Firestore mock with subcollection support ───────────────

function makeDoc(id, data, subcollections = {}) {
    return { id, _data: data, _subs: subcollections, data: () => data };
}

function makeColl(docsArr) {
    const docs = docsArr.map(d => makeDoc(d.id, d.data, d.subs || {}));
    return {
        _docs: docs,
        _start: null,
        _limit: docs.length,
        limit(n) { this._limit = n; return this; },
        startAfter(c) { this._start = c; return this; },
        async get() {
            let from = 0;
            if (this._start) from = this._docs.findIndex(d => d.id === this._start.id) + 1;
            const slice = this._docs.slice(from, from + this._limit);
            return { empty: slice.length === 0, docs: slice };
        },
        doc(id) {
            const found = docs.find(d => d.id === id);
            return {
                async get() {
                    return found ? { exists: true, data: () => found._data } : { exists: false, data: () => null };
                },
                collection(subName) {
                    const subDocs = (found && found._subs[subName]) || [];
                    return makeColl(subDocs);
                }
            };
        }
    };
}

function makeFirestoreMock(collections) {
    return { collection: (name) => makeColl(collections[name] || []) };
}

// In-memory recorder. Resolver SELECTs return preconfigured rows; INSERTs
// record into per-table arrays and honor ON CONFLICT (client_uuid) DO NOTHING.
function makeQueryRecorder({ patientRows = [], doctorRows = [] } = {}) {
    const inserted = {
        glucose_readings: [], vital_readings: [], prescriptions: [], prescription_items: [],
        medical_records: [], lab_results: [], appointments: [], medication_schedules: [],
        doctor_events: [], notification_preferences: [], patient_documents: []
    };
    const seenClientUuids = new Set();
    let nextId = 1;

    const fn = jest.fn(async (sql, params = []) => {
        // Resolver SELECTs
        if (/FROM patient_profiles pp JOIN users/i.test(sql)) {
            return { rowCount: patientRows.length, rows: patientRows };
        }
        if (/FROM doctor_profiles dp JOIN users/i.test(sql)) {
            return { rowCount: doctorRows.length, rows: doctorRows };
        }
        // Header lookup by client_uuid (prescriptions skip path)
        if (/SELECT id FROM prescriptions WHERE client_uuid/i.test(sql)) {
            const found = inserted.prescriptions.find(r => r.client_uuid === params[0]);
            return found ? { rowCount: 1, rows: [{ id: found.id }] } : { rowCount: 0, rows: [] };
        }

        // INSERTs
        const m = sql.match(/INSERT INTO (\w+)/i);
        if (m) {
            const table = m[1];
            if (!inserted[table]) return { rowCount: 1, rows: [{ id: `x-${nextId++}` }] };

            // client_uuid is the LAST param for most; for notification_preferences there's none.
            const clientUuid = table === 'notification_preferences' ? null : params[params.length - 1];
            if (clientUuid) {
                if (seenClientUuids.has(clientUuid)) return { rowCount: 0, rows: [] }; // ON CONFLICT skip
                seenClientUuids.add(clientUuid);
            }
            const id = `${table}-${nextId++}`;
            const row = { id, client_uuid: clientUuid, params };
            inserted[table].push(row);
            return { rowCount: 1, rows: [{ id }] };
        }
        return { rowCount: 0, rows: [] };
    });

    return { fn, inserted, seenClientUuids };
}

// Common: one patient (pp-1 via uid fb-pat), one doctor (dp-1 via uid fb-doc)
function commonResolvers() {
    return {
        patientRows: [{ pp_id: 'pp-1', firebase_uid: 'fb-pat' }],
        doctorRows: [{ dp_id: 'dp-1', firebase_uid: 'fb-doc' }]
    };
}

async function resolversFor(db, rec) {
    const patientMap = await loader.buildPatientResolver({ db, query: rec.fn });
    const doctorMap = await loader.buildDoctorResolver({ db, query: rec.fn });
    return { patientMap, doctorMap };
}

// ─── Pure functions ────────────────────────────────────────────────────

describe('clinical loader: pure functions', () => {
    test('deterministicUuid is stable and well-formed', () => {
        const a = loader.deterministicUuid('glucose_readings', 'p1', 'v1');
        const b = loader.deterministicUuid('glucose_readings', 'p1', 'v1');
        const c = loader.deterministicUuid('glucose_readings', 'p1', 'v2');
        expect(a).toBe(b);              // stable
        expect(a).not.toBe(c);          // distinct inputs → distinct uuids
        expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test('normalizeApptStatus maps legacy mixed-case; unknown → null', () => {
        expect(loader.normalizeApptStatus('Pending')).toBe('pending');
        expect(loader.normalizeApptStatus('Scheduled')).toBe('confirmed');
        expect(loader.normalizeApptStatus('No Show')).toBe('no_show');
        expect(loader.normalizeApptStatus('completed')).toBe('completed');
        expect(loader.normalizeApptStatus('banana')).toBeNull();
        expect(loader.normalizeApptStatus(null)).toBe('pending');
    });

    test('normalizeVitalType maps known; unknown → other', () => {
        expect(loader.normalizeVitalType('Blood Pressure')).toBe('blood_pressure');
        expect(loader.normalizeVitalType('Weight')).toBe('weight');
        expect(loader.normalizeVitalType('Mystery')).toBe('other');
    });

    test('extractGlucose handles number, numeric string, and junk', () => {
        expect(loader.extractGlucose({ glucose: 142 })).toBe(142);
        expect(loader.extractGlucose({ value: '155' })).toBe(155);
        expect(loader.extractGlucose({ value: '155.7' })).toBe(156);
        expect(loader.extractGlucose({ value: 'high' })).toBeNull();
        expect(loader.extractGlucose({})).toBeNull();
    });

    test('extractBloodPressure parses string and object forms', () => {
        expect(loader.extractBloodPressure({ value: '120/80' })).toEqual({ systolic: 120, diastolic: 80 });
        expect(loader.extractBloodPressure({ systolic: 130, diastolic: 85 })).toEqual({ systolic: 130, diastolic: 85 });
        expect(loader.extractBloodPressure({ value: 'n/a' })).toBeNull();
    });
});

// ─── loadVitals: the split ─────────────────────────────────────────────

describe('clinical loader: loadVitals', () => {
    function vitalsFixture() {
        return makeFirestoreMock({
            patients: [{
                id: 'fs-pat-1',
                data: { uid: 'fb-pat' },
                subs: {
                    vitals: [
                        { id: 'v1', data: { type: 'Glucose', glucose: 142, date: '2026-03-01T08:00:00Z', subtype: 'Fasting' } },
                        { id: 'v2', data: { type: 'Blood Pressure', value: '120/80', date: '2026-03-01T08:05:00Z' } },
                        { id: 'v3', data: { type: 'Weight', value: '82.5', unit: 'kg', date: '2026-03-01T08:10:00Z' } },
                        { id: 'v4', data: { type: 'Glucose', value: 'HIGH', date: '2026-03-01T09:00:00Z' } } // bad → failed
                    ]
                }
            }]
        });
    }

    test('routes glucose vs vital_readings and records bad glucose as failed', async () => {
        const db = vitalsFixture();
        const rec = makeQueryRecorder(commonResolvers());
        const { patientMap, doctorMap } = await resolversFor(db, rec);
        const report = loader.makeReport();

        await loader.loadVitals({ db, query: rec.fn, report, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report.glucose_readings.loaded).toBe(1);    // v1
        expect(report.glucose_readings.failed).toBe(1);    // v4 (HIGH)
        expect(report.vital_readings.loaded).toBe(2);      // v2 (BP) + v3 (weight)

        // BP row carries systolic/diastolic
        const bpRow = rec.inserted.vital_readings.find(r => r.params[1] === 'blood_pressure');
        expect(bpRow.params[3]).toBe(120);  // systolic
        expect(bpRow.params[4]).toBe(80);   // diastolic

        // Weight row carries value_numeric
        const wRow = rec.inserted.vital_readings.find(r => r.params[1] === 'weight');
        expect(Number(wRow.params[2])).toBeCloseTo(82.5);
    });

    test('idempotent: re-running loads nothing new (same deterministic client_uuids)', async () => {
        const db = vitalsFixture();
        const rec = makeQueryRecorder(commonResolvers());
        const { patientMap, doctorMap } = await resolversFor(db, rec);

        const r1 = loader.makeReport();
        await loader.loadVitals({ db, query: rec.fn, report: r1, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });
        const r2 = loader.makeReport();
        await loader.loadVitals({ db, query: rec.fn, report: r2, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(r1.glucose_readings.loaded).toBe(1);
        expect(r2.glucose_readings.loaded).toBe(0);
        expect(r2.glucose_readings.skipped).toBe(1);
        expect(r2.vital_readings.loaded).toBe(0);
        expect(r2.vital_readings.skipped).toBe(2);
    });

    test('dry-run never inserts', async () => {
        const db = vitalsFixture();
        const rec = makeQueryRecorder(commonResolvers());
        const { patientMap, doctorMap } = await resolversFor(db, rec);
        const report = loader.makeReport();

        await loader.loadVitals({ db, query: rec.fn, report, patientMap, doctorMap, mode: 'dry-run', limit: null, batchSize: 50, verbose: false });

        expect(rec.inserted.glucose_readings).toHaveLength(0);
        expect(rec.inserted.vital_readings).toHaveLength(0);
        expect(report.glucose_readings.loaded).toBe(1);  // counted as "would load"
    });
});

// ─── loadPrescriptions: header + item split ────────────────────────────

describe('clinical loader: loadPrescriptions', () => {
    test('one flat prescription → one header + one item', async () => {
        const db = makeFirestoreMock({
            prescriptions: [{
                id: 'rx-1',
                data: { patientId: 'fs-pat-1', doctorId: 'fs-doc-1', medication: 'Metformin', dosage: '500mg', frequency: 'twice daily', date: '2026-03-01' }
            }],
            patients: [{ id: 'fs-pat-1', data: { uid: 'fb-pat' } }],
            doctors: [{ id: 'fs-doc-1', data: { uid: 'fb-doc' } }]
        });
        const rec = makeQueryRecorder(commonResolvers());
        const { patientMap, doctorMap } = await resolversFor(db, rec);
        const report = loader.makeReport();

        await loader.loadPrescriptions({ db, query: rec.fn, report, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report.prescriptions.loaded).toBe(1);
        expect(report.prescription_items.loaded).toBe(1);
        expect(rec.inserted.prescription_items[0].params[1]).toBe('Metformin');
    });

    test('fails when patientId does not resolve', async () => {
        const db = makeFirestoreMock({
            prescriptions: [{ id: 'rx-1', data: { patientId: 'ghost', medication: 'Metformin' } }],
            patients: [{ id: 'fs-pat-1', data: { uid: 'fb-pat' } }],
            doctors: []
        });
        const rec = makeQueryRecorder({ patientRows: [{ pp_id: 'pp-1', firebase_uid: 'fb-pat' }], doctorRows: [] });
        const { patientMap, doctorMap } = await resolversFor(db, rec);
        const report = loader.makeReport();

        await loader.loadPrescriptions({ db, query: rec.fn, report, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report.prescriptions.failed).toBe(1);
        expect(report.prescriptions.errors[0].message).toMatch(/no patient_profile/);
    });
});

// ─── loadMedicalRecords: lab routing ───────────────────────────────────

describe('clinical loader: loadMedicalRecords', () => {
    test('routes lab_result → lab_results, others → medical_records', async () => {
        const db = makeFirestoreMock({
            medical_records: [
                { id: 'mr-1', data: { patientId: 'fs-pat-1', type: 'lab_result', title: 'HbA1c', content: '7.2%', metadata: { values: { hba1c: 7.2 } }, date: '2026-03-01' } },
                { id: 'mr-2', data: { patientId: 'fs-pat-1', type: 'clinical_note', title: 'Visit', content: 'Patient stable', date: '2026-03-02' } },
                { id: 'mr-3', data: { patientId: 'fs-pat-1', type: 'diagnosis', title: 'Dx', content: 'T2DM', date: '2026-03-03' } }
            ],
            patients: [{ id: 'fs-pat-1', data: { uid: 'fb-pat' } }],
            doctors: []
        });
        const rec = makeQueryRecorder({ patientRows: [{ pp_id: 'pp-1', firebase_uid: 'fb-pat' }], doctorRows: [] });
        const { patientMap, doctorMap } = await resolversFor(db, rec);
        const report = loader.makeReport();

        await loader.loadMedicalRecords({ db, query: rec.fn, report, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report.lab_results.loaded).toBe(1);
        expect(report.medical_records.loaded).toBe(2);
        // lab structured_values preserved
        const lab = rec.inserted.lab_results[0];
        expect(JSON.parse(lab.params[5])).toEqual({ hba1c: 7.2 });
    });
});

// ─── loadAppointments: status normalization ────────────────────────────

describe('clinical loader: loadAppointments', () => {
    test('normalizes status; fails unknown status', async () => {
        const db = makeFirestoreMock({
            appointments: [
                { id: 'a1', data: { patientId: 'fs-pat-1', doctorId: 'fs-doc-1', date: '2026-03-10', time: '09:00', status: 'Pending' } },
                { id: 'a2', data: { patientId: 'fs-pat-1', date: '2026-03-11', status: 'Scheduled' } },
                { id: 'a3', data: { patientId: 'fs-pat-1', date: '2026-03-12', status: 'Teleported' } } // unknown → failed
            ],
            patients: [{ id: 'fs-pat-1', data: { uid: 'fb-pat' } }],
            doctors: [{ id: 'fs-doc-1', data: { uid: 'fb-doc' } }]
        });
        const rec = makeQueryRecorder(commonResolvers());
        const { patientMap, doctorMap } = await resolversFor(db, rec);
        const report = loader.makeReport();

        await loader.loadAppointments({ db, query: rec.fn, report, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report.appointments.loaded).toBe(2);
        expect(report.appointments.failed).toBe(1);
        const statuses = rec.inserted.appointments.map(r => r.params[4]);
        expect(statuses).toEqual(expect.arrayContaining(['pending', 'confirmed']));
    });
});

// ─── loadNotificationPreferences: conflict on patient_id ───────────────

describe('clinical loader: loadNotificationPreferences', () => {
    test('maps doc-id=patientId to patient_profile and inserts', async () => {
        const db = makeFirestoreMock({
            notification_preferences: [
                { id: 'fs-pat-1', data: { vitalReminderEnabled: false, escalationDays: 5 } }
            ],
            patients: [{ id: 'fs-pat-1', data: { uid: 'fb-pat' } }],
            doctors: []
        });
        const rec = makeQueryRecorder({ patientRows: [{ pp_id: 'pp-1', firebase_uid: 'fb-pat' }], doctorRows: [] });
        const { patientMap, doctorMap } = await resolversFor(db, rec);
        const report = loader.makeReport();

        await loader.loadNotificationPreferences({ db, query: rec.fn, report, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report.notification_preferences.loaded).toBe(1);
        const row = rec.inserted.notification_preferences[0];
        expect(row.params[0]).toBe('pp-1');       // patient_id
        expect(row.params[1]).toBe(false);        // vital_reminder_enabled
        expect(row.params[7]).toBe(5);            // escalation_days clamped/passed
    });
});

// ─── loadPatientDocuments: subcollection ───────────────────────────────

describe('clinical loader: loadPatientDocuments', () => {
    test('migrates document metadata from subcollection', async () => {
        const db = makeFirestoreMock({
            patients: [{
                id: 'fs-pat-1',
                data: { uid: 'fb-pat' },
                subs: {
                    documents: [
                        { id: 'd1', data: { name: 'lab.pdf', url: 'https://storage/lab.pdf', type: 'pdf', size: 10240, uploadedAt: '2026-03-01' } },
                        { id: 'd2', data: { name: 'nourl' } } // missing url → failed
                    ]
                }
            }]
        });
        const rec = makeQueryRecorder({ patientRows: [{ pp_id: 'pp-1', firebase_uid: 'fb-pat' }], doctorRows: [] });
        const { patientMap, doctorMap } = await resolversFor(db, rec);
        const report = loader.makeReport();

        await loader.loadPatientDocuments({ db, query: rec.fn, report, patientMap, doctorMap, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report.patient_documents.loaded).toBe(1);
        expect(report.patient_documents.failed).toBe(1);
        expect(rec.inserted.patient_documents[0].params[2]).toBe('https://storage/lab.pdf');
    });
});
