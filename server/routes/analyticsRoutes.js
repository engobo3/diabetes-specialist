const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getPopulationHealth } = require('../controllers/analyticsController');

router.use(verifyToken);

router.get('/population', getPopulationHealth);

module.exports = router;
