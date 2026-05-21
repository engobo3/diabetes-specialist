const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireRole, requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const caregiverController = require('../controllers/caregiverController');
const {
    PatientIdParamSchema,
    PatientCaregiverParamSchema,
    TokenParamSchema,
    InvitationIdParamSchema
} = require('../schemas/common.schema');
const {
    CreateInvitationSchema,
    AcceptInvitationSchema,
    UpdatePermissionsSchema,
    ApproveInvitationSchema
} = require('../schemas/caregiver.schema');

router.use(verifyToken);

// Patient or doctor can invite a caregiver to a patient
router.post('/invite',
    validateBody(CreateInvitationSchema),
    caregiverController.inviteCaregiver
);

// Specific routes MUST come before parameterized routes
router.get('/invitations/pending', caregiverController.getPendingInvitations);

router.get('/invitations/pending-approval',
    requireRole('doctor', 'admin'),
    caregiverController.getPendingApprovalsForDoctor
);

router.get('/invitations/patient/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    caregiverController.getPatientInvitations
);

router.get('/invitations/:token',
    validateParams(TokenParamSchema),
    caregiverController.getInvitationByToken
);

// Invitation actions — the controller validates email match / ownership.
router.post('/invitations/:id/accept',
    validateParams(InvitationIdParamSchema),
    validateBody(AcceptInvitationSchema),
    caregiverController.acceptInvitation
);

router.post('/invitations/:id/reject',
    validateParams(InvitationIdParamSchema),
    caregiverController.rejectInvitation
);

router.delete('/invitations/:id',
    validateParams(InvitationIdParamSchema),
    caregiverController.cancelInvitation
);

router.post('/invitations/:id/approve',
    validateParams(InvitationIdParamSchema),
    requireRole('doctor', 'admin'),
    validateBody(ApproveInvitationSchema),
    caregiverController.approveInvitation
);

router.get('/patients/:patientId/caregivers',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    caregiverController.getPatientCaregivers
);

router.put('/:patientId/:caregiverEmail/permissions',
    validateParams(PatientCaregiverParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'], allowCaregiver: false }),
    validateBody(UpdatePermissionsSchema),
    caregiverController.updateCaregiverPermissions
);

router.delete('/:patientId/:caregiverEmail',
    validateParams(PatientCaregiverParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'], allowCaregiver: false }),
    caregiverController.removeCaregiver
);

module.exports = router;
