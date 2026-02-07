/**
 * Middleware to enforce Two-Factor Authentication
 * Ensures users with 2FA enabled have completed verification
 * Required for admin routes and sensitive operations
 */

const { db } = require('../config/firebaseConfig');
const auditLogger = require('../services/auditLogger');

/**
 * Middleware to require 2FA verification
 * Checks if user has 2FA enabled and if session includes 2FA verification
 */
const require2FA = async (req, res, next) => {
    try {
        const { uid, email } = req.user;

        // Get user's 2FA status from Firestore
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

        // If 2FA is not enabled, allow access
        if (!twoFactorAuth.enabled) {
            return next();
        }

        // Check if 2FA has been verified in this session
        // In production, this would check a session token or JWT claim
        const twoFactorVerified = req.headers['x-2fa-verified'] === 'true';

        if (!twoFactorVerified) {
            await auditLogger.logSecurity({
                userId: email,
                eventType: '2fa_required',
                description: 'Access blocked - 2FA verification required',
                severity: 'warning',
                metadata: {
                    route: req.path,
                    method: req.method
                }
            });

            return res.status(403).json({
                success: false,
                error: '2FA verification required',
                requiresTwoFactor: true,
                message: 'Please complete 2FA verification to access this resource'
            });
        }

        // 2FA verified, allow access
        next();
    } catch (error) {
        console.error('2FA middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify 2FA status',
            message: error.message
        });
    }
};

/**
 * Middleware to enforce 2FA for admin users only
 * Admin users MUST have 2FA enabled, others are optional
 */
const enforceAdminTwoFactor = async (req, res, next) => {
    try {
        const { uid, email, role } = req.user;

        // Only enforce for admin users
        if (role !== 'admin') {
            return next();
        }

        // Get user's 2FA status
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

        // Admin users MUST have 2FA enabled
        if (!twoFactorAuth.enabled) {
            await auditLogger.logSecurity({
                userId: email,
                userRole: 'admin',
                eventType: 'admin_2fa_not_enabled',
                description: 'Admin user attempted to access resource without 2FA enabled',
                severity: 'critical',
                metadata: {
                    route: req.path,
                    method: req.method
                }
            });

            return res.status(403).json({
                success: false,
                error: 'Two-factor authentication is required for admin users',
                requiresSetup: true,
                message: 'Please enable 2FA to access admin features'
            });
        }

        // Check if 2FA has been verified
        const twoFactorVerified = req.headers['x-2fa-verified'] === 'true';

        if (!twoFactorVerified) {
            await auditLogger.logSecurity({
                userId: email,
                userRole: 'admin',
                eventType: 'admin_2fa_not_verified',
                description: 'Admin user attempted to access resource without 2FA verification',
                severity: 'warning',
                metadata: {
                    route: req.path,
                    method: req.method
                }
            });

            return res.status(403).json({
                success: false,
                error: '2FA verification required',
                requiresTwoFactor: true,
                message: 'Please verify your 2FA code to access admin features'
            });
        }

        next();
    } catch (error) {
        console.error('Admin 2FA enforcement error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to enforce 2FA',
            message: error.message
        });
    }
};

module.exports = {
    require2FA,
    enforceAdminTwoFactor
};
