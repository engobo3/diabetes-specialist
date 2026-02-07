/**
 * Two-Factor Authentication Controller
 * Handles 2FA setup, verification, and management
 */

const twoFactorAuthService = require('../services/twoFactorAuthService');
const { db } = require('../config/firebaseConfig');

/**
 * Initiate 2FA setup - Generate secret and QR code
 * POST /api/2fa/setup
 */
exports.setup2FA = async (req, res) => {
    try {
        const { uid, email } = req.user;
        const { userName } = req.body;

        // Generate secret and QR code
        const { secret, qrCode, backupCodes, otpauthUrl } =
            await twoFactorAuthService.generateSecret(email, userName);

        // Hash backup codes before storing
        const hashedBackupCodes = twoFactorAuthService.hashBackupCodes(backupCodes);

        // Store temporary 2FA data (not yet enabled)
        const userRef = db.collection('users').doc(uid);
        await userRef.update({
            twoFactorAuth: {
                tempSecret: secret,
                enabled: false,
                backupCodes: hashedBackupCodes,
                setupAt: new Date().toISOString()
            }
        });

        res.status(200).json({
            success: true,
            message: 'Scan QR code with your authenticator app',
            data: {
                qrCode,
                secret, // Show to user in case QR scan fails
                backupCodes, // Plain text codes - user must save these
                otpauthUrl
            }
        });
    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to setup 2FA',
            message: error.message
        });
    }
};

/**
 * Verify and enable 2FA - User confirms setup with a code
 * POST /api/2fa/verify-setup
 */
exports.verifyAndEnable2FA = async (req, res) => {
    try {
        const { uid, email } = req.user;
        const { token } = req.body;

        if (!token || token.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token format. Must be 6 digits.'
            });
        }

        // Get user's temporary secret
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();
        const tempSecret = userData.twoFactorAuth?.tempSecret;

        if (!tempSecret) {
            return res.status(400).json({
                success: false,
                error: '2FA setup not initiated. Please start setup first.'
            });
        }

        // Validate the token
        const isValid = await twoFactorAuthService.validateSetup(
            tempSecret,
            token,
            email
        );

        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification code. Please try again.'
            });
        }

        // Enable 2FA by moving tempSecret to secret
        await userRef.update({
            'twoFactorAuth.secret': tempSecret,
            'twoFactorAuth.enabled': true,
            'twoFactorAuth.enabledAt': new Date().toISOString(),
            'twoFactorAuth.tempSecret': null
        });

        res.status(200).json({
            success: true,
            message: '2FA enabled successfully'
        });
    } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify 2FA',
            message: error.message
        });
    }
};

/**
 * Verify 2FA code during login
 * POST /api/2fa/verify
 */
exports.verify2FA = async (req, res) => {
    try {
        const { userId, token, backupCode } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // Get user data
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();
        const twoFactorAuth = userData.twoFactorAuth;

        if (!twoFactorAuth?.enabled) {
            return res.status(400).json({
                success: false,
                error: '2FA not enabled for this user'
            });
        }

        let isValid = false;
        let usedBackupCode = false;

        // Check if using backup code
        if (backupCode) {
            const result = twoFactorAuthService.verifyBackupCode(
                backupCode,
                twoFactorAuth.backupCodes || []
            );

            isValid = result.valid;
            usedBackupCode = true;

            if (isValid) {
                // Update remaining backup codes
                await userRef.update({
                    'twoFactorAuth.backupCodes': result.remainingCodes
                });

                // Warn if running low on backup codes
                if (result.remainingCodes.length <= 2) {
                    return res.status(200).json({
                        success: true,
                        verified: true,
                        warning: `Only ${result.remainingCodes.length} backup codes remaining. Please generate new ones.`
                    });
                }
            }
        } else if (token) {
            // Verify TOTP token
            isValid = twoFactorAuthService.verifyToken(
                twoFactorAuth.secret,
                token
            );
        } else {
            return res.status(400).json({
                success: false,
                error: 'Either token or backupCode is required'
            });
        }

        if (isValid) {
            await twoFactorAuthService.logSuccessfulVerification(
                userId,
                usedBackupCode
            );

            res.status(200).json({
                success: true,
                verified: true,
                message: '2FA verification successful'
            });
        } else {
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
            await twoFactorAuthService.logFailedAttempt(userId, ipAddress);

            res.status(401).json({
                success: false,
                verified: false,
                error: 'Invalid verification code'
            });
        }
    } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify 2FA',
            message: error.message
        });
    }
};

/**
 * Disable 2FA
 * POST /api/2fa/disable
 */
exports.disable2FA = async (req, res) => {
    try {
        const { uid, email } = req.user;
        const { password, token } = req.body;

        // Require password AND current 2FA token to disable
        if (!password || !token) {
            return res.status(400).json({
                success: false,
                error: 'Password and current 2FA token required to disable 2FA'
            });
        }

        // Get user data
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();
        const twoFactorAuth = userData.twoFactorAuth;

        if (!twoFactorAuth?.enabled) {
            return res.status(400).json({
                success: false,
                error: '2FA is not enabled'
            });
        }

        // Verify current 2FA token before disabling
        const isValid = twoFactorAuthService.verifyToken(
            twoFactorAuth.secret,
            token
        );

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid 2FA token'
            });
        }

        // TODO: Verify password (requires password verification implementation)
        // For now, we trust that the 2FA token is sufficient

        // Disable 2FA
        await userRef.update({
            twoFactorAuth: {
                enabled: false,
                disabledAt: new Date().toISOString()
            }
        });

        await twoFactorAuthService.disable2FA(email);

        res.status(200).json({
            success: true,
            message: '2FA disabled successfully'
        });
    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to disable 2FA',
            message: error.message
        });
    }
};

/**
 * Get 2FA status
 * GET /api/2fa/status
 */
exports.get2FAStatus = async (req, res) => {
    try {
        const { uid } = req.user;

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();
        const twoFactorAuth = userData.twoFactorAuth || {};

        res.status(200).json({
            success: true,
            data: {
                enabled: twoFactorAuth.enabled || false,
                enabledAt: twoFactorAuth.enabledAt || null,
                backupCodesRemaining: (twoFactorAuth.backupCodes || []).length
            }
        });
    } catch (error) {
        console.error('2FA status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get 2FA status',
            message: error.message
        });
    }
};

/**
 * Regenerate backup codes
 * POST /api/2fa/regenerate-backup-codes
 */
exports.regenerateBackupCodes = async (req, res) => {
    try {
        const { uid } = req.user;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: '2FA token required to regenerate backup codes'
            });
        }

        // Get user data
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();
        const twoFactorAuth = userData.twoFactorAuth;

        if (!twoFactorAuth?.enabled) {
            return res.status(400).json({
                success: false,
                error: '2FA is not enabled'
            });
        }

        // Verify token
        const isValid = twoFactorAuthService.verifyToken(
            twoFactorAuth.secret,
            token
        );

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid 2FA token'
            });
        }

        // Generate new backup codes
        const newBackupCodes = twoFactorAuthService._generateBackupCodes(8);
        const hashedBackupCodes = twoFactorAuthService.hashBackupCodes(newBackupCodes);

        // Update stored codes
        await userRef.update({
            'twoFactorAuth.backupCodes': hashedBackupCodes,
            'twoFactorAuth.backupCodesRegeneratedAt': new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: 'Backup codes regenerated successfully',
            data: {
                backupCodes: newBackupCodes // Plain text for user to save
            }
        });
    } catch (error) {
        console.error('Backup codes regeneration error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to regenerate backup codes',
            message: error.message
        });
    }
};
