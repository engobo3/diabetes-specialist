/**
 * Tests for the Firestore → Postgres loader.
 *
 * Strategy: import the loader's exported pure-function pieces (mappers,
 * parseArgs) and unit-test them directly. For the integration-shaped pieces
 * (loadUsers / loadPatientProfiles / etc.) we pass in a fake `db` (Firestore
 * mock) and a fake `query` (in-memory recorder), and assert the right
 * INSERTs would be issued.
 *
 * Synthetic data only — no real Firestore or Postgres touched.
 */

const loader = require('../scripts/loaders/load_users_and_profiles');

// ─────────────────────────────────────────────────────────────────────
// Synthetic Firestore fixture
// ─────────────────────────────────────────────────────────────────────

function makeDoc(id, data) {
    return { id, data: () => data };
}

/**
 * Fake firestore-admin DB. Supports `.collection(name).limit(n).get()` and
 * `.collection(name).doc(id).get()`. Pagination via startAfter is implemented
 * trivially (just iterates the in-memory array).
 */
function makeFirestoreMock(collections) {
    return {
        collection: (name) => {
            const docs = (collections[name] || []).map((d) => makeDoc(d.id, d.data));
            const builder = {
                _docs: docs,
                _startAfter: null,
                _limit: docs.length,
                limit(n) { this._limit = n; return this; },
                startAfter(cursor) { this._startAfter = cursor; return this; },
                async get() {
                    let from = 0;
                    if (this._startAfter) {
                        from = this._docs.findIndex(d => d.id === this._startAfter.id) + 1;
                    }
                    const slice = this._docs.slice(from, from + this._limit);
                    return { empty: slice.length === 0, docs: slice };
                },
                doc(id) {
                    return {
                        async get() {
                            const found = docs.find(d => d.id === id);
                            return found
                                ? { exists: true, data: () => found.data() }
                                : { exists: false, data: () => null };
                        }
                    };
                }
            };
            return builder;
        }
    };
}

/**
 * In-memory query recorder. Returns:
 *   - For SELECTs: configured rows
 *   - For INSERT ... RETURNING: an auto-assigned id
 *   - Otherwise: rowCount: 1
 */
function makeQueryRecorder(opts = {}) {
    const calls = [];
    const userRows = new Map();          // firebase_uid → { id }
    const patientProfileRows = new Map();// user_id → { id }
    const doctorProfileRows = new Map(); // user_id → { id }
    const careRows = [];
    const caregiverRows = [];
    let nextId = 1;

    const fn = jest.fn(async (sql, params = []) => {
        calls.push({ sql, params });
        const s = sql.trim().toUpperCase();

        // SELECT id FROM users WHERE firebase_uid = $1
        if (/SELECT id FROM users WHERE firebase_uid/i.test(sql)) {
            const uid = params[0];
            const row = userRows.get(uid);
            return row ? { rowCount: 1, rows: [row] } : { rowCount: 0, rows: [] };
        }
        // SELECT pp.id, u.firebase_uid FROM patient_profiles ...
        if (/FROM patient_profiles/i.test(sql) && /SELECT/i.test(s) && /JOIN users/i.test(sql)) {
            const rows = [];
            for (const [userId, pp] of patientProfileRows) {
                // Reverse-lookup firebase_uid for this userId
                for (const [uid, u] of userRows) {
                    if (u.id === userId) rows.push({ pp_id: pp.id, firebase_uid: uid });
                }
            }
            return { rowCount: rows.length, rows };
        }
        // SELECT dp.id, u.firebase_uid FROM doctor_profiles ...
        if (/FROM doctor_profiles/i.test(sql) && /SELECT/i.test(s) && /JOIN users/i.test(sql)) {
            const rows = [];
            for (const [userId, dp] of doctorProfileRows) {
                for (const [uid, u] of userRows) {
                    if (u.id === userId) rows.push({ dp_id: dp.id, firebase_uid: uid });
                }
            }
            return { rowCount: rows.length, rows };
        }
        // SELECT 1 FROM care_relationships ... (existence)
        if (/FROM care_relationships/i.test(sql) && /WHERE/i.test(sql)) {
            const [patientId, doctorId] = params;
            const exists = careRows.some(c => c.patient_id === patientId && c.doctor_id === doctorId && c.status === 'active');
            return { rowCount: exists ? 1 : 0, rows: [] };
        }
        // INSERT INTO users (...)
        if (/INSERT INTO users/i.test(sql)) {
            const [firebaseUid] = params;
            if (userRows.has(firebaseUid)) return { rowCount: 0, rows: [] };
            const id = `pg-user-${nextId++}`;
            userRows.set(firebaseUid, { id });
            return { rowCount: 1, rows: [{ id }] };
        }
        // INSERT INTO patient_profiles (...)
        if (/INSERT INTO patient_profiles/i.test(sql)) {
            const [userId] = params;
            if (patientProfileRows.has(userId)) return { rowCount: 0, rows: [] };
            const id = `pg-pp-${nextId++}`;
            patientProfileRows.set(userId, { id });
            return { rowCount: 1, rows: [{ id }] };
        }
        // INSERT INTO doctor_profiles (...)
        if (/INSERT INTO doctor_profiles/i.test(sql)) {
            const [userId] = params;
            if (doctorProfileRows.has(userId)) return { rowCount: 0, rows: [] };
            const id = `pg-dp-${nextId++}`;
            doctorProfileRows.set(userId, { id });
            return { rowCount: 1, rows: [{ id }] };
        }
        // INSERT INTO care_relationships (...)
        if (/INSERT INTO care_relationships/i.test(sql)) {
            const [patientId, doctorId, isPrimary] = params;
            careRows.push({ patient_id: patientId, doctor_id: doctorId, is_primary: isPrimary, status: 'active' });
            return { rowCount: 1, rows: [] };
        }
        // INSERT INTO caregiver_links (...)
        if (/INSERT INTO caregiver_links/i.test(sql)) {
            const inviteToken = params[6];
            if (caregiverRows.some(c => c.invite_token === inviteToken)) return { rowCount: 0, rows: [] };
            const id = `pg-cg-${nextId++}`;
            caregiverRows.push({ id, invite_token: inviteToken, patient_id: params[0], caregiver_email: params[1] });
            return { rowCount: 1, rows: [{ id }] };
        }
        // Default
        return { rowCount: opts.defaultRowCount ?? 0, rows: [] };
    });

    return { fn, calls, userRows, patientProfileRows, doctorProfileRows, careRows, caregiverRows };
}

// ─────────────────────────────────────────────────────────────────────
// Pure-function tests
// ─────────────────────────────────────────────────────────────────────

describe('loader: pure functions', () => {
    test('parseArgs accepts --mode, --limit, --batch-size, --prod', () => {
        const args = loader.parseArgs([
            'node', 'script.js',
            '--mode=apply',
            '--limit=10',
            '--batch-size=50',
            '--prod',
            '--verbose'
        ]);
        expect(args).toMatchObject({
            mode: 'apply',
            limit: 10,
            batchSize: 50,
            prod: true,
            verbose: true
        });
    });

    test('parseArgs supports skip flags', () => {
        const args = loader.parseArgs(['node', 'script.js', '--mode=dry-run', '--skip-doctors']);
        expect(args.skipDoctors).toBe(true);
        expect(args.skipUsers).toBe(false);
    });

    test('normalizeLanguage maps to known set; unknown → fr', () => {
        expect(loader.normalizeLanguage('FR')).toBe('fr');
        expect(loader.normalizeLanguage('en')).toBe('en');
        expect(loader.normalizeLanguage('xx')).toBe('fr');
        expect(loader.normalizeLanguage(null)).toBe('fr');
    });

    test('normalizeDiabetesType maps mixed-case Firestore strings to enum', () => {
        expect(loader.normalizeDiabetesType('Type 2')).toBe('type_2');
        expect(loader.normalizeDiabetesType('type_1')).toBe('type_1');
        expect(loader.normalizeDiabetesType('Unknown')).toBeNull();
        expect(loader.normalizeDiabetesType(null)).toBeNull();
    });

    test('normalizeRelationship defaults to caregiver on unknown input', () => {
        expect(loader.normalizeRelationship('Parent')).toBe('parent');
        expect(loader.normalizeRelationship('weirdo')).toBe('caregiver');
        expect(loader.normalizeRelationship(null)).toBe('caregiver');
    });

    test('tsOrNow handles Firestore Timestamp, ISO string, and invalid', () => {
        // Firestore Timestamp-shaped
        const ts = { toDate: () => new Date('2026-01-01T00:00:00Z') };
        expect(loader.tsOrNow(ts)).toEqual(new Date('2026-01-01T00:00:00Z'));
        // ISO string
        expect(loader.tsOrNow('2026-01-02T00:00:00Z')).toEqual(new Date('2026-01-02T00:00:00Z'));
        // Invalid → now-ish
        expect(loader.tsOrNow('not a date')).toBeInstanceOf(Date);
        // null → now
        expect(loader.tsOrNow(null)).toBeInstanceOf(Date);
    });

    test('dateOrNull returns null for missing/invalid', () => {
        expect(loader.dateOrNull(null)).toBeNull();
        expect(loader.dateOrNull('not a date')).toBeNull();
        expect(loader.dateOrNull('2026-03-15')).toEqual(new Date('2026-03-15'));
    });

    test('makeReport produces all five table buckets', () => {
        const r = loader.makeReport();
        for (const t of ['users', 'patient_profiles', 'doctor_profiles', 'care_relationships', 'caregiver_links']) {
            expect(r[t]).toEqual({ source: 0, loaded: 0, skipped: 0, failed: 0, errors: [] });
        }
    });
});

// ─────────────────────────────────────────────────────────────────────
// Integration-shape tests (synthetic Firestore + recorded queries)
// ─────────────────────────────────────────────────────────────────────

describe('loader: loadUsers', () => {
    test('inserts every users doc on apply', async () => {
        const db = makeFirestoreMock({
            users: [
                { id: 'fb-u1', data: { role: 'patient', preferredLanguage: 'fr' } },
                { id: 'fb-u2', data: { role: 'doctor', preferredLanguage: 'ln' } }
            ]
        });
        const rec = makeQueryRecorder();
        const report = loader.makeReport();

        await loader.loadUsers({
            db, query: rec.fn, report, mode: 'apply',
            limit: null, batchSize: 50, verbose: false
        });

        expect(report.users.source).toBe(2);
        expect(report.users.loaded).toBe(2);
        expect(report.users.failed).toBe(0);
        expect(rec.userRows.size).toBe(2);
    });

    test('--mode=dry-run never INSERTs', async () => {
        const db = makeFirestoreMock({
            users: [{ id: 'fb-u1', data: { role: 'patient' } }]
        });
        const rec = makeQueryRecorder();
        const report = loader.makeReport();

        await loader.loadUsers({
            db, query: rec.fn, report, mode: 'dry-run',
            limit: null, batchSize: 50, verbose: false
        });

        expect(report.users.source).toBe(1);
        expect(report.users.loaded).toBe(1);   // counted as "would load"
        expect(rec.calls.filter(c => /INSERT/i.test(c.sql))).toHaveLength(0);
    });

    test('idempotent — re-running does not duplicate', async () => {
        const fixture = [{ id: 'fb-u1', data: { role: 'patient' } }];
        const db = makeFirestoreMock({ users: fixture });
        const rec = makeQueryRecorder();
        const report1 = loader.makeReport();
        const report2 = loader.makeReport();

        await loader.loadUsers({ db, query: rec.fn, report: report1, mode: 'apply', limit: null, batchSize: 50, verbose: false });
        await loader.loadUsers({ db, query: rec.fn, report: report2, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report1.users.loaded).toBe(1);
        expect(report2.users.loaded).toBe(0);
        expect(report2.users.skipped).toBe(1);
        expect(rec.userRows.size).toBe(1);  // still only one row
    });

    test('records failure when role is missing', async () => {
        const db = makeFirestoreMock({
            users: [{ id: 'fb-broken', data: {} }]
        });
        const rec = makeQueryRecorder();
        const report = loader.makeReport();

        await loader.loadUsers({ db, query: rec.fn, report, mode: 'apply', limit: null, batchSize: 50, verbose: false });

        expect(report.users.failed).toBe(1);
        expect(report.users.errors[0]).toMatchObject({ srcId: 'fb-broken', message: 'missing role' });
    });

    test('respects --limit', async () => {
        const db = makeFirestoreMock({
            users: [
                { id: 'fb-u1', data: { role: 'patient' } },
                { id: 'fb-u2', data: { role: 'patient' } },
                { id: 'fb-u3', data: { role: 'patient' } }
            ]
        });
        const rec = makeQueryRecorder();
        const report = loader.makeReport();

        await loader.loadUsers({ db, query: rec.fn, report, mode: 'apply', limit: 2, batchSize: 50, verbose: false });

        expect(report.users.source).toBe(2);
        expect(report.users.loaded).toBe(2);
    });
});

describe('loader: loadPatientProfiles', () => {
    test('links patient → users via uid; skips patients without uid', async () => {
        const db = makeFirestoreMock({
            patients: [
                { id: 'fs-p1', data: { uid: 'fb-u1', type: 'Type 2', conditions: ['hypertension'], city: 'Gombe' } },
                { id: 'fs-p2', data: { /* no uid */ type: 'Type 1' } }
            ]
        });
        const rec = makeQueryRecorder();
        // Pre-populate the user
        rec.userRows.set('fb-u1', { id: 'pg-user-1' });
        const report = loader.makeReport();
        const resolveUserId = loader.makeUserIdResolver({ query: rec.fn });

        await loader.loadPatientProfiles({
            db, query: rec.fn, report, mode: 'apply',
            limit: null, batchSize: 50, verbose: false, resolveUserId
        });

        expect(report.patient_profiles.loaded).toBe(1);
        expect(report.patient_profiles.failed).toBe(1);
        expect(report.patient_profiles.errors[0].srcId).toBe('fs-p2');
    });

    test('fails when no users row exists for the patient.uid', async () => {
        const db = makeFirestoreMock({
            patients: [{ id: 'fs-p1', data: { uid: 'fb-nonexistent', type: 'Type 2' } }]
        });
        const rec = makeQueryRecorder();
        const report = loader.makeReport();
        const resolveUserId = loader.makeUserIdResolver({ query: rec.fn });

        await loader.loadPatientProfiles({
            db, query: rec.fn, report, mode: 'apply',
            limit: null, batchSize: 50, verbose: false, resolveUserId
        });

        expect(report.patient_profiles.failed).toBe(1);
        expect(report.patient_profiles.errors[0].message).toMatch(/no users row/);
    });
});

describe('loader: loadCareRelationships', () => {
    test('creates one relationship per (patient, doctor) pair, marking primary correctly', async () => {
        const db = makeFirestoreMock({
            patients: [{ id: 'fs-p1', data: {
                uid: 'fb-u1',
                doctorId: 'fs-doc-1',
                doctorIds: ['fs-doc-1', 'fs-doc-2']
            } }],
            doctors: [
                { id: 'fs-doc-1', data: { uid: 'fb-doc-1' } },
                { id: 'fs-doc-2', data: { uid: 'fb-doc-2' } }
            ]
        });
        const rec = makeQueryRecorder();
        // Pre-populate users + profiles
        rec.userRows.set('fb-u1', { id: 'pg-user-1' });
        rec.userRows.set('fb-doc-1', { id: 'pg-user-doc-1' });
        rec.userRows.set('fb-doc-2', { id: 'pg-user-doc-2' });
        rec.patientProfileRows.set('pg-user-1', { id: 'pg-pp-1' });
        rec.doctorProfileRows.set('pg-user-doc-1', { id: 'pg-dp-1' });
        rec.doctorProfileRows.set('pg-user-doc-2', { id: 'pg-dp-2' });
        const report = loader.makeReport();

        await loader.loadCareRelationships({
            db, query: rec.fn, report, mode: 'apply',
            limit: null, batchSize: 50, verbose: false
        });

        expect(report.care_relationships.loaded).toBe(2);
        const primaryLinks = rec.careRows.filter(c => c.is_primary === true);
        expect(primaryLinks).toHaveLength(1);
        expect(primaryLinks[0].doctor_id).toBe('pg-dp-1');
    });

    test('idempotent: pre-existing active link is skipped', async () => {
        const db = makeFirestoreMock({
            patients: [{ id: 'fs-p1', data: { uid: 'fb-u1', doctorIds: ['fs-doc-1'] } }],
            doctors:  [{ id: 'fs-doc-1', data: { uid: 'fb-doc-1' } }]
        });
        const rec = makeQueryRecorder();
        rec.userRows.set('fb-u1', { id: 'pg-user-1' });
        rec.userRows.set('fb-doc-1', { id: 'pg-user-doc-1' });
        rec.patientProfileRows.set('pg-user-1', { id: 'pg-pp-1' });
        rec.doctorProfileRows.set('pg-user-doc-1', { id: 'pg-dp-1' });
        // Pre-existing relationship
        rec.careRows.push({ patient_id: 'pg-pp-1', doctor_id: 'pg-dp-1', status: 'active' });
        const report = loader.makeReport();

        await loader.loadCareRelationships({
            db, query: rec.fn, report, mode: 'apply',
            limit: null, batchSize: 50, verbose: false
        });

        expect(report.care_relationships.skipped).toBe(1);
        expect(report.care_relationships.loaded).toBe(0);
    });
});

describe('loader: loadCaregiverLinks', () => {
    test('inserts one caregiver_link per caregivers[] entry, idempotent via invite_token', async () => {
        const db = makeFirestoreMock({
            patients: [{
                id: 'fs-p1',
                data: {
                    uid: 'fb-u1',
                    caregivers: [
                        { email: 'aunt@example.com', relationship: 'sibling', permissions: { viewVitals: true } },
                        { email: 'spouse@example.com', relationship: 'spouse', addedBy: 'doctor' }
                    ]
                }
            }]
        });
        const rec = makeQueryRecorder();
        rec.userRows.set('fb-u1', { id: 'pg-user-1' });
        rec.patientProfileRows.set('pg-user-1', { id: 'pg-pp-1' });
        const report = loader.makeReport();

        await loader.loadCaregiverLinks({
            db, query: rec.fn, report, mode: 'apply',
            limit: null, batchSize: 50, verbose: false
        });

        expect(report.caregiver_links.loaded).toBe(2);
        const tokens = rec.caregiverRows.map(c => c.invite_token);
        expect(tokens).toEqual(expect.arrayContaining([
            'legacy:fs-p1:aunt@example.com',
            'legacy:fs-p1:spouse@example.com'
        ]));
    });

    test('skips caregiver entries missing email', async () => {
        const db = makeFirestoreMock({
            patients: [{
                id: 'fs-p1',
                data: {
                    uid: 'fb-u1',
                    caregivers: [{ relationship: 'sibling' }]   // no email
                }
            }]
        });
        const rec = makeQueryRecorder();
        rec.userRows.set('fb-u1', { id: 'pg-user-1' });
        rec.patientProfileRows.set('pg-user-1', { id: 'pg-pp-1' });
        const report = loader.makeReport();

        await loader.loadCaregiverLinks({
            db, query: rec.fn, report, mode: 'apply',
            limit: null, batchSize: 50, verbose: false
        });

        expect(report.caregiver_links.failed).toBe(1);
        expect(report.caregiver_links.errors[0].message).toMatch(/no email/);
    });
});
