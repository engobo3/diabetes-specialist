const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { exportPatientPDF } = require('../controllers/exportController');

router.use(verifyToken);

router.get('/patient/:patientId/pdf', exportPatientPDF);

module.exports = router;
