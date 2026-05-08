const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getByPatient, createSchedule, updateSchedule, deleteSchedule } = require('../controllers/medicationScheduleController');

router.use(verifyToken);

router.get('/patient/:patientId', getByPatient);
router.post('/', createSchedule);
router.put('/:id', updateSchedule);
router.delete('/:id', deleteSchedule);

module.exports = router;
