/**
 * End-to-End Integration Test for Caregiver Management System
 *
 * This test suite validates the complete caregiver invitation workflow
 * from creation through acceptance without mocking external dependencies.
 */

const caregiverService = require('../services/caregiverService');
const PatientRepository = require('../repositories/PatientRepository');
const CaregiverInvitationRepository = require('../repositories/CaregiverInvitationRepository');

describe('Caregiver Management E2E Tests', () => {
  let patientRepo;
  let invitationRepo;
  let testPatientId;
  let testInvitationId;

  beforeAll(async () => {
    patientRepo = new PatientRepository();
    invitationRepo = new CaregiverInvitationRepository();
  });

  beforeEach(async () => {
    // Create a test patient for each test
    const testPatient = await patientRepo.create({
      name: 'Test Patient',
      email: `test-patient-${Date.now()}@example.com`,
      age: 45,
      type: 'Type 2',
      status: 'Stable',
      doctorId: 1,
      caregivers: []
    });
    testPatientId = testPatient.id;
  });

  afterEach(async () => {
    // Cleanup: Remove test data
    try {
      if (testPatientId) {
        await patientRepo.delete(testPatientId);
      }
      if (testInvitationId) {
        await invitationRepo.delete(testInvitationId);
      }
    } catch (error) {
      console.log('Cleanup warning:', error.message);
    }
  });

  describe('Complete Invitation Workflow', () => {
    it('should complete full invitation lifecycle: create -> approve -> accept', async () => {
      // Step 1: Patient creates invitation
      const invitation = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'e2e-caregiver@example.com',
        relationship: 'parent',
        notes: 'E2E test invitation'
      }, 'patient');

      testInvitationId = invitation.id;

      expect(invitation.status).toBe('pending');
      expect(invitation.requiresDoctorApproval).toBe(true);
      expect(invitation.doctorApproved).toBe(null);
      expect(invitation.inviteToken).toBeTruthy();

      // Step 2: Doctor approves invitation
      const approved = await caregiverService.approveInvitation(
        invitation.id,
        true,
        '1',
        'E2E approval test'
      );

      expect(approved.doctorApproved).toBe(true);

      // Step 3: Verify invitation is ready to accept
      const readyInvitation = await caregiverService.getInvitationByToken(invitation.inviteToken);
      expect(readyInvitation.doctorApproved).toBe(true);
      expect(readyInvitation.status).toBe('pending');

      // Step 4: Caregiver accepts invitation
      const accepted = await caregiverService.acceptInvitation(invitation.id, {
        caregiverName: 'E2E Caregiver',
        caregiverPhone: '+1234567890'
      });

      expect(accepted.success).toBe(true);
      expect(accepted.patient.id).toBe(testPatientId);

      // Step 5: Verify caregiver was added to patient
      const updatedPatient = await patientRepo.findById(testPatientId);
      expect(updatedPatient.caregivers).toHaveLength(1);
      expect(updatedPatient.caregivers[0].email).toBe('e2e-caregiver@example.com');
      expect(updatedPatient.caregivers[0].relationship).toBe('parent');
      expect(updatedPatient.caregivers[0].status).toBe('active');

      // Step 6: Verify invitation marked as accepted
      const finalInvitation = await invitationRepo.findById(invitation.id);
      expect(finalInvitation.status).toBe('accepted');
      expect(finalInvitation.acceptedAt).toBeTruthy();
    });

    it('should handle doctor-initiated invitation (no approval needed)', async () => {
      // Doctor creates invitation
      const invitation = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'doctor-invited@example.com',
        relationship: 'spouse'
      }, 'doctor');

      testInvitationId = invitation.id;

      // Should be auto-approved
      expect(invitation.doctorApproved).toBe(true);

      // Can be accepted immediately
      const accepted = await caregiverService.acceptInvitation(invitation.id, {
        caregiverName: 'Doctor Invited Caregiver'
      });

      expect(accepted.success).toBe(true);

      const updatedPatient = await patientRepo.findById(testPatientId);
      expect(updatedPatient.caregivers).toHaveLength(1);
      expect(updatedPatient.caregivers[0].email).toBe('doctor-invited@example.com');
    });

    it('should prevent duplicate caregiver invitations', async () => {
      // Create first invitation
      const invitation1 = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'duplicate@example.com',
        relationship: 'parent'
      }, 'doctor');

      testInvitationId = invitation1.id;

      // Accept first invitation
      await caregiverService.acceptInvitation(invitation1.id, {
        caregiverName: 'First Caregiver'
      });

      // Try to create duplicate
      await expect(
        caregiverService.createInvitation({
          patientId: testPatientId,
          caregiverEmail: 'duplicate@example.com',
          relationship: 'parent'
        }, 'patient')
      ).rejects.toThrow('Caregiver already added');
    });

    it('should allow removing and re-adding caregivers', async () => {
      // Add caregiver
      const invitation = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'removable@example.com',
        relationship: 'sibling'
      }, 'doctor');

      testInvitationId = invitation.id;

      await caregiverService.acceptInvitation(invitation.id, {
        caregiverName: 'Removable Caregiver'
      });

      let patient = await patientRepo.findById(testPatientId);
      expect(patient.caregivers).toHaveLength(1);

      // Remove caregiver
      await caregiverService.removeCaregiver(testPatientId, 'removable@example.com');

      patient = await patientRepo.findById(testPatientId);
      expect(patient.caregivers).toHaveLength(0);

      // Re-add same caregiver
      const invitation2 = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'removable@example.com',
        relationship: 'sibling'
      }, 'doctor');

      await caregiverService.acceptInvitation(invitation2.id, {
        caregiverName: 'Removable Caregiver Again'
      });

      patient = await patientRepo.findById(testPatientId);
      expect(patient.caregivers).toHaveLength(1);
    });
  });

  describe('Permission Management', () => {
    it('should create invitation with custom permissions', async () => {
      const customPermissions = {
        viewVitals: true,
        viewAppointments: true,
        viewPrescriptions: false,
        requestAppointments: false,
        addVitals: false,
        viewDocuments: false,
        viewPayments: false
      };

      const invitation = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'limited@example.com',
        relationship: 'caregiver',
        permissions: customPermissions
      }, 'doctor');

      testInvitationId = invitation.id;

      expect(invitation.permissions).toMatchObject(customPermissions);

      await caregiverService.acceptInvitation(invitation.id, {});

      const patient = await patientRepo.findById(testPatientId);
      expect(patient.caregivers[0].permissions).toMatchObject(customPermissions);
    });

    it('should update caregiver permissions', async () => {
      // Add caregiver
      const invitation = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'updatable@example.com',
        relationship: 'parent'
      }, 'doctor');

      testInvitationId = invitation.id;

      await caregiverService.acceptInvitation(invitation.id, {});

      // Update permissions
      const newPermissions = {
        viewVitals: false,
        addVitals: true
      };

      await caregiverService.updateCaregiverPermissions(
        testPatientId,
        'updatable@example.com',
        newPermissions
      );

      const patient = await patientRepo.findById(testPatientId);
      expect(patient.caregivers[0].permissions.viewVitals).toBe(false);
      expect(patient.caregivers[0].permissions.addVitals).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should reject expired invitation', async () => {
      const invitation = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'expired@example.com',
        relationship: 'parent'
      }, 'doctor');

      testInvitationId = invitation.id;

      // Manually expire the invitation
      await invitationRepo.update(invitation.id, {
        expiresAt: new Date(Date.now() - 1000).toISOString()
      });

      await expect(
        caregiverService.acceptInvitation(invitation.id, {})
      ).rejects.toThrow('expired');
    });

    it('should reject invitation awaiting approval', async () => {
      const invitation = await caregiverService.createInvitation({
        patientId: testPatientId,
        caregiverEmail: 'unapproved@example.com',
        relationship: 'parent'
      }, 'patient'); // Patient-initiated, needs approval

      testInvitationId = invitation.id;

      await expect(
        caregiverService.acceptInvitation(invitation.id, {})
      ).rejects.toThrow('approval');
    });

    it('should reject removing non-existent caregiver', async () => {
      await expect(
        caregiverService.removeCaregiver(testPatientId, 'nonexistent@example.com')
      ).rejects.toThrow('not found');
    });
  });
});
