const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireRole, requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { MedicationScheduleSchema } = require('../schemas/medicationSchedule.schema');
const { IdParamSchema, PatientIdParamSchema } = require('../schemas/common.schema');
const { getByPatient, createSchedule, updateSchedule, deleteSchedule } = require('../controllers/medicationScheduleController');

router.use(verifyToken);

router.get('/patient/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin'] }),
    getByPatient
);

// Creating/updating/deleting medication schedules is a clinical action — doctor/admin only.
router.post('/',
    requireRole('doctor', 'admin'),
    validateBody(MedicationScheduleSchema),
    createSchedule
);

router.put('/:id',
    validateParams(IdParamSchema),
    requireRole('doctor', 'admin'),
    validateBody(MedicationScheduleSchema.partial()),
    updateSchedule
);

router.delete('/:id',
    validateParams(IdParamSchema),
    requireRole('doctor', 'admin'),
    deleteSchedule
);

module.exports = router;
