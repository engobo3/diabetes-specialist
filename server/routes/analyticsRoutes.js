const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { getPopulationHealth } = require('../controllers/analyticsController');

router.use(verifyToken);

// Population health is a doctor/admin tool — exposes aggregate PHI.
router.get('/population',
    requireRole('doctor', 'admin'),
    getPopulationHealth
);

module.exports = router;
