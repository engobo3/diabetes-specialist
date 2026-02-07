const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const verifyToken = require('../middleware/authMiddleware');

// Public Routes
router.get('/', doctorController.getDoctors);
router.get('/:id', doctorController.getDoctorById);

// Protected Routes
router.get('/lookup', verifyToken, doctorController.lookupDoctorByEmail);
router.post('/', verifyToken, doctorController.addDoctor);
router.put('/:id', verifyToken, doctorController.updateDoctor);
router.delete('/:id', verifyToken, doctorController.deleteDoctor);

module.exports = router;
