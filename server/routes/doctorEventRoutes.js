const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { DoctorEventSchema } = require('../schemas/doctorEvent.schema');
const { IdParamSchema, DoctorIdParamSchema } = require('../schemas/common.schema');
const { getDoctorEvents, createDoctorEvent, updateDoctorEvent, deleteDoctorEvent } = require('../controllers/doctorEventController');

router.use(verifyToken);

// Doctor events (calendar blocks, vacation, etc.) — doctor sees their own, admin sees all.
// The controller checks that req.user.doctorId matches the route's doctorId for non-admins.
router.get('/doctor/:doctorId',
    validateParams(DoctorIdParamSchema),
    requireRole('doctor', 'admin'),
    getDoctorEvents
);

router.post('/',
    requireRole('doctor', 'admin'),
    validateBody(DoctorEventSchema),
    createDoctorEvent
);

router.put('/:id',
    validateParams(IdParamSchema),
    requireRole('doctor', 'admin'),
    validateBody(DoctorEventSchema.partial()),
    updateDoctorEvent
);

router.delete('/:id',
    validateParams(IdParamSchema),
    requireRole('doctor', 'admin'),
    deleteDoctorEvent
);

module.exports = router;
