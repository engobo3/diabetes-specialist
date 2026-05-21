const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole, requireSelfUidOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { DoctorSchema } = require('../schemas/doctor.schema');
const { IdParamSchema } = require('../schemas/common.schema');

// ── PUBLIC: list doctors and view a doctor's public profile (no PHI) ──
router.get('/', doctorController.getDoctors);
router.get('/:id/slots', validateParams(IdParamSchema), doctorController.getAvailableSlots);
router.get('/:id', validateParams(IdParamSchema), doctorController.getDoctorById);

// ── AUTH REQUIRED ──
router.get('/lookup',
    verifyToken,
    doctorController.lookupDoctorByEmail
);

router.post('/',
    verifyToken,
    requireRole('admin'),
    validateBody(DoctorSchema),
    doctorController.addDoctor
);

// A doctor can update their own profile; admins can update any.
// The :id here is the doctor's profile ID (matches users/{uid}.doctorId).
router.put('/:id',
    verifyToken,
    validateParams(IdParamSchema),
    (req, res, next) => {
        // Allow if admin, or if the authenticated user's doctorId matches the route param
        if (req.user?.role === 'admin') return next();
        if (req.user?.role === 'doctor' && String(req.user.doctorId) === String(req.params.id)) return next();
        return res.status(403).json({ error: 'Forbidden', message: 'You can only update your own profile' });
    },
    validateBody(DoctorSchema.partial()),
    doctorController.updateDoctor
);

router.delete('/:id',
    verifyToken,
    requireRole('admin'),
    validateParams(IdParamSchema),
    doctorController.deleteDoctor
);

module.exports = router;
