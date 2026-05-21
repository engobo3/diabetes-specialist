const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { AppointmentSchema } = require('../schemas/appointment.schema');
const { IdParamSchema } = require('../schemas/common.schema');
const { AppointmentUpdateSchema } = require('../schemas/auth.schema');
const { getAllAppointments, createNewAppointment, updateAppointmentDetails } = require('../controllers/appointmentController');

router.use(verifyToken);

// List appointments — any authenticated user. The controller filters by doctorId
// query and the user's own patient/doctor scope.
router.get('/', getAllAppointments);

// Patients can request appointments; doctors/admins can create them too.
router.post('/',
    validateBody(AppointmentSchema),
    createNewAppointment
);

// Updating appointment status — any authenticated user, but the controller checks
// whether the user is the doctor/patient/admin on this appointment.
router.put('/:id',
    validateParams(IdParamSchema),
    validateBody(AppointmentUpdateSchema),
    updateAppointmentDetails
);

module.exports = router;
