const request = require('supertest');

// --- Mock auth middleware (checks for Authorization header) ---
jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
    if (req.headers['authorization']) {
        req.user = { uid: 'test_uid_123', email: 'test@example.com' };
        next();
    } else {
        res.status(403).json({ message: 'No Token Provided' });
    }
});

// --- Mock notification controller ---
jest.mock('../controllers/notificationController', () => ({
    getNotifications: jest.fn((req, res) => res.json([{ id: 'n1', title: 'Test' }])),
    getUnreadCount: jest.fn((req, res) => res.json({ count: 5 })),
    markAsRead: jest.fn((req, res) => res.json({ id: req.params.id, read: true })),
    markAllAsRead: jest.fn((req, res) => res.json({ updated: 3 })),
    registerToken: jest.fn((req, res) => {
        if (!req.body.token) return res.status(400).json({ message: 'Token is required' });
        res.json({ success: true });
    })
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
const notificationController = require('../controllers/notificationController');

describe('Notification Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Authenticated Requests', () => {
        it('GET /api/notifications returns notification list', async () => {
            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', 'Bearer token');

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual([{ id: 'n1', title: 'Test' }]);
            expect(notificationController.getNotifications).toHaveBeenCalled();
        });

        it('GET /api/notifications/unread-count returns count object', async () => {
            const res = await request(app)
                .get('/api/notifications/unread-count')
                .set('Authorization', 'Bearer token');

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ count: 5 });
            expect(notificationController.getUnreadCount).toHaveBeenCalled();
        });

        it('PUT /api/notifications/read-all calls markAllAsRead', async () => {
            const res = await request(app)
                .put('/api/notifications/read-all')
                .set('Authorization', 'Bearer token')
                .send({});

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ updated: 3 });
            expect(notificationController.markAllAsRead).toHaveBeenCalled();
        });

        it('PUT /api/notifications/:id/read calls markAsRead with correct ID', async () => {
            const res = await request(app)
                .put('/api/notifications/notif_abc/read')
                .set('Authorization', 'Bearer token')
                .send({});

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ id: 'notif_abc', read: true });
            expect(notificationController.markAsRead).toHaveBeenCalled();
        });

        it('POST /api/notifications/register-token with valid token succeeds', async () => {
            const res = await request(app)
                .post('/api/notifications/register-token')
                .set('Authorization', 'Bearer token')
                .send({ token: 'fcm_token_abc' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true });
            expect(notificationController.registerToken).toHaveBeenCalled();
        });

        it('POST /api/notifications/register-token without token returns 400', async () => {
            const res = await request(app)
                .post('/api/notifications/register-token')
                .set('Authorization', 'Bearer token')
                .send({});

            expect(res.statusCode).toBe(400);
        });
    });

    describe('Unauthenticated Requests', () => {
        it('rejects all routes without authorization header', async () => {
            const routes = [
                { method: 'get', path: '/api/notifications' },
                { method: 'get', path: '/api/notifications/unread-count' },
                { method: 'put', path: '/api/notifications/read-all' },
                { method: 'put', path: '/api/notifications/n1/read' },
                { method: 'post', path: '/api/notifications/register-token' }
            ];

            for (const route of routes) {
                let req = request(app)[route.method](route.path);
                // PUT/POST need a body to avoid 415 Unsupported Media Type
                if (route.method === 'put' || route.method === 'post') {
                    req = req.send({});
                }
                const res = await req;
                expect(res.statusCode).toBe(403);
            }
        });
    });
});
