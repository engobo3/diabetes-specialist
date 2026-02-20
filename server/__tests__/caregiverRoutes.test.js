const request = require('supertest');
const { app } = require('../server');

// Mock the auth middleware
jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
  if (req.headers['authorization']) {
    req.user = {
      email: 'test@example.com',
      role: 'patient',
      patientId: 1
    };
    next();
  } else {
    res.status(403).json({ message: 'Forbidden' });
  }
});

// Mock the controller
const caregiverController = require('../controllers/caregiverController');
jest.mock('../controllers/caregiverController', () => ({
  inviteCaregiver: jest.fn((req, res) => res.status(201).json({
    id: 'inv123',
    caregiverEmail: req.body.caregiverEmail
  })),
  getInvitationByToken: jest.fn((req, res) => res.json({
    id: 'inv123',
    patientName: 'Jane Doe',
    caregiverEmail: 'caregiver@example.com'
  })),
  getPendingInvitations: jest.fn((req, res) => res.json([
    { id: 'inv1', caregiverEmail: req.query.email }
  ])),
  getPatientInvitations: jest.fn((req, res) => res.json([
    { id: 'inv1', patientId: req.params.patientId }
  ])),
  getPendingApprovalsForDoctor: jest.fn((req, res) => res.json([
    { id: 'inv1', doctorId: req.query.doctorId }
  ])),
  acceptInvitation: jest.fn((req, res) => res.json({
    success: true,
    patient: { name: 'Jane Doe' }
  })),
  rejectInvitation: jest.fn((req, res) => res.json({ success: true })),
  cancelInvitation: jest.fn((req, res) => res.json({ success: true })),
  approveInvitation: jest.fn((req, res) => res.json({
    id: req.params.id,
    doctorApproved: req.body.approved
  })),
  getPatientCaregivers: jest.fn((req, res) => res.json([
    { email: 'caregiver@example.com', relationship: 'parent' }
  ])),
  updateCaregiverPermissions: jest.fn((req, res) => res.json({
    updated: true
  })),
  removeCaregiver: jest.fn((req, res) => res.json({ success: true }))
}));

describe('Caregiver Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/caregivers/invite', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/caregivers/invite')
        .send({ patientId: 1, caregiverEmail: 'caregiver@example.com' });

      expect(res.statusCode).toBe(403);
    });

    it('should create invitation with token', async () => {
      const res = await request(app)
        .post('/api/caregivers/invite')
        .set('Authorization', 'Bearer token')
        .send({
          patientId: 1,
          caregiverEmail: 'caregiver@example.com',
          relationship: 'parent'
        });

      expect(res.statusCode).toBe(201);
      expect(caregiverController.inviteCaregiver).toHaveBeenCalled();
      expect(res.body.caregiverEmail).toBe('caregiver@example.com');
    });
  });

  describe('GET /api/caregivers/invitations/:token', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/caregivers/invitations/sometoken123');

      expect(res.statusCode).toBe(403);
    });

    it('should return invitation details with auth', async () => {
      const res = await request(app)
        .get('/api/caregivers/invitations/sometoken123')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(caregiverController.getInvitationByToken).toHaveBeenCalled();
      expect(res.body.patientName).toBe('Jane Doe');
      expect(res.body.caregiverEmail).toBe('caregiver@example.com');
    });
  });

  describe('GET /api/caregivers/invitations/pending', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/caregivers/invitations/pending?email=test@example.com');

      expect(res.statusCode).toBe(403);
    });

    it('should return invitations for email with auth', async () => {
      const res = await request(app)
        .get('/api/caregivers/invitations/pending?email=test@example.com')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(caregiverController.getPendingInvitations).toHaveBeenCalled();
      expect(res.body).toHaveLength(1);
      expect(res.body[0].caregiverEmail).toBe('test@example.com');
    });
  });

  describe('GET /api/caregivers/invitations/patient/:patientId', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/caregivers/invitations/patient/1');

      expect(res.statusCode).toBe(403);
    });

    it('should return patient invitations with auth', async () => {
      const res = await request(app)
        .get('/api/caregivers/invitations/patient/1')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(caregiverController.getPatientInvitations).toHaveBeenCalled();
    });
  });

  describe('POST /api/caregivers/invitations/:id/accept', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/caregivers/invitations/inv123/accept')
        .send({});

      expect(res.statusCode).toBe(403);
    });

    it('should accept invitation with auth', async () => {
      const res = await request(app)
        .post('/api/caregivers/invitations/inv123/accept')
        .set('Authorization', 'Bearer token')
        .send({ caregiverName: 'John Doe' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(caregiverController.acceptInvitation).toHaveBeenCalled();
    });
  });

  describe('POST /api/caregivers/invitations/:id/approve', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/caregivers/invitations/inv123/approve')
        .send({ approved: true });

      expect(res.statusCode).toBe(403);
    });

    it('should approve invitation with auth', async () => {
      const res = await request(app)
        .post('/api/caregivers/invitations/inv123/approve')
        .set('Authorization', 'Bearer token')
        .send({ approved: true, notes: 'Approved' });

      expect(res.statusCode).toBe(200);
      expect(res.body.doctorApproved).toBe(true);
      expect(caregiverController.approveInvitation).toHaveBeenCalled();
    });
  });

  describe('GET /api/caregivers/patients/:patientId/caregivers', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/caregivers/patients/1/caregivers');

      expect(res.statusCode).toBe(403);
    });

    it('should return caregivers list with auth', async () => {
      const res = await request(app)
        .get('/api/caregivers/patients/1/caregivers')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].email).toBe('caregiver@example.com');
    });
  });

  describe('DELETE /api/caregivers/:patientId/:caregiverEmail', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .delete('/api/caregivers/1/caregiver@example.com');

      expect(res.statusCode).toBe(403);
    });

    it('should remove caregiver with auth', async () => {
      const res = await request(app)
        .delete('/api/caregivers/1/caregiver@example.com')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(caregiverController.removeCaregiver).toHaveBeenCalled();
    });
  });

  describe('Route Ordering (specific before parameterized)', () => {
    it('should match /invitations/pending before /:token', async () => {
      const res = await request(app)
        .get('/api/caregivers/invitations/pending?email=test@example.com')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      // Should call getPendingInvitations, not getInvitationByToken
      expect(caregiverController.getPendingInvitations).toHaveBeenCalled();
      expect(caregiverController.getInvitationByToken).not.toHaveBeenCalled();
    });

    it('should match /invitations/:token for other values', async () => {
      const res = await request(app)
        .get('/api/caregivers/invitations/abc123token')
        .set('Authorization', 'Bearer token');

      expect(res.statusCode).toBe(200);
      expect(caregiverController.getInvitationByToken).toHaveBeenCalled();
    });
  });
});
