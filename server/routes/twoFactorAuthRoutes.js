/**
 * Two-Factor Authentication Routes
 */

const express = require('express');
const router = express.Router();
const twoFactorAuthController = require('../controllers/twoFactorAuthController');
const verifyToken = require('../middleware/authMiddleware');

/**
 * @route   POST /api/2fa/setup
 * @desc    Initiate 2FA setup - generate secret and QR code
 * @access  Private (requires authentication)
 */
router.post('/setup', verifyToken, twoFactorAuthController.setup2FA);

/**
 * @route   POST /api/2fa/verify-setup
 * @desc    Verify and enable 2FA after scanning QR code
 * @access  Private (requires authentication)
 */
router.post('/verify-setup', verifyToken, twoFactorAuthController.verifyAndEnable2FA);

/**
 * @route   POST /api/2fa/verify
 * @desc    Verify 2FA code during login (public - called before auth)
 * @access  Public
 */
router.post('/verify', twoFactorAuthController.verify2FA);

/**
 * @route   POST /api/2fa/disable
 * @desc    Disable 2FA for user account
 * @access  Private (requires authentication + password + 2FA token)
 */
router.post('/disable', verifyToken, twoFactorAuthController.disable2FA);

/**
 * @route   GET /api/2fa/status
 * @desc    Get current 2FA status for user
 * @access  Private (requires authentication)
 */
router.get('/status', verifyToken, twoFactorAuthController.get2FAStatus);

/**
 * @route   POST /api/2fa/regenerate-backup-codes
 * @desc    Regenerate backup codes (requires 2FA token)
 * @access  Private (requires authentication + 2FA token)
 */
router.post('/regenerate-backup-codes', verifyToken, twoFactorAuthController.regenerateBackupCodes);

module.exports = router;
