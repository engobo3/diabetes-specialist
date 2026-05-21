const request = require('supertest');
const { app } = require('../server'); // Import the app

// Mock the middleware and controller to isolate route config.
// Admin role so RBAC checks (requireRole('admin') on POST/DELETE) pass.
jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
    if (req.headers['authorization']) {
        req.user = { uid: 'test_admin_uid', email: 'admin@test.com', role: 'admin' };
        next();
    } else {
        res.status(403).json({ message: 'Forbidden' });
    }
});

const doctorController = require('../controllers/doctorController');

// Mock controller methods
jest.mock('../controllers/doctorController', () => ({
    getDoctors: jest.fn((req, res) => res.json([{ id: 1, name: 'Dr. Test' }])),
    getDoctorById: jest.fn((req, res) => res.json({ id: 1, name: 'Dr. Test' })),
    lookupDoctorByEmail: jest.fn((req, res) => res.json({ id: 1, name: 'Dr. Test' })),
    addDoctor: jest.fn((req, res) => res.status(201).json({ id: 2, ...req.body })),
    updateDoctor: jest.fn((req, res) => res.json({ id: req.params.id, ...req.body })),
    deleteDoctor: jest.fn((req, res) => res.json({ message: 'Deleted' })),
    getAvailableSlots: jest.fn((req, res) => res.json({ slots: [], message: 'No slots available' })),
}));

describe('Doctor Routes', () => {

    describe('Public Routes', () => {
        it('GET /api/doctors should be public', async () => {
            const res = await request(app).get('/api/doctors');
            expect(res.statusCode).toBe(200);
            expect(doctorController.getDoctors).toHaveBeenCalled();
        });

        it('GET /api/doctors/:id should be public', async () => {
            const res = await request(app).get('/api/doctors/1');
            expect(res.statusCode).toBe(200);
            expect(doctorController.getDoctorById).toHaveBeenCalled();
        });
    });

    describe('Protected Routes (Security Check)', () => {
        it('POST /api/doctors should fail without token', async () => {
            const res = await request(app).post('/api/doctors').send({ name: 'New Doc' });
            expect(res.statusCode).toBe(403);
            expect(doctorController.addDoctor).not.toHaveBeenCalled();
        });

        it('POST /api/doctors should pass with token and valid body', async () => {
            const res = await request(app)
                .post('/api/doctors')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    name: 'New Doc',
                    specialty: 'Endocrinology',
                    city: 'Kinshasa',
                    contact: { email: 'newdoc@example.com' }
                });
            expect(res.statusCode).toBe(201);
        });

        it('POST /api/doctors should reject with 400 on missing required fields', async () => {
            const res = await request(app)
                .post('/api/doctors')
                .set('Authorization', 'Bearer valid_token')
                .send({ name: 'New Doc' }); // missing specialty + city
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Validation Failed');
        });

        it('DELETE /api/doctors/:id should fail without token', async () => {
            const res = await request(app).delete('/api/doctors/1');
            expect(res.statusCode).toBe(403);
            expect(doctorController.deleteDoctor).not.toHaveBeenCalled();
        });

        it('DELETE /api/doctors/:id should pass with token', async () => {
            const res = await request(app)
                .delete('/api/doctors/1')
                .set('Authorization', 'Bearer valid_token');
            expect(res.statusCode).toBe(200);
        });
    });
});
