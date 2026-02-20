const request = require('supertest');

// --- Mock auth middleware ---
jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
    req.user = { uid: 'test_uid', email: 'test@example.com' };
    next();
});

// --- Mock database service ---
const mockGetAppointments = jest.fn();
const mockCreateAppointment = jest.fn();
const mockUpdateAppointment = jest.fn();

jest.mock('../services/database', () => ({
    getAppointments: mockGetAppointments,
    createAppointment: mockCreateAppointment,
    updateAppointment: mockUpdateAppointment,
    // Stubs for other controllers loaded via server.js
    getPatients: jest.fn().mockResolvedValue([]),
    getPatientById: jest.fn(),
    createPatient: jest.fn(),
    getPatientsByDoctorId: jest.fn().mockResolvedValue([]),
    getDoctors: jest.fn().mockResolvedValue([]),
    getVitals: jest.fn().mockResolvedValue([]),
    migrateToFirestore: jest.fn().mockResolvedValue(undefined),
}));

// --- Mock notification service ---
const mockCreateNotification = jest.fn().mockResolvedValue({ id: 'notif_1' });
jest.mock('../services/notificationService', () => ({
    createNotification: mockCreateNotification
}));

// --- Mock firebaseConfig (used by appointmentController for _notifyDoctor/_notifyPatient) ---
const mockFirestoreDocGet = jest.fn();
jest.mock('../config/firebaseConfig', () => ({
    db: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: mockFirestoreDocGet,
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

// --- Mock firebase-admin (used by _notifyDoctor/_notifyPatient) ---
jest.mock('firebase-admin', () => ({
    auth: jest.fn(() => ({
        getUserByEmail: jest.fn().mockResolvedValue({ uid: 'doctor_uid_123' })
    })),
    messaging: jest.fn(() => ({
        sendEachForMulticast: jest.fn().mockResolvedValue({ failureCount: 0, responses: [] })
    }))
}));

// --- Mock config/firebase (used by doctorController) ---
jest.mock('../config/firebase', () => ({
    db: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: false })
            })),
            where: jest.fn(() => ({
                limit: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ empty: true, docs: [] })
                }))
            })),
            get: jest.fn().mockResolvedValue({ empty: true, docs: [], forEach: jest.fn() }),
            add: jest.fn().mockResolvedValue({ id: 'new_id' })
        }))
    }
}));

const { app } = require('../server');

describe('Appointment Conflict Detection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAppointments.mockResolvedValue([]);
        mockFirestoreDocGet.mockResolvedValue({ exists: false });
    });

    describe('POST /api/appointments — createNewAppointment', () => {
        const validBody = {
            patientId: '1',
            patientName: 'Jean Mbala',
            doctorId: 'doc_1',
            date: '2026-03-15',
            time: '09:00',
            reason: 'Consultation'
        };

        it('creates appointment successfully when no conflicts (201)', async () => {
            mockCreateAppointment.mockResolvedValue({ id: 'apt_1', ...validBody, status: 'pending' });

            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send(validBody);

            expect(res.statusCode).toBe(201);
            expect(res.body.id).toBe('apt_1');
            expect(mockCreateAppointment).toHaveBeenCalled();
        });

        it('returns 409 when same doctor+date+time is already booked', async () => {
            mockGetAppointments.mockResolvedValue([
                { date: '2026-03-15', time: '09:00', status: 'confirmed' }
            ]);

            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send(validBody);

            expect(res.statusCode).toBe(409);
            expect(res.body.message).toMatch(/réservé/i);
            expect(mockCreateAppointment).not.toHaveBeenCalled();
        });

        it('detects conflict for pending status', async () => {
            mockGetAppointments.mockResolvedValue([
                { date: '2026-03-15', time: '09:00', status: 'pending' }
            ]);

            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send(validBody);

            expect(res.statusCode).toBe(409);
        });

        it('detects conflict for Scheduled status (capital S)', async () => {
            mockGetAppointments.mockResolvedValue([
                { date: '2026-03-15', time: '09:00', status: 'Scheduled' }
            ]);

            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send(validBody);

            expect(res.statusCode).toBe(409);
        });

        it('does not conflict with completed appointments', async () => {
            mockGetAppointments.mockResolvedValue([
                { date: '2026-03-15', time: '09:00', status: 'completed' }
            ]);
            mockCreateAppointment.mockResolvedValue({ id: 'apt_2', ...validBody, status: 'pending' });

            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send(validBody);

            expect(res.statusCode).toBe(201);
        });

        it('does not conflict with rejected appointments', async () => {
            mockGetAppointments.mockResolvedValue([
                { date: '2026-03-15', time: '09:00', status: 'rejected' }
            ]);
            mockCreateAppointment.mockResolvedValue({ id: 'apt_3', ...validBody, status: 'pending' });

            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send(validBody);

            expect(res.statusCode).toBe(201);
        });

        it('returns 400 when required fields are missing', async () => {
            const bodies = [
                { doctorId: 'doc_1', date: '2026-03-15', time: '09:00' },       // missing patientId
                { patientId: '1', doctorId: 'doc_1', time: '09:00' },           // missing date
                { patientId: '1', doctorId: 'doc_1', date: '2026-03-15' },      // missing time
            ];

            for (const body of bodies) {
                const res = await request(app)
                    .post('/api/appointments')
                    .set('Authorization', 'Bearer token')
                    .send(body);
                expect(res.statusCode).toBe(400);
            }
        });

        it('fires notification to doctor on successful creation', async () => {
            mockCreateAppointment.mockResolvedValue({ id: 'apt_4', ...validBody, status: 'pending' });

            // Setup doctor doc to be found for notification
            mockFirestoreDocGet.mockResolvedValue({
                exists: true,
                data: () => ({ contact: { email: 'doctor@example.com' } })
            });

            await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send(validBody);

            // Give fire-and-forget notification time to execute
            await new Promise(r => setTimeout(r, 100));

            expect(mockCreateNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'appointment_new',
                    userId: 'doctor_uid_123'
                })
            );
        });

        it('does not crash when notification fails', async () => {
            mockCreateAppointment.mockResolvedValue({ id: 'apt_5', ...validBody, status: 'pending' });
            mockFirestoreDocGet.mockRejectedValue(new Error('Firestore down'));

            const res = await request(app)
                .post('/api/appointments')
                .set('Authorization', 'Bearer token')
                .send(validBody);

            // Should still return 201 despite notification failure
            expect(res.statusCode).toBe(201);
        });
    });

    describe('PUT /api/appointments/:id — updateAppointmentDetails', () => {
        it('returns 400 for invalid status', async () => {
            const res = await request(app)
                .put('/api/appointments/apt_1')
                .set('Authorization', 'Bearer token')
                .send({ status: 'invalid_status' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/Invalid status/i);
        });

        it('accepts valid status values', async () => {
            const validStatuses = ['confirmed', 'rejected', 'completed', 'pending'];

            for (const status of validStatuses) {
                mockUpdateAppointment.mockResolvedValue({
                    id: 'apt_1', status, patientId: '1', date: '2026-03-15'
                });

                const res = await request(app)
                    .put('/api/appointments/apt_1')
                    .set('Authorization', 'Bearer token')
                    .send({ status });

                expect(res.statusCode).toBe(200);
            }
        });

        it('returns 404 when appointment not found', async () => {
            mockUpdateAppointment.mockResolvedValue(null);

            const res = await request(app)
                .put('/api/appointments/nonexistent')
                .set('Authorization', 'Bearer token')
                .send({ status: 'confirmed' });

            expect(res.statusCode).toBe(404);
        });

        it('notifies patient on confirmed status', async () => {
            mockUpdateAppointment.mockResolvedValue({
                id: 'apt_1', status: 'confirmed', patientId: '1', date: '2026-03-15'
            });
            mockFirestoreDocGet.mockResolvedValue({
                exists: true,
                data: () => ({ email: 'patient@example.com' })
            });

            await request(app)
                .put('/api/appointments/apt_1')
                .set('Authorization', 'Bearer token')
                .send({ status: 'confirmed' });

            await new Promise(r => setTimeout(r, 100));

            expect(mockCreateNotification).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'appointment_confirmed' })
            );
        });

        it('notifies patient on rejected status', async () => {
            mockUpdateAppointment.mockResolvedValue({
                id: 'apt_1', status: 'rejected', patientId: '1', date: '2026-03-15'
            });
            mockFirestoreDocGet.mockResolvedValue({
                exists: true,
                data: () => ({ email: 'patient@example.com' })
            });

            await request(app)
                .put('/api/appointments/apt_1')
                .set('Authorization', 'Bearer token')
                .send({ status: 'rejected' });

            await new Promise(r => setTimeout(r, 100));

            expect(mockCreateNotification).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'appointment_rejected' })
            );
        });

        it('does not notify on completed or pending status', async () => {
            for (const status of ['completed', 'pending']) {
                mockCreateNotification.mockClear();
                mockUpdateAppointment.mockResolvedValue({
                    id: 'apt_1', status, patientId: '1', date: '2026-03-15'
                });

                await request(app)
                    .put('/api/appointments/apt_1')
                    .set('Authorization', 'Bearer token')
                    .send({ status });

                await new Promise(r => setTimeout(r, 50));
                expect(mockCreateNotification).not.toHaveBeenCalled();
            }
        });
    });
});
