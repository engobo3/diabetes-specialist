const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getPatientPrescriptions, addPrescription } = require('../controllers/prescriptionController');

router.use(verifyToken);

router.get('/:patientId', getPatientPrescriptions);
router.post('/', addPrescription);

module.exports = router;
