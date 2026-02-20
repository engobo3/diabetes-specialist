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

// --- Mock appointment controller ---
const mockGetAll = jest.fn((req, res) => res.json([]));
const mockCreate = jest.fn((req, res) => res.status(201).json({ id: 'apt_1', ...req.body }));
const mockUpdate = jest.fn((req, res) => res.json({ id: req.params.id, ...req.body }));

jest.mock('../controllers/appointmentController', () => ({
    getAllAppointments: mockGetAll,
    createNewAppointment: mockCreate,
    updateAppointmentDetails: mockUpdate
}));

// --- Stubs for other modules loaded by server.js ---
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

describe('Appointment Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Authenticated Requests', () => {
        it('GET /api/appointments calls getAllAppointments', async () => {
            const res = await request(app)
                .get('/api/appointments')
                .set('Authorization', 'Bearer token');

            expect(res.statusCode).toBe(200);
            expect(mockGetAll).toHaveBeenCalled();
        });

        it('POST /api/appointments calls createNewAppointment', async () => {
            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send({ patientId: '1', date: '2026-03-15', time: '09:00' });

            expect(res.statusCode).toBe(201);
            expect(mockCreate).toHaveBeenCalled();
        });

        it('PUT /api/appointments/:id calls updateAppointmentDetails with correct param', async () => {
            const res = await request(app)
                .put('/api/appointments/apt_1')
                .set('Authorization', 'Bearer token')
                .send({ status: 'confirmed' });

            expect(res.statusCode).toBe(200);
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('Unauthenticated Requests', () => {
        it('rejects GET without auth', async () => {
            const res = await request(app).get('/api/appointments');
            expect(res.statusCode).toBe(403);
            expect(mockGetAll).not.toHaveBeenCalled();
        });

        it('rejects POST without auth', async () => {
            const res = await request(app).post('/api/appointments').send({ patientId: '1' });
            expect(res.statusCode).toBe(403);
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('rejects PUT without auth', async () => {
            const res = await request(app).put('/api/appointments/apt_1').send({ status: 'confirmed' });
            expect(res.statusCode).toBe(403);
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });
});
