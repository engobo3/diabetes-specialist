/**
 * Deterministic UUID (RFC-4122 v5-style: SHA1 of a fixed namespace + name).
 *
 * Used so that the same logical record always maps to the same UUID, whether
 * it's written by the one-time Firestore→Postgres loader or by a live
 * dual-write at request time. That makes `ON CONFLICT (client_uuid) DO NOTHING`
 * a reliable dedupe key across both paths.
 *
 * IMPORTANT: the namespace and algorithm here MUST match anything that needs
 * to produce the same UUID for the same input. Both load_clinical_content.js
 * and glucoseService.js import this module so they stay in lockstep — do not
 * fork a second copy.
 */

const crypto = require('crypto');

// Fixed namespace. Changing this invalidates all previously-derived UUIDs, so
// never change it once data has been written.
const MIGRATION_NS = '8f2b1c4e-3a5d-4e6f-9b0a-1c2d3e4f5a6b';

function deterministicUuid(...parts) {
    const name = parts.map(String).join(':');
    const hash = crypto.createHash('sha1')
        .update(MIGRATION_NS)
        .update(':')
        .update(name)
        .digest('hex');
    const bytes = Buffer.from(hash.slice(0, 32), 'hex');
    bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
    const h = bytes.toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

module.exports = { deterministicUuid, MIGRATION_NS };
