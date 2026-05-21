const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const { requireRole, requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { checkCaregiverPermission } = require('../middleware/caregiverPermissionMiddleware');

const { PatientSchema } = require('../schemas/patient.schema');
const {
    IdParamSchema,
    PatientVitalParamSchema,
    PatientDoctorParamSchema
} = require('../schemas/common.schema');
const {
    ActivationVerifySchema,
    ActivationResendSchema,
    ActivationCompleteSchema,
    PatientDocumentSchema,
    PatientDoctorLinkSchema
} = require('../schemas/auth.schema');
const { VitalSchema } = require('../schemas/vital.schema');

const {
    getPatients, getPatientById, getPatientByEmail, getCaregiverPatients,
    getPatientVitals, addPatientVital, deletePatientVital,
    createPatient, updatePatient, deletePatient,
    getDocuments, addDocument,
    addDoctorToPatient, removeDoctorFromPatient,
    verifyActivationCode, resendActivationCode, activatePatient
} = require('../controllers/patientController');

// ── PUBLIC ACTIVATION ROUTES (no auth — used before login completes) ──
router.post('/activate/verify', validateBody(ActivationVerifySchema), verifyActivationCode);
router.post('/activate/resend', validateBody(ActivationResendSchema), resendActivationCode);
router.post('/activate/complete', validateBody(ActivationCompleteSchema), activatePatient);

// ── AUTH REQUIRED FOR EVERYTHING BELOW ──
router.use(verifyToken);

// Caregiver-only lookup (must come before /:id to avoid match collision)
router.get('/lookup/caregiver',
    requireRole('caregiver', 'doctor', 'admin'),
    getCaregiverPatients
);

// Patient self-lookup by email/phone — used by clients to resolve the patient
// record for the currently-logged-in user. Any authenticated role can hit it,
// since the controller filters by the queried identifier.
router.get('/lookup', getPatientByEmail);

// List patients — staff only
router.get('/',
    requireRole('doctor', 'admin', 'receptionist'),
    getPatients
);

// Create patient — doctor/admin only
router.post('/',
    requireRole('doctor', 'admin'),
    validateBody(PatientSchema),
    createPatient
);

// Update patient — doctor/admin (full power) or patient (self) for limited fields
router.put('/:id',
    validateParams(IdParamSchema),
    requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin'] }),
    validateBody(PatientSchema.partial()),
    updatePatient
);

router.delete('/:id',
    validateParams(IdParamSchema),
    requireRole('doctor', 'admin'),
    deletePatient
);

router.get('/:id',
    validateParams(IdParamSchema),
    requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin', 'receptionist'] }),
    checkCaregiverPermission('viewVitals'),
    getPatientById
);

router.get('/:id/vitals',
    validateParams(IdParamSchema),
    requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin'] }),
    checkCaregiverPermission('viewVitals'),
    getPatientVitals
);

router.post('/:id/vitals',
    validateParams(IdParamSchema),
    requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin'] }),
    checkCaregiverPermission('addVitals'),
    validateBody(VitalSchema.partial({ id: true, patientId: true })),
    addPatientVital
);

router.delete('/:id/vitals/:vitalId',
    validateParams(PatientVitalParamSchema),
    requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin'] }),
    deletePatientVital
);

router.get('/:id/documents',
    validateParams(IdParamSchema),
    requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin'] }),
    checkCaregiverPermission('viewDocuments'),
    getDocuments
);

router.post('/:id/documents',
    validateParams(IdParamSchema),
    requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin'] }),
    validateBody(PatientDocumentSchema),
    addDocument
);

router.post('/:id/doctors',
    validateParams(IdParamSchema),
    requireRole('doctor', 'admin'),
    validateBody(PatientDoctorLinkSchema),
    addDoctorToPatient
);

router.delete('/:id/doctors/:doctorId',
    validateParams(PatientDoctorParamSchema),
    requireRole('doctor', 'admin'),
    removeDoctorFromPatient
);

module.exports = router;
