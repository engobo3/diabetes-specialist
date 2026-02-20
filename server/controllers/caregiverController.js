const caregiverService = require('../services/caregiverService');
const { safeErrorMessage } = require('../utils/safeError');

/**
 * POST /api/caregivers/invite
 * Create a new caregiver invitation
 */
const inviteCaregiver = async (req, res) => {
  try {
    const { patientId, caregiverEmail, relationship, permissions, notes } = req.body;

    // Validate authorization
    // Patient can invite for themselves, doctor can invite for their patients
    if (req.user.role === 'patient') {
      if (String(req.user.patientId) !== String(patientId)) {
        return res.status(403).json({ message: 'Unauthorized: Can only invite caregivers for your own account' });
      }
    } else if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Only patients and doctors can send invitations' });
    }

    const invitedBy = req.user.role === 'doctor' || req.user.role === 'admin' ? 'doctor' : 'patient';

    const invitation = await caregiverService.createInvitation(
      { patientId, caregiverEmail, relationship, permissions, notes },
      invitedBy
    );

    // TODO: Send email with invitation link
    // const inviteUrl = `${process.env.CLIENT_URL}/accept-invitation?token=${invitation.inviteToken}`;
    // await sendInvitationEmail(caregiverEmail, invitation, inviteUrl);

    res.status(201).json(invitation);
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(400).json({ message: safeErrorMessage(error, 'Error creating invitation') });
  }
};

/**
 * GET /api/caregivers/invitations/:token
 * Get invitation by token (public endpoint)
 */
const getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const invitation = await caregiverService.getInvitationByToken(token);
    res.json(invitation);
  } catch (error) {
    console.error('Error fetching invitation:', error);
    res.status(404).json({ message: error.message || 'Invitation not found' });
  }
};

/**
 * GET /api/caregivers/invitations/pending
 * Get pending invitations for a caregiver email
 */
const getPendingInvitations = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email query parameter required' });
    }

    const invitations = await caregiverService.getPendingInvitations(email);
    res.json(invitations);
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    res.status(500).json({ message: 'Error fetching invitations' });
  }
};

/**
 * GET /api/caregivers/invitations/patient/:patientId
 * Get all invitations for a patient
 */
const getPatientInvitations = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate authorization
    if (req.user.role === 'patient' && String(req.user.patientId) !== String(patientId)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const invitations = await caregiverService.getPatientInvitations(patientId);
    res.json(invitations);
  } catch (error) {
    console.error('Error fetching patient invitations:', error);
    res.status(500).json({ message: 'Error fetching invitations' });
  }
};

/**
 * GET /api/caregivers/invitations/pending-approval
 * Get invitations pending doctor approval
 */
const getPendingApprovalsForDoctor = async (req, res) => {
  try {
    const { doctorId } = req.query;

    // If no doctorId provided, get all pending (admin only)
    if (!doctorId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Doctor ID required' });
    }

    const invitations = await caregiverService.getPendingApprovalsForDoctor(doctorId);
    res.json(invitations);
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ message: 'Error fetching approvals' });
  }
};

/**
 * POST /api/caregivers/invitations/:id/accept
 * Accept a caregiver invitation
 */
const acceptInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { caregiverName, caregiverPhone } = req.body;

    const result = await caregiverService.acceptInvitation(id, {
      caregiverName,
      caregiverPhone
    });

    res.json(result);
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(400).json({ message: safeErrorMessage(error, 'Error accepting invitation') });
  }
};

/**
 * POST /api/caregivers/invitations/:id/reject
 * Reject a caregiver invitation
 */
const rejectInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await caregiverService.rejectInvitation(id);
    res.json(result);
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    res.status(400).json({ message: safeErrorMessage(error, 'Error rejecting invitation') });
  }
};

/**
 * DELETE /api/caregivers/invitations/:id
 * Cancel a pending invitation
 */
const cancelInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Validate authorization - must be inviter or admin

    const result = await caregiverService.cancelInvitation(id);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(400).json({ message: safeErrorMessage(error, 'Error cancelling invitation') });
  }
};

/**
 * POST /api/caregivers/invitations/:id/approve
 * Doctor approves or rejects an invitation
 */
const approveInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, notes } = req.body;

    // Validate authorization - must be doctor
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Only doctors can approve invitations' });
    }

    const doctorId = req.user.doctorId || req.user.id;

    const result = await caregiverService.approveInvitation(id, approved, doctorId, notes);
    res.json(result);
  } catch (error) {
    console.error('Error approving invitation:', error);
    res.status(400).json({ message: safeErrorMessage(error, 'Error approving invitation') });
  }
};

/**
 * GET /api/patients/:patientId/caregivers
 * Get all caregivers for a patient
 */
const getPatientCaregivers = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate authorization
    if (req.user.role === 'patient' && String(req.user.patientId) !== String(patientId)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const caregivers = await caregiverService.getPatientCaregivers(patientId);
    res.json(caregivers);
  } catch (error) {
    console.error('Error fetching caregivers:', error);
    res.status(500).json({ message: 'Error fetching caregivers' });
  }
};

/**
 * PUT /api/caregivers/:patientId/:caregiverEmail/permissions
 * Update permissions for a caregiver
 */
const updateCaregiverPermissions = async (req, res) => {
  try {
    const { patientId, caregiverEmail } = req.params;
    const { permissions } = req.body;

    // Validate authorization
    if (req.user.role === 'patient' && String(req.user.patientId) !== String(patientId)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const result = await caregiverService.updateCaregiverPermissions(
      patientId,
      caregiverEmail,
      permissions
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating permissions:', error);
    res.status(400).json({ message: safeErrorMessage(error, 'Error updating permissions') });
  }
};

/**
 * DELETE /api/caregivers/:patientId/:caregiverEmail
 * Remove a caregiver from a patient
 */
const removeCaregiver = async (req, res) => {
  try {
    const { patientId, caregiverEmail } = req.params;

    // Validate authorization
    if (req.user.role === 'patient' && String(req.user.patientId) !== String(patientId)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const result = await caregiverService.removeCaregiver(patientId, caregiverEmail);
    res.json(result);
  } catch (error) {
    console.error('Error removing caregiver:', error);
    res.status(400).json({ message: safeErrorMessage(error, 'Error removing caregiver') });
  }
};

module.exports = {
  inviteCaregiver,
  getInvitationByToken,
  getPendingInvitations,
  getPatientInvitations,
  getPendingApprovalsForDoctor,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation,
  approveInvitation,
  getPatientCaregivers,
  updateCaregiverPermissions,
  removeCaregiver
};
