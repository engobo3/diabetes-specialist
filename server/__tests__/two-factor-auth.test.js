/**
 * Two-Factor Authentication Test Suite
 * Tests 2FA setup, verification, and enforcement
 */

const twoFactorAuthService = require('../services/twoFactorAuthService');
const speakeasy = require('speakeasy');

describe('Two-Factor Authentication', () => {
    describe('Secret Generation', () => {
        it('should generate a valid TOTP secret', async () => {
            const result = await twoFactorAuthService.generateSecret(
                'test@example.com',
                'Test User'
            );

            expect(result).toHaveProperty('secret');
            expect(result).toHaveProperty('qrCode');
            expect(result).toHaveProperty('backupCodes');
            expect(result).toHaveProperty('otpauthUrl');

            // Secret should be base32 encoded
            expect(result.secret).toMatch(/^[A-Z2-7]+$/);

            // Should have 8 backup codes
            expect(result.backupCodes).toHaveLength(8);

            // Each backup code should be 8 characters
            result.backupCodes.forEach(code => {
                expect(code).toHaveLength(8);
                expect(code).toMatch(/^[A-F0-9]+$/);
            });

            // QR code should be a data URL
            expect(result.qrCode).toMatch(/^data:image\/png;base64,/);

            // OTPAuth URL should be properly formatted
            expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
            // Email is URL-encoded in the OTPAuth URL
            expect(result.otpauthUrl).toMatch(/test(%40|@)example\.com/);
        });
    });

    describe('Token Verification', () => {
        let testSecret;

        beforeAll(async () => {
            const result = await twoFactorAuthService.generateSecret('test@example.com');
            testSecret = result.secret;
        });

        it('should verify a valid TOTP token', () => {
            // Generate a valid token
            const validToken = speakeasy.totp({
                secret: testSecret,
                encoding: 'base32'
            });

            const isValid = twoFactorAuthService.verifyToken(testSecret, validToken);
            expect(isValid).toBe(true);
        });

        it('should reject an invalid TOTP token', () => {
            const invalidToken = '000000';

            const isValid = twoFactorAuthService.verifyToken(testSecret, invalidToken);
            expect(isValid).toBe(false);
        });

        it('should reject tokens that are too old', () => {
            // Generate a token from 5 minutes ago (outside window)
            const oldToken = speakeasy.totp({
                secret: testSecret,
                encoding: 'base32',
                time: Math.floor(Date.now() / 1000) - 300
            });

            const isValid = twoFactorAuthService.verifyToken(testSecret, oldToken, 1);
            expect(isValid).toBe(false);
        });

        it('should accept tokens within the time window', () => {
            // Generate a token from 30 seconds ago (within default window)
            const recentToken = speakeasy.totp({
                secret: testSecret,
                encoding: 'base32',
                time: Math.floor(Date.now() / 1000) - 30
            });

            const isValid = twoFactorAuthService.verifyToken(testSecret, recentToken, 1);
            expect(isValid).toBe(true);
        });
    });

    describe('Backup Code Verification', () => {
        let plainCodes;
        let hashedCodes;

        beforeAll(async () => {
            const result = await twoFactorAuthService.generateSecret('test@example.com');
            plainCodes = result.backupCodes;
            hashedCodes = twoFactorAuthService.hashBackupCodes(plainCodes);
        });

        it('should verify a valid backup code', () => {
            const validCode = plainCodes[0];

            const result = twoFactorAuthService.verifyBackupCode(validCode, hashedCodes);

            expect(result.valid).toBe(true);
            expect(result.remainingCodes).toHaveLength(hashedCodes.length - 1);
        });

        it('should reject an invalid backup code', () => {
            const invalidCode = '00000000';

            const result = twoFactorAuthService.verifyBackupCode(invalidCode, hashedCodes);

            expect(result.valid).toBe(false);
            expect(result.remainingCodes).toHaveLength(hashedCodes.length);
        });

        it('should be case-insensitive', () => {
            const validCode = plainCodes[1].toLowerCase();

            const result = twoFactorAuthService.verifyBackupCode(validCode, hashedCodes);

            expect(result.valid).toBe(true);
        });

        it('should remove used backup code from list', () => {
            const validCode = plainCodes[2];

            const result = twoFactorAuthService.verifyBackupCode(validCode, hashedCodes);

            expect(result.valid).toBe(true);
            expect(result.remainingCodes).toHaveLength(hashedCodes.length - 1);

            // Should not be able to use the same code twice
            const secondAttempt = twoFactorAuthService.verifyBackupCode(
                validCode,
                result.remainingCodes
            );
            expect(secondAttempt.valid).toBe(false);
        });
    });

    describe('Backup Code Hashing', () => {
        it('should hash backup codes consistently', () => {
            const code = 'ABCD1234';

            const hash1 = twoFactorAuthService._hashBackupCode(code);
            const hash2 = twoFactorAuthService._hashBackupCode(code);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different codes', () => {
            const code1 = 'ABCD1234';
            const code2 = 'EFGH5678';

            const hash1 = twoFactorAuthService._hashBackupCode(code1);
            const hash2 = twoFactorAuthService._hashBackupCode(code2);

            expect(hash1).not.toBe(hash2);
        });

        it('should hash all codes in an array', () => {
            const codes = ['AAAA1111', 'BBBB2222', 'CCCC3333'];

            const hashedCodes = twoFactorAuthService.hashBackupCodes(codes);

            expect(hashedCodes).toHaveLength(3);
            hashedCodes.forEach(hash => {
                expect(typeof hash).toBe('string');
                expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
            });
        });
    });

    describe('Setup Validation', () => {
        let testSecret;

        beforeEach(async () => {
            const result = await twoFactorAuthService.generateSecret('test@example.com');
            testSecret = result.secret;
        });

        it('should validate setup with correct token', async () => {
            const validToken = speakeasy.totp({
                secret: testSecret,
                encoding: 'base32'
            });

            const isValid = await twoFactorAuthService.validateSetup(
                testSecret,
                validToken,
                'test@example.com'
            );

            expect(isValid).toBe(true);
        });

        it('should reject setup with incorrect token', async () => {
            const invalidToken = '000000';

            const isValid = await twoFactorAuthService.validateSetup(
                testSecret,
                invalidToken,
                'test@example.com'
            );

            expect(isValid).toBe(false);
        });
    });

    describe('Audit Logging', () => {
        it('should log successful verification', async () => {
            // This is a smoke test - just ensure it doesn't throw
            await expect(
                twoFactorAuthService.logSuccessfulVerification('test-user', false)
            ).resolves.not.toThrow();
        });

        it('should log failed attempts', async () => {
            await expect(
                twoFactorAuthService.logFailedAttempt('test-user', '192.168.1.1')
            ).resolves.not.toThrow();
        });

        it('should log 2FA disable', async () => {
            await expect(
                twoFactorAuthService.disable2FA('test-user')
            ).resolves.not.toThrow();
        });

        it('should log backup code usage', async () => {
            await expect(
                twoFactorAuthService.logSuccessfulVerification('test-user', true)
            ).resolves.not.toThrow();
        });
    });

    describe('Security Properties', () => {
        it('should generate unique secrets for each user', async () => {
            const result1 = await twoFactorAuthService.generateSecret('user1@example.com');
            const result2 = await twoFactorAuthService.generateSecret('user2@example.com');

            expect(result1.secret).not.toBe(result2.secret);
        });

        it('should generate unique backup codes for each setup', async () => {
            const result1 = await twoFactorAuthService.generateSecret('user@example.com');
            const result2 = await twoFactorAuthService.generateSecret('user@example.com');

            expect(result1.backupCodes).not.toEqual(result2.backupCodes);
        });

        it('should not accept tokens from different secret', () => {
            const secret1 = speakeasy.generateSecret({ length: 32 }).base32;
            const secret2 = speakeasy.generateSecret({ length: 32 }).base32;

            const token = speakeasy.totp({
                secret: secret1,
                encoding: 'base32'
            });

            const isValid = twoFactorAuthService.verifyToken(secret2, token);
            expect(isValid).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty token gracefully', () => {
            const secret = speakeasy.generateSecret({ length: 32 }).base32;
            const isValid = twoFactorAuthService.verifyToken(secret, '');
            expect(isValid).toBe(false);
        });

        it('should handle null token gracefully', () => {
            const secret = speakeasy.generateSecret({ length: 32 }).base32;
            const isValid = twoFactorAuthService.verifyToken(secret, null);
            expect(isValid).toBe(false);
        });

        it('should handle empty backup codes array', () => {
            const result = twoFactorAuthService.verifyBackupCode('ABCD1234', []);
            expect(result.valid).toBe(false);
            expect(result.remainingCodes).toEqual([]);
        });

        it('should handle malformed backup code', () => {
            const hashedCodes = ['validhash1', 'validhash2'];
            const result = twoFactorAuthService.verifyBackupCode('!@#$%^&*', hashedCodes);
            expect(result.valid).toBe(false);
        });
    });
});
