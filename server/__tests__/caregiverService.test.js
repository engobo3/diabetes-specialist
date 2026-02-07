// Mock repositories BEFORE requiring the service
const mockInvitationRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByToken: jest.fn(),
  findPendingByEmail: jest.fn(),
  update: jest.fn(),
  findByPatientId: jest.fn()
};

const mockPatientRepo = {
  findById: jest.fn(),
  update: jest.fn()
};

jest.mock('../repositories/CaregiverInvitationRepository', () => {
  return jest.fn().mockImplementation(() => mockInvitationRepo);
});

jest.mock('../repositories/PatientRepository', () => {
  return jest.fn().mockImplementation(() => mockPatientRepo);
});

// NOW require the service after mocks are set up
const caregiverService = require('../services/caregiverService');

describe('Caregiver Service', () => {
  beforeEach(() => {
    // Clear all mock calls before each test
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should create an invitation successfully', async () => {
      const mockPatient = {
        id: 1,
        name: 'Jane Doe',
        email: 'jane@example.com',
        caregivers: []
      };

      mockPatientRepo.findById.mockResolvedValue(mockPatient);
      mockInvitationRepo.findPendingByEmail.mockResolvedValue([]);
      mockInvitationRepo.create.mockResolvedValue({
        id: 'inv123',
        patientId: 1,
        caregiverEmail: 'caregiver@example.com',
        relationship: 'parent',
        status: 'pending',
        inviteToken: 'token123'
      });

      const result = await caregiverService.createInvitation({
        patientId: 1,
        caregiverEmail: 'caregiver@example.com',
        relationship: 'parent'
      }, 'patient');

      expect(mockPatientRepo.findById).toHaveBeenCalledWith(1);
      expect(mockInvitationRepo.create).toHaveBeenCalled();
      expect(result.status).toBe('pending');
      expect(result.inviteToken).toBeTruthy();
    });

    it('should throw error if patient not found', async () => {
      mockPatientRepo.findById.mockResolvedValue(null);

      await expect(
        caregiverService.createInvitation({
          patientId: 999,
          caregiverEmail: 'caregiver@example.com',
          relationship: 'parent'
        }, 'patient')
      ).rejects.toThrow('Patient not found');
    });

    it('should throw error if caregiver already exists', async () => {
      const mockPatient = {
        id: 1,
        name: 'Jane Doe',
        caregivers: [
          { email: 'existing@example.com', relationship: 'parent' }
        ]
      };

      mockPatientRepo.findById.mockResolvedValue(mockPatient);

      await expect(
        caregiverService.createInvitation({
          patientId: 1,
          caregiverEmail: 'existing@example.com',
          relationship: 'parent'
        }, 'patient')
      ).rejects.toThrow('Caregiver already added');
    });

    it('should throw error if pending invitation exists', async () => {
      const mockPatient = {
        id: 1,
        name: 'Jane Doe',
        caregivers: []
      };

      mockPatientRepo.findById.mockResolvedValue(mockPatient);
      mockInvitationRepo.findPendingByEmail.mockResolvedValue([
        { patientId: 1, caregiverEmail: 'caregiver@example.com' }
      ]);

      await expect(
        caregiverService.createInvitation({
          patientId: 1,
          caregiverEmail: 'caregiver@example.com',
          relationship: 'parent'
        }, 'patient')
      ).rejects.toThrow('Pending invitation already exists');
    });

    it('should auto-approve doctor-initiated invitations', async () => {
      const mockPatient = {
        id: 1,
        name: 'Jane Doe',
        doctorId: 5,
        caregivers: []
      };

      mockPatientRepo.findById.mockResolvedValue(mockPatient);
      mockInvitationRepo.findPendingByEmail.mockResolvedValue([]);
      mockInvitationRepo.create.mockImplementation(data => Promise.resolve({ id: 'inv123', ...data }));

      const result = await caregiverService.createInvitation({
        patientId: 1,
        caregiverEmail: 'caregiver@example.com',
        relationship: 'parent'
      }, 'doctor');

      const createCall = mockInvitationRepo.create.mock.calls[0][0];
      expect(createCall.doctorApproved).toBe(true);
      expect(createCall.requiresDoctorApproval).toBe(false); // Doctor-initiated invitations don't require additional approval
    });
  });

  describe('acceptInvitation', () => {
    it('should accept valid invitation', async () => {
      const mockInvitation = {
        id: 'inv123',
        patientId: 1,
        caregiverEmail: 'caregiver@example.com',
        relationship: 'parent',
        status: 'pending',
        requiresDoctorApproval: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        permissions: {
          viewVitals: true,
          viewAppointments: true
        }
      };

      const mockPatient = {
        id: 1,
        name: 'Jane Doe',
        caregivers: []
      };

      mockInvitationRepo.findById.mockResolvedValue(mockInvitation);
      mockPatientRepo.findById.mockResolvedValue(mockPatient);
      mockPatientRepo.update.mockResolvedValue({ ...mockPatient, caregivers: [{ email: 'caregiver@example.com' }] });
      mockInvitationRepo.update.mockResolvedValue({ ...mockInvitation, status: 'accepted' });

      const result = await caregiverService.acceptInvitation('inv123', {
        caregiverName: 'Caregiver Name'
      });

      expect(result.success).toBe(true);
      expect(mockPatientRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({
        caregivers: expect.arrayContaining([
          expect.objectContaining({
            email: 'caregiver@example.com',
            relationship: 'parent'
          })
        ])
      }));
    });

    it('should reject if invitation not found', async () => {
      mockInvitationRepo.findById.mockResolvedValue(null);

      await expect(
        caregiverService.acceptInvitation('inv999', {})
      ).rejects.toThrow('Invitation not found');
    });

    it('should reject if invitation already processed', async () => {
      const mockInvitation = {
        id: 'inv123',
        status: 'accepted',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockInvitationRepo.findById.mockResolvedValue(mockInvitation);

      await expect(
        caregiverService.acceptInvitation('inv123', {})
      ).rejects.toThrow('Invitation already accepted');
    });

    it('should reject if invitation expired', async () => {
      const mockInvitation = {
        id: 'inv123',
        status: 'pending',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      };

      mockInvitationRepo.findById.mockResolvedValue(mockInvitation);

      await expect(
        caregiverService.acceptInvitation('inv123', {})
      ).rejects.toThrow('Invitation has expired');
    });

    it('should reject if waiting for doctor approval', async () => {
      const mockInvitation = {
        id: 'inv123',
        status: 'pending',
        requiresDoctorApproval: true,
        doctorApproved: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockInvitationRepo.findById.mockResolvedValue(mockInvitation);

      await expect(
        caregiverService.acceptInvitation('inv123', {})
      ).rejects.toThrow('Invitation pending doctor approval');
    });
  });

  describe('approveInvitation', () => {
    it('should approve invitation successfully', async () => {
      const mockInvitation = {
        id: 'inv123',
        status: 'pending',
        requiresDoctorApproval: true
      };

      mockInvitationRepo.findById.mockResolvedValue(mockInvitation);
      mockInvitationRepo.update.mockResolvedValue({ ...mockInvitation, doctorApproved: true });

      const result = await caregiverService.approveInvitation('inv123', true, '5', 'Approved');

      expect(mockInvitationRepo.update).toHaveBeenCalledWith('inv123', expect.objectContaining({
        doctorApproved: true,
        doctorApprovedBy: '5'
      }));
    });

    it('should reject invitation when doctor disapproves', async () => {
      const mockInvitation = {
        id: 'inv123',
        status: 'pending',
        requiresDoctorApproval: true
      };

      mockInvitationRepo.findById.mockResolvedValue(mockInvitation);
      mockInvitationRepo.update.mockResolvedValue({ ...mockInvitation, status: 'rejected' });

      await caregiverService.approveInvitation('inv123', false, '5', 'Rejected');

      expect(mockInvitationRepo.update).toHaveBeenCalledWith('inv123', expect.objectContaining({
        doctorApproved: false,
        status: 'rejected'
      }));
    });
  });

  describe('removeCaregiver', () => {
    it('should remove caregiver successfully', async () => {
      const mockPatient = {
        id: 1,
        caregivers: [
          { email: 'caregiver1@example.com', relationship: 'parent' },
          { email: 'caregiver2@example.com', relationship: 'spouse' }
        ]
      };

      mockPatientRepo.findById.mockResolvedValue(mockPatient);
      mockPatientRepo.update.mockResolvedValue({
        ...mockPatient,
        caregivers: [{ email: 'caregiver2@example.com', relationship: 'spouse' }]
      });

      const result = await caregiverService.removeCaregiver(1, 'caregiver1@example.com');

      expect(mockPatientRepo.update).toHaveBeenCalledWith(1, {
        caregivers: expect.arrayContaining([
          expect.objectContaining({ email: 'caregiver2@example.com' })
        ])
      });
      expect(result.caregivers).toHaveLength(1);
    });

    it('should throw error if caregiver not found', async () => {
      const mockPatient = {
        id: 1,
        caregivers: [
          { email: 'caregiver1@example.com', relationship: 'parent' }
        ]
      };

      mockPatientRepo.findById.mockResolvedValue(mockPatient);

      await expect(
        caregiverService.removeCaregiver(1, 'nonexistent@example.com')
      ).rejects.toThrow('Caregiver not found');
    });
  });
});
