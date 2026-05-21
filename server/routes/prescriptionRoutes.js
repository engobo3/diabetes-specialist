const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireRole, requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { PrescriptionSchema } = require('../schemas/prescription.schema');
const { PatientIdParamSchema } = require('../schemas/common.schema');
const { getPatientPrescriptions, addPrescription } = require('../controllers/prescriptionController');

router.use(verifyToken);

router.get('/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    getPatientPrescriptions
);

router.post('/',
    requireRole('doctor', 'admin'),
    validateBody(PrescriptionSchema),
    addPrescription
);

module.exports = router;
