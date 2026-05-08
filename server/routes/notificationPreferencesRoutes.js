const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getPreferences, updatePreferences } = require('../controllers/notificationPreferencesController');

router.use(verifyToken);

router.get('/:patientId', getPreferences);
router.put('/:patientId', updatePreferences);

module.exports = router;
