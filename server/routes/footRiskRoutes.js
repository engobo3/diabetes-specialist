const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { PatientIdParamSchema } = require('../schemas/common.schema');
const { FootRiskPredictSchema, FootRiskWoundSchema } = require('../schemas/auth.schema');
const { predictFootRisk, getFootRiskHistory, analyzeWoundImage } = require('../controllers/footRiskController');

router.use(verifyToken);

router.post('/predict/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    validateBody(FootRiskPredictSchema),
    predictFootRisk
);

router.post('/analyze-wound/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    validateBody(FootRiskWoundSchema),
    analyzeWoundImage
);

router.get('/history/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    getFootRiskHistory
);

module.exports = router;
