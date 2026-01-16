const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getPatients, getPatientById, getPatientByEmail, getPatientVitals, addPatientVital, createPatient, updatePatient, deletePatient, getDocuments, addDocument, getPatientRecords, addPatientRecord } = require('../controllers/patientController');

// Apply middleware to all routes
router.use(verifyToken);

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
router.get('/:id/records', getPatientRecords);
router.post('/:id/records', addPatientRecord);

module.exports = router;
