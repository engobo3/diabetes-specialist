const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateParams } = require('../middleware/validationMiddleware');
const { PatientIdParamSchema } = require('../schemas/common.schema');
const { exportPatientPDF } = require('../controllers/exportController');

router.use(verifyToken);

// PDF export of a patient dossier — sensitive PHI. Self, treating doctor, or admin only.
router.get('/patient/:patientId/pdf',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    exportPatientPDF
);

module.exports = router;
