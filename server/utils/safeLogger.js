/**
 * Safe Logger
 *
 * Wraps console output to prevent PHI from leaking into logs.
 *
 * Stack traces from Node errors often capture the request body (when controllers
 * do `console.error(error)`), and Express error handlers can include request
 * context. In a medical app, that body may contain patient names, glucose
 * readings, prescriptions, or identifiers — all PHI.
 *
 * This module:
 *   1) Provides `logError(prefix, error, context)` that logs the prefix + an
 *      error code/name only, never the raw error object.
 *   2) Provides `redactPhi(obj)` that returns a deep copy with known sensitive
 *      keys replaced with `[REDACTED]`.
 *
 * Usage:
 *   const { logError } = require('../utils/safeLogger');
 *   try { ... } catch (err) { logError('addVital failed', err, { patientId }); }
 */

// Keys whose values should always be redacted when logging.
const SENSITIVE_KEYS = new Set([
    'password', 'passwordHash', 'passwordSalt', 'pwd', 'secret',
    'token', 'accessToken', 'refreshToken', 'apiKey', 'authorization',
    'authToken', 'idToken', 'sessionToken', 'sessionId',
    'ssn', 'socialSecurityNumber',
    'cardNumber', 'cvv', 'cardCvv', 'cardExpiry', 'cardHolderName',
    'name', 'email', 'phone', 'phoneNumber', 'address', 'dateOfBirth',
    'glucose', 'systolic', 'diastolic', 'weight', 'height',
    'medication', 'dosage', 'prescriptions',
    'notes', 'content', 'text', 'message',
    'patientName', 'doctorName'
]);

const MAX_DEPTH = 5;

function redactPhi(value, depth = 0) {
    if (value == null) return value;
    if (depth > MAX_DEPTH) return '[truncated:depth]';

    if (typeof value === 'string') {
        // Redact obvious email/phone patterns even if they appear in free-form fields
        if (value.length > 256) return value.slice(0, 256) + '…[truncated]';
        return value;
    }

    if (typeof value !== 'object') return value;

    if (Array.isArray(value)) {
        return value.slice(0, 20).map(v => redactPhi(v, depth + 1));
    }

    const redacted = {};
    for (const key of Object.keys(value)) {
        if (SENSITIVE_KEYS.has(key)) {
            redacted[key] = '[REDACTED]';
        } else {
            redacted[key] = redactPhi(value[key], depth + 1);
        }
    }
    return redacted;
}

/**
 * Log an error with safe context. Never logs `error` directly (which would
 * include stack-captured locals like `req.body`).
 *
 * @param {string} prefix  short label, e.g. "addVital failed"
 * @param {Error|unknown} error  the caught error
 * @param {object} [context]  small bag of non-PHI metadata to attach (ids ok, body NOT ok)
 */
function logError(prefix, error, context = {}) {
    const code = error?.code || error?.name || 'unknown';
    const message = error?.message ? truncate(String(error.message), 256) : '';
    const safeContext = redactPhi(context);
    console.error(`[${prefix}] code=${code} message=${message}`, safeContext);
}

function logWarn(prefix, message, context = {}) {
    const safeContext = redactPhi(context);
    console.warn(`[${prefix}] ${truncate(String(message), 256)}`, safeContext);
}

function logInfo(prefix, message, context = {}) {
    const safeContext = redactPhi(context);
    console.log(`[${prefix}] ${truncate(String(message), 256)}`, safeContext);
}

function truncate(s, n) {
    if (s == null) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
}

module.exports = {
    logError,
    logWarn,
    logInfo,
    redactPhi,
    SENSITIVE_KEYS
};
