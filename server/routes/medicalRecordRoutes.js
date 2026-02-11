const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getPatientMedicalRecords, addMedicalRecord, getMedicalRecordById } = require('../controllers/medicalRecordController');

router.use(verifyToken);

router.get('/patient/:patientId', getPatientMedicalRecords);
router.get('/:id', getMedicalRecordById);
router.post('/', addMedicalRecord);

module.exports = router;
