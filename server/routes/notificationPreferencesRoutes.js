const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { NotificationPreferencesSchema } = require('../schemas/notificationPreferences.schema');
const { PatientIdParamSchema } = require('../schemas/common.schema');
const { getPreferences, updatePreferences } = require('../controllers/notificationPreferencesController');

router.use(verifyToken);

router.get('/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    getPreferences
);

router.put('/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    validateBody(NotificationPreferencesSchema.partial()),
    updatePreferences
);

module.exports = router;
