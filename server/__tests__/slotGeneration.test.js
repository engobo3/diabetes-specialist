const request = require('supertest');

// --- Mock firebase (db) for doctorController ---
const mockDocGet = jest.fn();
const mockWhereGet = jest.fn();

jest.mock('../config/firebase', () => ({
    db: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: mockDocGet
            })),
            where: jest.fn(() => ({
                limit: jest.fn(() => ({
                    get: mockWhereGet
                }))
            }))
        }))
    }
}));

// --- Mock database service ---
const mockGetAppointments = jest.fn();
jest.mock('../services/database', () => ({
    getAppointments: mockGetAppointments,
    // Stub remaining exports needed by other controllers loaded via server.js
    getPatients: jest.fn().mockResolvedValue([]),
    getPatientById: jest.fn(),
    createPatient: jest.fn(),
    getPatientsByDoctorId: jest.fn().mockResolvedValue([]),
    getDoctors: jest.fn().mockResolvedValue([]),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    getVitals: jest.fn().mockResolvedValue([]),
    migrateToFirestore: jest.fn().mockResolvedValue(undefined),
}));

// --- Mock auth middleware ---
jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
    req.user = { uid: 'test_uid', email: 'test@example.com' };
    next();
});

// --- Mock notification service (used by appointmentController) ---
jest.mock('../services/notificationService', () => ({
    createNotification: jest.fn().mockResolvedValue(null)
}));

// --- Mock firebaseConfig (used by appointmentController, notificationController) ---
jest.mock('../config/firebaseConfig', () => ({
    db: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: false }),
                set: jest.fn().mockResolvedValue(undefined)
            })),
            where: jest.fn(() => ({
                limit: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ empty: true, docs: [] })
                })),
                get: jest.fn().mockResolvedValue({ empty: true, docs: [], data: () => ({ count: 0 }) })
            }))
        }))
    }
}));

const { app } = require('../server');

// Helper to set up doctor data in mock
const setupDoctor = (doctorData, exists = true) => {
    mockDocGet.mockResolvedValue({
        exists,
        data: () => doctorData,
        id: 'doc_1'
    });
};

describe('getAvailableSlots', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAppointments.mockResolvedValue([]);
        mockWhereGet.mockResolvedValue({ empty: true, docs: [] });
    });

    it('generates correct slots from a single time range', async () => {
        setupDoctor({
            availability: { monday: [{ start: '08:00', end: '10:00' }] },
            slotDuration: 30
        });

        // 2026-03-09 is a Monday
        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.statusCode).toBe(200);
        expect(res.body.slots).toEqual(['08:00', '08:30', '09:00', '09:30']);
        expect(res.body.slotDuration).toBe(30);
        expect(res.body.date).toBe('2026-03-09');
    });

    it('generates slots from multiple ranges in one day', async () => {
        setupDoctor({
            availability: {
                monday: [
                    { start: '08:00', end: '10:00' },
                    { start: '14:00', end: '16:00' }
                ]
            },
            slotDuration: 30
        });

        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.statusCode).toBe(200);
        expect(res.body.slots).toEqual([
            '08:00', '08:30', '09:00', '09:30',
            '14:00', '14:30', '15:00', '15:30'
        ]);
    });

    it('generates slots with custom slotDuration (15 min)', async () => {
        setupDoctor({
            availability: { monday: [{ start: '09:00', end: '10:00' }] },
            slotDuration: 15
        });

        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.statusCode).toBe(200);
        expect(res.body.slots).toEqual(['09:00', '09:15', '09:30', '09:45']);
    });

    it('handles slot duration that does not fit evenly', async () => {
        setupDoctor({
            availability: { monday: [{ start: '09:00', end: '10:00' }] },
            slotDuration: 40
        });

        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.statusCode).toBe(200);
        // 09:00 + 40 = 09:40, 09:40 + 40 = 10:20 > 10:00 → only 1 slot
        expect(res.body.slots).toEqual(['09:00']);
    });

    it('subtracts booked appointments from available slots', async () => {
        setupDoctor({
            availability: { monday: [{ start: '09:00', end: '10:30' }] },
            slotDuration: 30
        });

        mockGetAppointments.mockResolvedValue([
            { date: '2026-03-09', time: '09:30', status: 'confirmed' }
        ]);

        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.statusCode).toBe(200);
        expect(res.body.slots).toEqual(['09:00', '10:00']);
        expect(res.body.slots).not.toContain('09:30');
    });

    it('only subtracts active statuses (pending, confirmed, Scheduled)', async () => {
        setupDoctor({
            availability: { monday: [{ start: '09:00', end: '10:00' }] },
            slotDuration: 30
        });

        mockGetAppointments.mockResolvedValue([
            { date: '2026-03-09', time: '09:00', status: 'pending' },
            { date: '2026-03-09', time: '09:30', status: 'Scheduled' }
        ]);

        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.body.slots).toEqual([]); // both blocked
    });

    it('does not subtract completed or rejected appointments', async () => {
        setupDoctor({
            availability: { monday: [{ start: '09:00', end: '10:00' }] },
            slotDuration: 30
        });

        mockGetAppointments.mockResolvedValue([
            { date: '2026-03-09', time: '09:00', status: 'completed' },
            { date: '2026-03-09', time: '09:30', status: 'rejected' }
        ]);

        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.body.slots).toEqual(['09:00', '09:30']); // both available
    });

    it('returns empty slots when doctor has no availability for the requested day', async () => {
        setupDoctor({
            availability: { monday: [{ start: '09:00', end: '12:00' }] },
            slotDuration: 30
        });

        // 2026-03-10 is a Tuesday
        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-10');
        expect(res.statusCode).toBe(200);
        expect(res.body.slots).toEqual([]);
        expect(res.body.message).toMatch(/non disponible/i);
    });

    it('returns empty slots when doctor has no availability field at all', async () => {
        setupDoctor({ name: 'Dr. Test' }); // no availability

        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.statusCode).toBe(200);
        expect(res.body.slots).toEqual([]);
    });

    it('defaults to 30-minute slotDuration when not set', async () => {
        setupDoctor({
            availability: { monday: [{ start: '08:00', end: '09:00' }] }
            // no slotDuration
        });

        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');
        expect(res.statusCode).toBe(200);
        expect(res.body.slots).toEqual(['08:00', '08:30']);
        expect(res.body.slotDuration).toBe(30);
    });

    it('returns 404 when doctor is not found', async () => {
        mockDocGet.mockResolvedValue({ exists: false });
        mockWhereGet.mockResolvedValue({ empty: true, docs: [] });

        const res = await request(app).get('/api/doctors/nonexistent/slots?date=2026-03-09');
        expect(res.statusCode).toBe(404);
    });

    it('returns 400 when date query param is missing', async () => {
        const res = await request(app).get('/api/doctors/doc_1/slots');
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Date/i);
    });

    it('falls back to legacy integer ID lookup', async () => {
        mockDocGet.mockResolvedValue({ exists: false });

        const legacyDoc = {
            exists: true,
            data: () => ({
                availability: { monday: [{ start: '10:00', end: '11:00' }] },
                slotDuration: 30
            }),
            id: 'legacy_doc'
        };
        mockWhereGet.mockResolvedValue({
            empty: false,
            docs: [legacyDoc]
        });

        const res = await request(app).get('/api/doctors/42/slots?date=2026-03-09');
        expect(res.statusCode).toBe(200);
        expect(res.body.slots).toEqual(['10:00', '10:30']);
    });
});
