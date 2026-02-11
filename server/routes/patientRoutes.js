const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getPatients, getPatientById, getPatientByEmail, getCaregiverPatients, getPatientVitals, addPatientVital, createPatient, updatePatient, deletePatient, getDocuments, addDocument, addDoctorToPatient, removeDoctorFromPatient, verifyActivationCode, resendActivationCode, activatePatient } = require('../controllers/patientController');

// PUBLIC activation routes (no auth required)
router.post('/activate/verify', verifyActivationCode);
router.post('/activate/resend', resendActivationCode);
router.post('/activate/complete', activatePatient);

// Apply middleware to all routes below
router.use(verifyToken);

router.get('/lookup/caregiver', getCaregiverPatients);
router.get('/lookup', getPatientByEmail);
router.get('/', getPatients);
router.post('/', createPatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.get('/:id', getPatientById);
router.get('/:id/vitals', getPatientVitals);
router.post('/:id/vitals', addPatientVital);
router.get('/:id/documents', getDocuments);
router.post('/:id/documents', addDocument);
router.post('/:id/doctors', addDoctorToPatient);
router.delete('/:id/doctors/:doctorId', removeDoctorFromPatient);

module.exports = router;
