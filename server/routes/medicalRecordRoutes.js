const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireRole, requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { MedicalRecordSchema } = require('../schemas/medicalRecord.schema');
const { IdParamSchema, PatientIdParamSchema } = require('../schemas/common.schema');
const { getPatientMedicalRecords, addMedicalRecord, getMedicalRecordById } = require('../controllers/medicalRecordController');

router.use(verifyToken);

router.get('/patient/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    getPatientMedicalRecords
);

// Get a single record by ID. Ownership check is deferred to the controller because
// we need to fetch the record first to know which patientId it belongs to.
// Any authenticated user can hit this; the controller is responsible for 403'ing.
router.get('/:id',
    validateParams(IdParamSchema),
    getMedicalRecordById
);

// Only doctors and admins can add medical records.
router.post('/',
    requireRole('doctor', 'admin'),
    validateBody(MedicalRecordSchema),
    addMedicalRecord
);

module.exports = router;
