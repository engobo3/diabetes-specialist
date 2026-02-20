const request = require('supertest');

// --- Mock auth middleware ---
jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
    if (req.headers['authorization']) {
        req.user = { uid: 'test_uid', email: 'test@example.com' };
        next();
    } else {
        res.status(403).json({ message: 'Forbidden' });
    }
});

// --- Mock doctor controller ---
const mockGetAvailableSlots = jest.fn((req, res) => {
    res.json({ slots: ['09:00', '09:30'], slotDuration: 30, date: req.query.date });
});
const mockGetDoctorById = jest.fn((req, res) => {
    res.json({ id: req.params.id, name: 'Dr. Test' });
});

jest.mock('../controllers/doctorController', () => ({
    getDoctors: jest.fn((req, res) => res.json([])),
    getDoctorById: mockGetDoctorById,
    lookupDoctorByEmail: jest.fn((req, res) => res.json({})),
    addDoctor: jest.fn((req, res) => res.status(201).json({})),
    updateDoctor: jest.fn((req, res) => res.json({})),
    deleteDoctor: jest.fn((req, res) => res.json({})),
    getAvailableSlots: mockGetAvailableSlots
}));

// --- Stubs for other modules ---
jest.mock('../config/firebase', () => ({
    db: { collection: jest.fn(() => ({ doc: jest.fn(), where: jest.fn(), get: jest.fn() })) }
}));
jest.mock('../config/firebaseConfig', () => ({
    db: { collection: jest.fn(() => ({ doc: jest.fn(), where: jest.fn(), get: jest.fn() })) }
}));
jest.mock('../services/database', () => ({
    getPatients: jest.fn().mockResolvedValue([]),
    getPatientById: jest.fn(),
    createPatient: jest.fn(),
    getPatientsByDoctorId: jest.fn().mockResolvedValue([]),
    getDoctors: jest.fn().mockResolvedValue([]),
    getAppointments: jest.fn().mockResolvedValue([]),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    getVitals: jest.fn().mockResolvedValue([]),
    migrateToFirestore: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/notificationService', () => ({
    createNotification: jest.fn().mockResolvedValue(null)
}));

const { app } = require('../server');

describe('Doctor Slot Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('GET /api/doctors/:id/slots calls getAvailableSlots', async () => {
        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');

        expect(res.statusCode).toBe(200);
        expect(mockGetAvailableSlots).toHaveBeenCalled();
        expect(res.body.slots).toEqual(['09:00', '09:30']);
    });

    it('slots route is public (no auth required)', async () => {
        // No Authorization header
        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');

        expect(res.statusCode).toBe(200);
        expect(mockGetAvailableSlots).toHaveBeenCalled();
    });

    it('slots route matches before /:id route', async () => {
        // This tests that /api/doctors/doc_1/slots is NOT caught by /:id
        const res = await request(app).get('/api/doctors/doc_1/slots?date=2026-03-09');

        expect(mockGetAvailableSlots).toHaveBeenCalled();
        expect(mockGetDoctorById).not.toHaveBeenCalled();
    });

    it('/:id route still works for plain doctor lookup', async () => {
        const res = await request(app).get('/api/doctors/doc_1');

        expect(mockGetDoctorById).toHaveBeenCalled();
        expect(mockGetAvailableSlots).not.toHaveBeenCalled();
    });
});
