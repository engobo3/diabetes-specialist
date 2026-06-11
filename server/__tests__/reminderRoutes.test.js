/**
 * Route tests for /api/reminders — full app via supertest with auth, service,
 * resolver, and audit mocked. Synthetic data only.
 */

const request = require('supertest');

jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
    if (!req.headers['authorization']) return res.status(403).json({ message: 'Forbidden' });
    req.user = { uid: 'fb-pat', role: 'patient', patientId: 'pp-1', _userSource: 'postgres' };
    next();
});

const mockSvc = {
    listForPatient: jest.fn(),
    acknowledge: jest.fn(),
    snooze: jest.fn()
};
jest.mock('../services/reminderService', () => ({
    listForPatient: (...a) => mockSvc.listForPatient(...a),
    acknowledge: (...a) => mockSvc.acknowledge(...a),
    snooze: (...a) => mockSvc.snooze(...a)
}));

jest.mock('../services/patientResolver', () => ({ toProfileId: jest.fn() }));
jest.mock('../services/auditServiceV2', () => ({ log: jest.fn().mockResolvedValue(null) }));
jest.mock('../db/client', () => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0, _skipped: true }),
    withTransaction: jest.fn().mockResolvedValue({ _skipped: true })
}));

const { app } = require('../server');
const AUTH = ['Authorization', 'Bearer t'];

beforeEach(() => {
    mockSvc.listForPatient.mockReset().mockResolvedValue([]);
    mockSvc.acknowledge.mockReset();
    mockSvc.snooze.mockReset();
});

describe('GET /api/reminders', () => {
    test('403 without auth', async () => {
        const res = await request(app).get('/api/reminders');
        expect(res.statusCode).toBe(403);
    });

    test('returns the patient\'s reminders, profile from token', async () => {
        mockSvc.listForPatient.mockResolvedValue([{ id: 'r1', medication: 'Metformine' }]);
        const res = await request(app).get('/api/reminders').set(...AUTH);
        expect(res.statusCode).toBe(200);
        expect(res.body.reminders).toHaveLength(1);
        expect(mockSvc.listForPatient.mock.calls[0][0]).toBe('pp-1');
    });
});

describe('POST /api/reminders/:id/ack', () => {
    test('acknowledges with ownership scope', async () => {
        mockSvc.acknowledge.mockResolvedValue({ id: 'r1', status: 'taken' });
        const res = await request(app).post('/api/reminders/r1/ack').set(...AUTH)
            .send({ status: 'taken' });
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('taken');
        expect(mockSvc.acknowledge).toHaveBeenCalledWith('r1', 'taken', 'pp-1');
    });

    test('404 when service finds nothing (wrong owner / missing)', async () => {
        mockSvc.acknowledge.mockResolvedValue(null);
        const res = await request(app).post('/api/reminders/ghost/ack').set(...AUTH)
            .send({ status: 'skipped' });
        expect(res.statusCode).toBe(404);
    });

    test('400 on invalid status (Zod)', async () => {
        const res = await request(app).post('/api/reminders/r1/ack').set(...AUTH)
            .send({ status: 'devoured' });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Validation Failed');
        expect(mockSvc.acknowledge).not.toHaveBeenCalled();
    });
});

describe('POST /api/reminders/:id/snooze', () => {
    test('snoozes and returns the child reminder', async () => {
        mockSvc.snooze.mockResolvedValue({ id: 'child-1', scheduled_at_utc: '2026-06-15T10:15:00Z' });
        const res = await request(app).post('/api/reminders/r1/snooze').set(...AUTH)
            .send({ minutes: 30 });
        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ snoozed: true, next: { id: 'child-1' } });
        expect(mockSvc.snooze).toHaveBeenCalledWith('r1', 30, 'pp-1');
    });

    test('defaults minutes to 15 when omitted', async () => {
        mockSvc.snooze.mockResolvedValue({ id: 'child-1' });
        await request(app).post('/api/reminders/r1/snooze').set(...AUTH).send({});
        expect(mockSvc.snooze).toHaveBeenCalledWith('r1', 15, 'pp-1');
    });

    test('400 on out-of-range minutes', async () => {
        const res = await request(app).post('/api/reminders/r1/snooze').set(...AUTH)
            .send({ minutes: 2 });
        expect(res.statusCode).toBe(400);
        expect(mockSvc.snooze).not.toHaveBeenCalled();
    });
});
