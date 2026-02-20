const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const caregiverController = require('../controllers/caregiverController');

// Invitation management routes
router.post('/invite', verifyToken, caregiverController.inviteCaregiver);

// Specific routes MUST come before parameterized routes
router.get('/invitations/pending', verifyToken, caregiverController.getPendingInvitations);
router.get('/invitations/pending-approval', verifyToken, caregiverController.getPendingApprovalsForDoctor);
router.get('/invitations/patient/:patientId', verifyToken, caregiverController.getPatientInvitations);
router.get('/invitations/:token', verifyToken, caregiverController.getInvitationByToken);

// Invitation actions
router.post('/invitations/:id/accept', verifyToken, caregiverController.acceptInvitation);
router.post('/invitations/:id/reject', verifyToken, caregiverController.rejectInvitation);
router.delete('/invitations/:id', verifyToken, caregiverController.cancelInvitation);
router.post('/invitations/:id/approve', verifyToken, caregiverController.approveInvitation);

// Caregiver management routes
router.get('/patients/:patientId/caregivers', verifyToken, caregiverController.getPatientCaregivers);
router.put('/:patientId/:caregiverEmail/permissions', verifyToken, caregiverController.updateCaregiverPermissions);
router.delete('/:patientId/:caregiverEmail', verifyToken, caregiverController.removeCaregiver);

module.exports = router;
