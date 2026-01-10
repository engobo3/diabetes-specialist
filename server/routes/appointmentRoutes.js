const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getAllAppointments, createNewAppointment, updateStatus } = require('../controllers/appointmentController');

// Protect all appointment routes
router.use(verifyToken);

router.get('/', getAllAppointments);
router.post('/', createNewAppointment);
router.put('/:id', updateStatus);

module.exports = router;
