const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { predictFootRisk, getFootRiskHistory, analyzeWoundImage } = require('../controllers/footRiskController');

router.use(verifyToken);

router.post('/predict/:patientId', predictFootRisk);
router.post('/analyze-wound/:patientId', analyzeWoundImage);
router.get('/history/:patientId', getFootRiskHistory);

module.exports = router;
