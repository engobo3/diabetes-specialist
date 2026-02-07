const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const verifyToken = require('../middleware/authMiddleware');

// Public Routes
router.get('/', doctorController.getDoctors);

// Protected Routes (specific routes before parameterized routes)
router.get('/lookup', verifyToken, doctorController.lookupDoctorByEmail);

// Public parameterized route (must come after /lookup)
router.get('/:id', doctorController.getDoctorById);
router.post('/', verifyToken, doctorController.addDoctor);
router.put('/:id', verifyToken, doctorController.updateDoctor);
router.delete('/:id', verifyToken, doctorController.deleteDoctor);

module.exports = router;
