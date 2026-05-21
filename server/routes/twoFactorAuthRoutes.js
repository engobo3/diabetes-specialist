/**
 * Two-Factor Authentication Routes
 */

const express = require('express');
const router = express.Router();
const twoFactorAuthController = require('../controllers/twoFactorAuthController');
const verifyToken = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validationMiddleware');
const {
    TwoFactorVerifySchema,
    TwoFactorTokenOnlySchema,
    TwoFactorDisableSchema
} = require('../schemas/auth.schema');

router.post('/setup', verifyToken, twoFactorAuthController.setup2FA);

router.post('/verify-setup',
    verifyToken,
    validateBody(TwoFactorTokenOnlySchema),
    twoFactorAuthController.verifyAndEnable2FA
);

// Public — called BEFORE the user's session is established, so no verifyToken
router.post('/verify',
    validateBody(TwoFactorVerifySchema),
    twoFactorAuthController.verify2FA
);

router.post('/disable',
    verifyToken,
    validateBody(TwoFactorDisableSchema),
    twoFactorAuthController.disable2FA
);

router.get('/status', verifyToken, twoFactorAuthController.get2FAStatus);

router.post('/regenerate-backup-codes',
    verifyToken,
    validateBody(TwoFactorTokenOnlySchema),
    twoFactorAuthController.regenerateBackupCodes
);

module.exports = router;
