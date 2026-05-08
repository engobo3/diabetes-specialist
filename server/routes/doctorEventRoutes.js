const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getDoctorEvents, createDoctorEvent, updateDoctorEvent, deleteDoctorEvent } = require('../controllers/doctorEventController');

router.use(verifyToken);

router.get('/doctor/:doctorId', getDoctorEvents);
router.post('/', createDoctorEvent);
router.put('/:id', updateDoctorEvent);
router.delete('/:id', deleteDoctorEvent);

module.exports = router;
