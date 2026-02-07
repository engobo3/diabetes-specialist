const CaregiverInvitationRepository = require('../repositories/CaregiverInvitationRepository');
const PatientRepository = require('../repositories/PatientRepository');
const crypto = require('crypto');
const {
  CreateInvitationSchema,
  AcceptInvitationSchema,
  ApproveInvitationSchema,
  UpdatePermissionsSchema
} = require('../schemas/caregiver.schema');

const invitationRepo = new CaregiverInvitationRepository();
const patientRepo = new PatientRepository();

/**
 * Create a new caregiver invitation
 * @param {Object} data - Invitation data
 * @param {string} invitedBy - 'patient' or 'doctor'
 * @returns {Promise<Object>} Created invitation
 */
const createInvitation = async (data, invitedBy = 'patient') => {
  // Validate input
  const validatedData = CreateInvitationSchema.parse(data);
  const { patientId, caregiverEmail, relationship, permissions, notes } = validatedData;

  // Get patient details
  const patient = await patientRepo.findById(patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }

  // Check if caregiver already exists
  if (patient.caregivers?.some(cg => cg.email.toLowerCase() === caregiverEmail.toLowerCase())) {
    throw new Error('Caregiver already added to this patient');
  }

  // Check for existing pending invitation
  const existingPending = await invitationRepo.findPendingByEmail(caregiverEmail);
  const duplicateForPatient = existingPending.find(inv => String(inv.patientId) === String(patientId));
  if (duplicateForPatient) {
    throw new Error('Pending invitation already exists for this caregiver');
  }

  // Generate unique token
  const inviteToken = crypto.randomBytes(32).toString('hex');

  // Default permissions
  const defaultPermissions = {
    viewVitals: true,
    viewAppointments: true,
    viewPrescriptions: true,
    requestAppointments: false,
    addVitals: false,
    viewDocuments: true,
    viewPayments: false,
    ...permissions
  };

  // Create invitation (filter out undefined values for Firestore compatibility)
  const invitationData = {
    patientId,
    patientName: patient.name,
    doctorId: patient.doctorId,
    caregiverEmail: caregiverEmail.toLowerCase(),
    relationship,
    status: 'pending',
    invitedBy,
    requiresDoctorApproval: invitedBy === 'patient', // Doctor-invited don't need approval
    doctorApproved: invitedBy === 'doctor' ? true : null,
    doctorApprovedBy: invitedBy === 'doctor' ? patient.doctorId : null,
    doctorApprovedAt: invitedBy === 'doctor' ? new Date().toISOString() : null,
    permissions: defaultPermissions,
    inviteToken,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  };

  // Only add notes if defined
  if (notes !== undefined) {
    invitationData.notes = notes;
  }

  const invitation = await invitationRepo.create(invitationData);

  return invitation;
};

/**
 * Get invitation by token (public endpoint for accepting invitations)
 * @param {string} token - Invitation token
 * @returns {Promise<Object>} Invitation details
 */
const getInvitationByToken = async (token) => {
  const invitation = await invitationRepo.findByToken(token);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Check if expired
  if (new Date(invitation.expiresAt) < new Date()) {
    if (invitation.status === 'pending') {
      await invitationRepo.update(invitation.id, { status: 'expired' });
    }
    throw new Error('Invitation has expired');
  }

  return invitation;
};

/**
 * Accept a caregiver invitation
 * @param {string|number} invitationId - Invitation ID
 * @param {Object} caregiverData - Optional caregiver profile data
 * @returns {Promise<Object>} Success status and patient info
 */
const acceptInvitation = async (invitationId, caregiverData = {}) => {
  const validatedData = AcceptInvitationSchema.parse(caregiverData);

  const invitation = await invitationRepo.findById(invitationId);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Invitation already ${invitation.status}`);
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    await invitationRepo.update(invitationId, { status: 'expired' });
    throw new Error('Invitation has expired');
  }

  // Check if doctor approval required
  if (invitation.requiresDoctorApproval && !invitation.doctorApproved) {
    throw new Error('Invitation pending doctor approval');
  }

  // Update patient's caregivers array
  const patient = await patientRepo.findById(invitation.patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }

  const updatedCaregivers = [
    ...(patient.caregivers || []),
    {
      email: invitation.caregiverEmail,
      relationship: invitation.relationship,
      permissions: invitation.permissions,
      addedAt: new Date().toISOString(),
      addedBy: invitation.invitedBy,
      status: 'active'
    }
  ];

  await patientRepo.update(invitation.patientId, {
    caregivers: updatedCaregivers
  });

  // Update invitation status
  await invitationRepo.update(invitationId, {
    status: 'accepted',
    acceptedAt: new Date().toISOString()
  });

  return {
    success: true,
    patient: {
      id: patient.id,
      name: patient.name
    }
  };
};

/**
 * Reject a caregiver invitation
 * @param {string|number} invitationId - Invitation ID
 * @returns {Promise<Object>} Success status
 */
const rejectInvitation = async (invitationId) => {
  const invitation = await invitationRepo.findById(invitationId);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Invitation already ${invitation.status}`);
  }

  await invitationRepo.update(invitationId, {
    status: 'rejected',
    rejectedAt: new Date().toISOString()
  });

  return { success: true };
};

/**
 * Cancel a pending invitation (patient or doctor)
 * @param {string|number} invitationId - Invitation ID
 * @returns {Promise<Object>} Success status
 */
const cancelInvitation = async (invitationId) => {
  const invitation = await invitationRepo.findById(invitationId);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Cannot cancel ${invitation.status} invitation`);
  }

  await invitationRepo.update(invitationId, {
    status: 'cancelled'
  });

  return { success: true };
};

/**
 * Doctor approves or rejects an invitation
 * @param {string|number} invitationId - Invitation ID
 * @param {boolean} approved - Approval status
 * @param {string} doctorId - Doctor ID
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated invitation
 */
const approveInvitation = async (invitationId, approved, doctorId, notes = '') => {
  const validatedData = ApproveInvitationSchema.parse({ approved, notes });

  const invitation = await invitationRepo.findById(invitationId);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Cannot approve ${invitation.status} invitation`);
  }

  if (!invitation.requiresDoctorApproval) {
    throw new Error('This invitation does not require doctor approval');
  }

  const updateData = {
    doctorApproved: validatedData.approved,
    doctorApprovedBy: doctorId,
    doctorApprovedAt: new Date().toISOString()
  };

  if (validatedData.notes) {
    updateData.notes = `${invitation.notes || ''}\nDoctor: ${validatedData.notes}`.trim();
  }

  // If rejected, update status
  if (!validatedData.approved) {
    updateData.status = 'rejected';
    updateData.rejectedAt = new Date().toISOString();
  }

  const updated = await invitationRepo.update(invitationId, updateData);

  return updated;
};

/**
 * Update permissions for an existing caregiver
 * @param {string|number} patientId - Patient ID
 * @param {string} caregiverEmail - Caregiver email
 * @param {Object} permissions - Updated permissions
 * @returns {Promise<Object>} Updated patient
 */
const updateCaregiverPermissions = async (patientId, caregiverEmail, permissions) => {
  const validatedData = UpdatePermissionsSchema.parse({ permissions });

  const patient = await patientRepo.findById(patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }

  const caregiverIndex = patient.caregivers?.findIndex(
    cg => cg.email.toLowerCase() === caregiverEmail.toLowerCase()
  );

  if (caregiverIndex === -1 || caregiverIndex === undefined) {
    throw new Error('Caregiver not found for this patient');
  }

  const updatedCaregivers = [...patient.caregivers];
  updatedCaregivers[caregiverIndex] = {
    ...updatedCaregivers[caregiverIndex],
    permissions: {
      ...updatedCaregivers[caregiverIndex].permissions,
      ...validatedData.permissions
    }
  };

  const updated = await patientRepo.update(patientId, {
    caregivers: updatedCaregivers
  });

  return updated;
};

/**
 * Remove a caregiver from a patient
 * @param {string|number} patientId - Patient ID
 * @param {string} caregiverEmail - Caregiver email
 * @returns {Promise<Object>} Updated patient
 */
const removeCaregiver = async (patientId, caregiverEmail) => {
  const patient = await patientRepo.findById(patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }

  const updatedCaregivers = (patient.caregivers || []).filter(
    cg => cg.email.toLowerCase() !== caregiverEmail.toLowerCase()
  );

  if (updatedCaregivers.length === (patient.caregivers || []).length) {
    throw new Error('Caregiver not found for this patient');
  }

  const updated = await patientRepo.update(patientId, {
    caregivers: updatedCaregivers
  });

  return updated;
};

/**
 * Get all caregivers for a patient
 * @param {string|number} patientId - Patient ID
 * @returns {Promise<Array>} List of caregivers
 */
const getPatientCaregivers = async (patientId) => {
  const patient = await patientRepo.findById(patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }

  return patient.caregivers || [];
};

/**
 * Get pending invitations for a caregiver email
 * @param {string} email - Caregiver email
 * @returns {Promise<Array>} List of pending invitations
 */
const getPendingInvitations = async (email) => {
  return await invitationRepo.findPendingByEmail(email);
};

/**
 * Get all invitations for a patient
 * @param {string|number} patientId - Patient ID
 * @returns {Promise<Array>} List of invitations
 */
const getPatientInvitations = async (patientId) => {
  return await invitationRepo.findByPatientId(patientId);
};

/**
 * Get invitations pending doctor approval
 * @param {string|number} doctorId - Doctor ID (optional)
 * @returns {Promise<Array>} List of invitations
 */
const getPendingApprovalsForDoctor = async (doctorId) => {
  return await invitationRepo.findPendingNeedingApproval(doctorId);
};

module.exports = {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation,
  approveInvitation,
  updateCaregiverPermissions,
  removeCaregiver,
  getPatientCaregivers,
  getPendingInvitations,
  getPatientInvitations,
  getPendingApprovalsForDoctor
};
