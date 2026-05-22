/**
 * Self-contained smoke test for the messaging endpoints.
 *
 * Boots the real Express app but mocks authMiddleware and services/database so
 * the test exercises the full route stack (auth -> security -> validation -> RBAC
 * -> controller) without needing real Firestore. Reports pass/fail to stdout.
 *
 * Run: node server/scripts/verify_messaging.js
 */

const Module = require('module');

// ── Replace authMiddleware so requests carry a fake authenticated doctor ──
const authPath = require.resolve('../middleware/authMiddleware');
require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: (req, res, next) => {
        if (!req.headers['authorization']) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = {
            uid: req.headers['x-user-id'] || 'doctor_uid_1',
            email: 'doc@test.com',
            role: 'doctor',
            doctorId: req.headers['x-user-id'] || 'doctor_uid_1'
        };
        next();
    }
};

// ── Stub services/database so saveMessage / getConversation don't hit Firestore ──
const dbPath = require.resolve('../services/database');
const fakeStore = [];
require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
        saveMessage: async (data) => {
            const saved = { id: 'msg_' + (fakeStore.length + 1), ...data };
            fakeStore.push(saved);
            return saved;
        },
        getConversation: async (userId, contactId) => {
            return fakeStore.filter(m =>
                (String(m.senderId) === String(userId) && String(m.receiverId) === String(contactId)) ||
                (String(m.senderId) === String(contactId) && String(m.receiverId) === String(userId))
            );
        },
        getMessages: async () => fakeStore,
        // Stubs needed by other route mounts that get loaded by server.js
        getPatients: async () => [],
        getPatientById: async () => null,
        getPatientByEmail: async () => null,
        getPatientByPhone: async () => null,
        getPatientsByDoctorId: async () => [],
        migrateToFirestore: async () => undefined,
        getDoctors: async () => [],
        getVitals: async () => [],
        addVital: async (_id, v) => ({ id: 'v', ...v }),
        deleteVital: async () => true,
        getAppointments: async () => [],
        createAppointment: async (d) => ({ id: 'a', ...d }),
        updateAppointment: async () => null,
        createPatient: async (d) => ({ id: 'p', ...d }),
        updatePatient: async () => null,
        deletePatient: async () => true,
        getPrescriptions: async () => [],
        createPrescription: async (d) => ({ id: 'rx', ...d }),
        getPatientDocuments: async () => [],
        addPatientDocument: async (_id, d) => ({ id: 'doc', ...d })
    }
};

// ── Boot the app ──
const request = require('supertest');
const { app } = require('../server');

const TICK = '✓';
const X = '✗';
let pass = 0, fail = 0;
const results = [];

function record(name, ok, detail) {
    results.push({ name, ok, detail });
    if (ok) pass++; else fail++;
    console.log(`${ok ? TICK : X}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function check(name, fn) {
    try { await fn(); record(name, true); }
    catch (e) { record(name, false, e.message); }
}

(async () => {
    console.log('\n=== Messaging smoke test ===\n');

    // 1. POST /api/messages without auth → 403
    await check('POST /api/messages without auth returns 403', async () => {
        const res = await request(app).post('/api/messages').send({ receiverId: 'p1', text: 'hi' });
        if (res.statusCode !== 403) throw new Error(`expected 403, got ${res.statusCode}`);
    });

    // 2. POST /api/messages with valid body → 201
    await check('POST /api/messages with valid body returns 201 + persists', async () => {
        const res = await request(app)
            .post('/api/messages')
            .set('Authorization', 'Bearer t')
            .set('Content-Type', 'application/json')
            .send({ senderId: 'doctor_uid_1', receiverId: 'patient_1', text: 'Hello patient', senderName: 'Dr. Smith' });
        if (res.statusCode !== 201) throw new Error(`expected 201, got ${res.statusCode} body=${JSON.stringify(res.body)}`);
        if (!res.body.success) throw new Error(`expected success=true, got ${JSON.stringify(res.body)}`);
        if (res.body.data.text !== 'Hello patient') throw new Error('text mismatch');
        if (res.body.data.senderId !== 'doctor_uid_1') throw new Error('senderId mismatch');
        if (!res.body.data.timestamp) throw new Error('timestamp missing');
    });

    // 3. POST /api/messages with empty text → 400 (validation rejects)
    await check('POST /api/messages with empty text returns 400 from Zod', async () => {
        const res = await request(app)
            .post('/api/messages')
            .set('Authorization', 'Bearer t')
            .set('Content-Type', 'application/json')
            .send({ senderId: 'doctor_uid_1', receiverId: 'patient_1', text: '' });
        if (res.statusCode !== 400) throw new Error(`expected 400, got ${res.statusCode}`);
        if (res.body.error !== 'Validation Failed') throw new Error('expected validation-failed error');
        const issue = (res.body.details || []).find(d => d.path === 'text');
        if (!issue) throw new Error('expected details.text issue');
    });

    // 4. POST /api/messages missing receiverId → 400
    await check('POST /api/messages missing receiverId returns 400', async () => {
        const res = await request(app)
            .post('/api/messages')
            .set('Authorization', 'Bearer t')
            .set('Content-Type', 'application/json')
            .send({ senderId: 'doctor_uid_1', text: 'hi' });
        if (res.statusCode !== 400) throw new Error(`expected 400, got ${res.statusCode}`);
    });

    // 5. POST /api/messages with text over 10000 chars → 400
    await check('POST /api/messages with oversized text returns 400', async () => {
        const res = await request(app)
            .post('/api/messages')
            .set('Authorization', 'Bearer t')
            .set('Content-Type', 'application/json')
            .send({ senderId: 'doctor_uid_1', receiverId: 'patient_1', text: 'A'.repeat(10001) });
        if (res.statusCode !== 400) throw new Error(`expected 400, got ${res.statusCode}`);
    });

    // 6. POST /api/messages impersonating another user → 403
    await check('POST /api/messages impersonating another user returns 403', async () => {
        const res = await request(app)
            .post('/api/messages')
            .set('Authorization', 'Bearer t')
            .set('Content-Type', 'application/json')
            .send({ senderId: 'someone_else', receiverId: 'patient_1', text: 'hi' });
        if (res.statusCode !== 403) throw new Error(`expected 403 (controller impersonation guard), got ${res.statusCode}`);
    });

    // 7. POST self-message → 400
    await check('POST /api/messages to self returns 400', async () => {
        const res = await request(app)
            .post('/api/messages')
            .set('Authorization', 'Bearer t')
            .set('Content-Type', 'application/json')
            .send({ senderId: 'doctor_uid_1', receiverId: 'doctor_uid_1', text: 'hi' });
        if (res.statusCode !== 400) throw new Error(`expected 400, got ${res.statusCode}`);
    });

    // 8. GET /api/messages?contactId=patient_1 → 200 (returns earlier saved message)
    await check('GET /api/messages?contactId=patient_1 returns conversation', async () => {
        const res = await request(app)
            .get('/api/messages?contactId=patient_1')
            .set('Authorization', 'Bearer t');
        if (res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode}`);
        if (!Array.isArray(res.body)) throw new Error('expected array body');
        if (res.body.length === 0) throw new Error('expected at least one message (saved in earlier check)');
    });

    // 9. GET /api/messages without contactId → 400
    await check('GET /api/messages without contactId returns 400', async () => {
        const res = await request(app)
            .get('/api/messages')
            .set('Authorization', 'Bearer t');
        if (res.statusCode !== 400) throw new Error(`expected 400, got ${res.statusCode}`);
    });

    // 10. PUT /api/messages/:messageId/read without auth → 403
    // Note: validateContentType runs before verifyToken — send Content-Type so we
    // observe the auth check, not the content-type check.
    await check('PUT /api/messages/:id/read without auth returns 403', async () => {
        const res = await request(app)
            .put('/api/messages/abc/read')
            .set('Content-Type', 'application/json')
            .send({});
        if (res.statusCode !== 403) throw new Error(`expected 403, got ${res.statusCode}`);
    });

    // 11. Invalid messageId format (special chars) → 400 from validateParams
    await check('PUT /api/messages/<bad>/read returns 400 on invalid id', async () => {
        const res = await request(app)
            .put('/api/messages/bad%20id%20with%20spaces/read')
            .set('Authorization', 'Bearer t')
            .set('Content-Type', 'application/json')
            .send({});
        if (res.statusCode !== 400) throw new Error(`expected 400, got ${res.statusCode}`);
    });

    // 12. Belt-and-suspenders: validateContentType rejects PUT without JSON
    await check('PUT /api/messages/:id/read without Content-Type returns 415', async () => {
        const res = await request(app)
            .put('/api/messages/abc/read')
            .set('Authorization', 'Bearer t');
        if (res.statusCode !== 415) throw new Error(`expected 415, got ${res.statusCode}`);
    });

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => {
    console.error('Verification script crashed:', e);
    process.exit(2);
});
