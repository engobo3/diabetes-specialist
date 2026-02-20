const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { normalizeSpecialty, getSpecialtyConfig, listSpecialties } = require('../config/specialties');

router.use(verifyToken);

// GET /api/specialties - List all available specialties
router.get('/', (req, res) => {
    res.json(listSpecialties());
});

// GET /api/specialties/resolve/:raw - Resolve a free-form specialty string
router.get('/resolve/:raw', (req, res) => {
    const key = normalizeSpecialty(req.params.raw);
    const config = getSpecialtyConfig(key);
    res.json({ specialtyKey: key, label: config.label, vitalTypes: config.vitalTypes });
});

// GET /api/specialties/:key/config - Get config for a specific specialty key
router.get('/:key/config', (req, res) => {
    const config = getSpecialtyConfig(req.params.key);
    res.json({ specialtyKey: req.params.key, label: config.label, vitalTypes: config.vitalTypes });
});

module.exports = router;
