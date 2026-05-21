const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { validateParams } = require('../middleware/validationMiddleware');
const { SpecialtyKeyParamSchema, SpecialtyRawParamSchema } = require('../schemas/common.schema');
const { normalizeSpecialty, getSpecialtyConfig, listSpecialties } = require('../config/specialties');

router.use(verifyToken);

router.get('/', (req, res) => {
    res.json(listSpecialties());
});

router.get('/resolve/:raw',
    validateParams(SpecialtyRawParamSchema),
    (req, res) => {
        const key = normalizeSpecialty(req.params.raw);
        const config = getSpecialtyConfig(key);
        res.json({ specialtyKey: key, label: config.label, vitalTypes: config.vitalTypes });
    }
);

router.get('/:key/config',
    validateParams(SpecialtyKeyParamSchema),
    (req, res) => {
        const config = getSpecialtyConfig(req.params.key);
        res.json({ specialtyKey: req.params.key, label: config.label, vitalTypes: config.vitalTypes });
    }
);

module.exports = router;
