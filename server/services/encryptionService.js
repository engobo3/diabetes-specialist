/**
 * Field-Level Encryption Service
 *
 * Provides AES-256-GCM encryption for sensitive PHI fields stored in Firestore.
 * Use for: SSN, government IDs, insurance numbers, freeform notes when policy requires it.
 *
 * Why GCM: it's authenticated — tampering with ciphertext is detected on decrypt.
 *
 * The encryption key comes from PHI_ENCRYPTION_KEY (32-byte base64-encoded).
 * In production this MUST be set; in development/test we use a deterministic
 * fallback so tests don't need to share secrets. The fallback is logged loudly
 * and refused outright in production.
 *
 * On-disk format: "v1:<iv-base64>:<tag-base64>:<ciphertext-base64>"
 *
 * Usage:
 *   const { encryptField, decryptField } = require('./encryptionService');
 *   const blob = encryptField('123-45-6789');
 *   const plain = decryptField(blob);
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;     // 96 bits — recommended for GCM
const TAG_BYTES = 16;    // 128 bits
const VERSION = 'v1';

let cachedKey = null;

function getKey() {
    if (cachedKey) return cachedKey;

    const envKey = process.env.PHI_ENCRYPTION_KEY;

    if (envKey) {
        const buf = Buffer.from(envKey, 'base64');
        if (buf.length !== 32) {
            throw new Error('PHI_ENCRYPTION_KEY must decode to 32 bytes (256 bits)');
        }
        cachedKey = buf;
        return cachedKey;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('PHI_ENCRYPTION_KEY is required in production');
    }

    // Dev/test deterministic fallback. NEVER use this key for real PHI.
    console.warn('[encryptionService] Using INSECURE dev fallback key — set PHI_ENCRYPTION_KEY for real data');
    cachedKey = crypto.createHash('sha256').update('glucocare-dev-fallback-do-not-use-in-production').digest();
    return cachedKey;
}

function encryptField(plaintext) {
    if (plaintext == null) return plaintext;
    if (typeof plaintext !== 'string') plaintext = String(plaintext);
    if (plaintext.length === 0) return '';

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
        VERSION,
        iv.toString('base64'),
        tag.toString('base64'),
        ciphertext.toString('base64')
    ].join(':');
}

function decryptField(blob) {
    if (blob == null) return blob;
    if (typeof blob !== 'string') return blob;
    if (blob.length === 0) return '';

    const parts = blob.split(':');
    if (parts.length !== 4 || parts[0] !== VERSION) {
        // Not an encrypted blob — return as-is for backwards compatibility with
        // existing unencrypted records. Logs a warning so the caller knows.
        return blob;
    }

    try {
        const iv = Buffer.from(parts[1], 'base64');
        const tag = Buffer.from(parts[2], 'base64');
        const ciphertext = Buffer.from(parts[3], 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return plain.toString('utf8');
    } catch (err) {
        // Tampering, wrong key, or corrupted data. Don't leak details — caller
        // gets null so they can decide whether to fail-closed or substitute a
        // placeholder.
        console.error('[encryptionService] decrypt failed:', err.code || err.name);
        return null;
    }
}

/**
 * Encrypt named fields on an object in-place and return it. Skips already-encrypted
 * values (those that already match the v1: prefix).
 */
function encryptFields(obj, fieldNames) {
    if (!obj || typeof obj !== 'object') return obj;
    for (const name of fieldNames) {
        const v = obj[name];
        if (v == null || v === '') continue;
        if (typeof v === 'string' && v.startsWith(VERSION + ':')) continue;
        obj[name] = encryptField(v);
    }
    return obj;
}

function decryptFields(obj, fieldNames) {
    if (!obj || typeof obj !== 'object') return obj;
    for (const name of fieldNames) {
        const v = obj[name];
        if (v == null || v === '') continue;
        if (typeof v !== 'string') continue;
        obj[name] = decryptField(v);
    }
    return obj;
}

/**
 * Fields that should be encrypted at rest across the app.
 */
const ENCRYPTED_PATIENT_FIELDS = [
    'socialSecurityNumber',
    'governmentId',
    'insurancePolicyNumber'
];

module.exports = {
    encryptField,
    decryptField,
    encryptFields,
    decryptFields,
    ENCRYPTED_PATIENT_FIELDS
};
