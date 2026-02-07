const request = require('supertest');
const { app } = require('../server');

// Mock Auth Middleware
jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
    if (req.headers['authorization']) {
        req.user = { uid: 'doctor_123', email: 'doc@test.com' }; // Simulate logged in doctor
        next();
    } else {
        res.status(403).json({ message: 'Forbidden' });
    }
});

// Mock Controllers
jest.mock('../controllers/messageController', () => ({
    sendMessage: jest.fn((req, res) => res.status(201).json({ success: true, data: { id: 'msg_1', ...req.body } })),
    getConversationMessages: jest.fn((req, res) => res.json([])),
    markMessageAsRead: jest.fn((req, res) => res.json({ success: true }))
}));

jest.mock('../controllers/patientController', () => ({
    updatePatient: jest.fn((req, res) => res.json({ id: req.params.id, ...req.body })),
    addPatientVital: jest.fn((req, res) => res.status(201).json({ id: 'vital_1', ...req.body })),
    // Add other required exports to avoid crashes if routes import them
    getPatients: jest.fn(),
    getPatientById: jest.fn(),
    getPatientByEmail: jest.fn(),
    getPatientVitals: jest.fn(),
    createPatient: jest.fn(),
    deletePatient: jest.fn(),
    getDocuments: jest.fn(),
    addDocument: jest.fn()
}));

jest.mock('../controllers/prescriptionController', () => ({
    addPrescription: jest.fn((req, res) => res.status(201).json({ id: 'rx_1', ...req.body })),
    getPatientPrescriptions: jest.fn()
}));

describe('Doctor Workflow Tests', () => {

    const validToken = 'Bearer valid_token';

    describe('Messaging Flow', () => {
        it('Doctor can send a message to a patient', async () => {
            const messageData = {
                senderId: 'doctor_123',
                receiverId: 'patient_456',
                text: 'Please come in for a checkup.',
                timestamp: new Date().toISOString()
            };

            const res = await request(app)
                .post('/api/messages')
                .set('Authorization', validToken)
                .send(messageData);

            expect(res.statusCode).toBe(201);
            expect(res.body.data).toMatchObject(messageData);
        });

        it('Sending message requires auth', async () => {
            const res = await request(app)
                .post('/api/messages')
                .send({ text: 'Hello' });
            expect(res.statusCode).toBe(403);
        });
    });

    describe('Medical Records Update Flow', () => {
        it('Doctor can update patient details', async () => {
            const updateData = { status: 'Critical', notes: 'Patient condition worsening.' };

            const res = await request(app)
                .put('/api/patients/patient_456')
                .set('Authorization', validToken)
                .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body).toMatchObject(updateData);
        });

        it('Doctor can add vital signs', async () => {
            const vitalData = {
                type: 'Blood Pressure',
                value: '120/80',
                date: new Date().toISOString()
            };

            const res = await request(app)
                .post('/api/patients/patient_456/vitals')
                .set('Authorization', validToken)
                .send(vitalData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toMatchObject(vitalData);
        });

        it('Doctor can add a prescription', async () => {
            const rxData = {
                patientId: 'patient_456',
                medication: 'Metformin',
                dosage: '500mg',
                instructions: 'Twice daily'
            };

            const res = await request(app)
                .post('/api/prescriptions')
                .set('Authorization', validToken)
                .send(rxData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toMatchObject(rxData);
        });

        it('Updating records requires auth', async () => {
            const res = await request(app)
                .post('/api/patients/123/vitals')
                .send({ value: '120/80' });
            expect(res.statusCode).toBe(403);
        });
    });

});
