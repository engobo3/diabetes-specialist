const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getPatients, getPatientById, getPatientByEmail, getPatientVitals, addPatientVital, createPatient, updatePatient, deletePatient, getDocuments, addDocument } = require('../controllers/patientController');

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

module.exports = router;
