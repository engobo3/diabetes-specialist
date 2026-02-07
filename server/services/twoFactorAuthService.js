/**
 * Two-Factor Authentication Service
 * Implements TOTP-based 2FA for enhanced security
 * Required for admin users, optional for doctors and patients
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const auditLogger = require('./auditLogger');

class TwoFactorAuthService {
    constructor() {
        this.appName = 'GlucoSoin';
        this.issuer = 'GlucoSoin Medical';
    }

    /**
     * Generate a new TOTP secret for a user
     * @param {string} userEmail - User's email address
     * @param {string} userName - User's display name
     * @returns {Object} Secret and QR code data
     */
    async generateSecret(userEmail, userName = null) {
        try {
            const secret = speakeasy.generateSecret({
                name: `${this.appName} (${userEmail})`,
                issuer: this.issuer,
                length: 32
            });

            // Generate QR code as data URL
            const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);

            // Generate backup codes (8 codes, 8 characters each)
            const backupCodes = this._generateBackupCodes(8);

            await auditLogger.logSecurity({
                userId: userEmail,
                userRole: 'user',
                eventType: '2fa_setup_initiated',
                description: '2FA setup initiated for user',
                severity: 'info',
                metadata: { userName }
            });

            return {
                secret: secret.base32,
                qrCode: qrCodeDataURL,
                backupCodes,
                otpauthUrl: secret.otpauth_url
            };
        } catch (error) {
            console.error('Error generating 2FA secret:', error);
            throw new Error('Failed to generate 2FA secret');
        }
    }

    /**
     * Verify a TOTP code
     * @param {string} secret - User's TOTP secret
     * @param {string} token - 6-digit code from authenticator app
     * @param {number} window - Time window for verification (default 1 = 30s before/after)
     * @returns {boolean} Whether the token is valid
     */
    verifyToken(secret, token, window = 1) {
        try {
            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: token,
                window: window
            });

            return verified;
        } catch (error) {
            console.error('Error verifying 2FA token:', error);
            return false;
        }
    }

    /**
     * Verify a backup code
     * @param {string} providedCode - Code provided by user
     * @param {Array} storedCodes - Array of hashed backup codes
     * @returns {Object} { valid: boolean, remainingCodes: Array }
     */
    verifyBackupCode(providedCode, storedCodes) {
        try {
            const hashedProvidedCode = this._hashBackupCode(providedCode);

            const codeIndex = storedCodes.findIndex(
                storedCode => storedCode === hashedProvidedCode
            );

            if (codeIndex === -1) {
                return { valid: false, remainingCodes: storedCodes };
            }

            // Remove used backup code
            const remainingCodes = storedCodes.filter((_, index) => index !== codeIndex);

            return { valid: true, remainingCodes };
        } catch (error) {
            console.error('Error verifying backup code:', error);
            return { valid: false, remainingCodes: storedCodes };
        }
    }

    /**
     * Generate backup codes for account recovery
     * @param {number} count - Number of codes to generate
     * @returns {Array} Array of backup codes (plain text for user to save)
     */
    _generateBackupCodes(count = 8) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    }

    /**
     * Hash a backup code for secure storage
     * @param {string} code - Plain text backup code
     * @returns {string} Hashed code
     */
    _hashBackupCode(code) {
        return crypto
            .createHash('sha256')
            .update(code.toUpperCase())
            .digest('hex');
    }

    /**
     * Hash all backup codes for storage
     * @param {Array} codes - Array of plain text codes
     * @returns {Array} Array of hashed codes
     */
    hashBackupCodes(codes) {
        return codes.map(code => this._hashBackupCode(code));
    }

    /**
     * Validate 2FA setup by verifying initial token
     * @param {string} secret - TOTP secret
     * @param {string} token - Verification token from user
     * @param {string} userId - User identifier
     * @returns {Promise<boolean>} Whether setup is valid
     */
    async validateSetup(secret, token, userId) {
        const isValid = this.verifyToken(secret, token);

        if (isValid) {
            await auditLogger.logSecurity({
                userId,
                userRole: 'user',
                eventType: '2fa_enabled',
                description: '2FA successfully enabled for user',
                severity: 'info'
            });
        } else {
            await auditLogger.logSecurity({
                userId,
                userRole: 'user',
                eventType: '2fa_setup_failed',
                description: '2FA setup validation failed - invalid token',
                severity: 'warning'
            });
        }

        return isValid;
    }

    /**
     * Log failed 2FA attempt
     * @param {string} userId - User identifier
     * @param {string} ipAddress - IP address of attempt
     */
    async logFailedAttempt(userId, ipAddress) {
        await auditLogger.logSecurity({
            userId,
            userRole: 'user',
            eventType: '2fa_failed',
            description: 'Failed 2FA verification attempt',
            severity: 'warning',
            metadata: { ipAddress }
        });
    }

    /**
     * Log successful 2FA verification
     * @param {string} userId - User identifier
     * @param {boolean} usedBackupCode - Whether backup code was used
     */
    async logSuccessfulVerification(userId, usedBackupCode = false) {
        await auditLogger.logSecurity({
            userId,
            userRole: 'user',
            eventType: '2fa_verified',
            description: usedBackupCode
                ? '2FA verified using backup code'
                : '2FA verified successfully',
            severity: 'info',
            metadata: { usedBackupCode }
        });
    }

    /**
     * Disable 2FA for a user
     * @param {string} userId - User identifier
     */
    async disable2FA(userId) {
        await auditLogger.logSecurity({
            userId,
            userRole: 'user',
            eventType: '2fa_disabled',
            description: '2FA disabled for user',
            severity: 'warning'
        });
    }
}

module.exports = new TwoFactorAuthService();
