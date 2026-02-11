const crypto = require('crypto');

/**
 * Generate a 6-digit numeric activation code
 */
function generateActivationCode() {
    const randomInt = crypto.randomBytes(4).readUInt32BE(0);
    return String(100000 + (randomInt % 900000));
}

/**
 * Generate expiry date (24 hours from now)
 */
function generateCodeExpiry() {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

module.exports = { generateActivationCode, generateCodeExpiry };
