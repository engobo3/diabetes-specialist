/**
 * Integration tests for the offline-sync endpoints (Phase 4a).
 * Mounts the real app via supertest with auth, db, resolver, and audit mocked.
 * Synthetic data only.
 */

const request = require('supertest');

// Auth mock: an `x-test-unmigrated` header flips the user to a Firestore-sourced
// token whose patient won't resolve (tests the deferred path).
jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
    if (!req.headers['authorization']) return res.status(403).json({ message: 'Forbidden' });
    if (req.headers['x-test-unmigrated']) {
        req.user = { uid: 'fb-pat', role: 'patient', patientId: 'legacy-1', _userSource: 'firestore' };
    } else {
        req.user = { uid: 'fb-pat', role: 'patient', patientId: 'pp-1', _userSource: 'postgres' };
    }
    next();
});

const mockQuery = jest.fn();
jest.mock('../db/client', () => ({ query: (...a) => mockQuery(...a) }));

const mockToProfileId = jest.fn();
jest.mock('../services/patientResolver', () => ({ toProfileId: (...a) => mockToProfileId(...a) }));

jest.mock('../services/auditServiceV2', () => ({ log: jest.fn().mockResolvedValue(null) }));

const { app } = require('../server');

const AUTH = ['Authorization', 'Bearer t'];
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function glucose(overrides = {}) {
    return {
        type: 'glucose',
        client_uuid: UUID_A,
        value_mg_dl: 142,
        measured_at: '2026-03-01T08:00:00Z',
        context: 'fasting',
        source: 'manual',
        ...overrides
    };
}

beforeEach(() => {
    mockQuery.mockReset();
    mockToProfileId.mockReset();
});

describe('POST /api/sync/batch', () => {
    test('403 without auth', async () => {
        const res = await request(app).post('/api/sync/batch').send({ items: [glucose()] });
        expect(res.statusCode).toBe(403);
    });

    test('accepts new glucose items', async () => {
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'g-1' }] });
        const res = await request(app).post('/api/sync/batch').set(...AUTH).send({ items: [glucose()] });
        expect(res.statusCode).toBe(200);
        expect(res.body.results[0]).toMatchObject({ client_uuid: UUID_A, status: 'accepted', id: 'g-1' });
    });

    test('marks duplicate when ON CONFLICT skips (rowCount 0)', async () => {
        mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
        const res = await request(app).post('/api/sync/batch').set(...AUTH).send({ items: [glucose()] });
        expect(res.body.results[0].status).toBe('duplicate');
    });

    test('marks deferred when PG unavailable (_skipped)', async () => {
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0, _skipped: true });
        const res = await request(app).post('/api/sync/batch').set(...AUTH).send({ items: [glucose()] });
        expect(res.body.results[0].status).toBe('deferred');
    });

    test('rejects bad measured_at (passes Zod string, fails Date parse)', async () => {
        const res = await request(app).post('/api/sync/batch').set(...AUTH)
            .send({ items: [glucose({ measured_at: 'not-a-date' })] });
        expect(res.statusCode).toBe(200);
        expect(res.body.results[0]).toMatchObject({ status: 'rejected', reason: 'bad_measured_at' });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('400 on invalid client_uuid (Zod)', async () => {
        const res = await request(app).post('/api/sync/batch').set(...AUTH)
            .send({ items: [glucose({ client_uuid: 'not-a-uuid' })] });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Validation Failed');
    });

    test('400 on empty batch', async () => {
        const res = await request(app).post('/api/sync/batch').set(...AUTH).send({ items: [] });
        expect(res.statusCode).toBe(400);
    });

    test('400 on out-of-range glucose value', async () => {
        const res = await request(app).post('/api/sync/batch').set(...AUTH)
            .send({ items: [glucose({ value_mg_dl: 99999 })] });
        expect(res.statusCode).toBe(400);
    });

    test('defers the whole batch when account not migrated', async () => {
        mockToProfileId.mockResolvedValue(null); // firestore-sourced resolver miss
        const res = await request(app).post('/api/sync/batch').set(...AUTH)
            .set('x-test-unmigrated', '1')
            .send({ items: [glucose(), glucose({ client_uuid: UUID_B })] });
        expect(res.statusCode).toBe(200);
        expect(res.body.results.every(r => r.status === 'deferred')).toBe(true);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('mixed batch: one accepted, one duplicate', async () => {
        mockQuery
            .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'g-1' }] })
            .mockResolvedValueOnce({ rowCount: 0, rows: [] });
        const res = await request(app).post('/api/sync/batch').set(...AUTH)
            .send({ items: [glucose(), glucose({ client_uuid: UUID_B })] });
        const statuses = res.body.results.map(r => r.status);
        expect(statuses).toEqual(['accepted', 'duplicate']);
    });
});

describe('GET /api/sync/changes', () => {
    test('returns rows + server-clock watermark (last recorded_at)', async () => {
        mockQuery.mockResolvedValue({
            rowCount: 2,
            rows: [
                { id: 'g1', recorded_at: '2026-03-01T10:00:00.000Z' },
                { id: 'g2', recorded_at: '2026-03-01T11:00:00.000Z' }
            ]
        });
        const res = await request(app).get('/api/sync/changes?since=2026-01-01T00:00:00Z').set(...AUTH);
        expect(res.statusCode).toBe(200);
        expect(res.body.changes).toHaveLength(2);
        expect(res.body.watermark).toBe('2026-03-01T11:00:00.000Z');
    });

    test('empty changes echoes the since watermark', async () => {
        mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
        const res = await request(app).get('/api/sync/changes?since=2026-02-01T00:00:00Z').set(...AUTH);
        expect(res.body.changes).toEqual([]);
        expect(res.body.watermark).toBe('2026-02-01T00:00:00Z');
    });

    test('not-migrated account returns empty (no throw)', async () => {
        mockToProfileId.mockResolvedValue(null);
        const res = await request(app).get('/api/sync/changes').set(...AUTH).set('x-test-unmigrated', '1');
        expect(res.statusCode).toBe(200);
        expect(res.body.changes).toEqual([]);
    });
});
