/**
 * Audit Service v2 — Postgres dual-write with PHI redaction.
 *
 * PHASE 1 BEHAVIOR
 *   - Continues writing to Firestore via the legacy auditLogger (unchanged).
 *   - Additionally writes to Postgres `audit_log` (best-effort).
 *   - Never throws. Audit failures degrade to safeLogger.logError so the
 *     caller's request is never interrupted by a logging failure.
 *
 * PHI REDACTION
 *   - `metadata` is passed through safeLogger.redactPhi before INSERT.
 *     Keys listed in safeLogger.SENSITIVE_KEYS (name, email, phone,
 *     glucose, medication, etc.) become "[REDACTED]" in the stored JSONB.
 *     This is the application-level enforcement of the contract documented
 *     on the audit_log.metadata column.
 *
 * WHY A NEW MODULE (rather than modify auditLogger.js)
 *   - The existing auditLogger has a Firestore-shaped API (eventType,
 *     resourceType in camelCase, severity 'info'/'warning'). v2 uses the
 *     Postgres-shaped schema with snake_case fields. Keeping them separate
 *     means existing callers don't break, and we can migrate sites one by
 *     one to v2 instead of all at once.
 *   - When Postgres is the source of truth (later phase), v2 stops dual-
 *     writing and v1 is deleted.
 *
 * USAGE
 *   const audit = require('../services/auditServiceV2');
 *   await audit.log({
 *       action: 'patient_profile.read',
 *       resource_type: 'patient_profile',
 *       resource_id: patientId,
 *       actor_firebase_uid: req.user.uid,
 *       actor_role: req.user.role,
 *       patient_id: patientId,
 *       request_id: req.requestId,
 *       ip_address: req.ip,
 *       user_agent: req.headers['user-agent'],
 *       metadata: { fieldsAccessed: ['name', 'glucose'] }   // redacted
 *   });
 */

const { query } = require('../db/client');
const { redactPhi, logError } = require('../utils/safeLogger');
const legacyAuditLogger = require('./auditLogger');

const INSERT_SQL = `
    INSERT INTO audit_log (
        action, resource_type, resource_id,
        actor_user_id, actor_firebase_uid, actor_role,
        patient_id, success, severity,
        request_id, ip_address, user_agent, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
`;

/**
 * Map a v2 event to the legacy logger's eventType so Firestore audit_logs
 * keeps its existing shape.
 */
function inferLegacyEventType({ severity, success, action }) {
    if (severity === 'warning' || severity === 'critical' || success === false) {
        return 'SECURITY';
    }
    if (
        action &&
        /\.(create|update|delete|modify|write|insert)$/i.test(action)
    ) {
        return 'DATA_MODIFICATION';
    }
    return 'DATA_ACCESS';
}

/**
 * Append an audit event. Returns the inserted row's id (Postgres) or null if
 * Postgres writes are disabled. Never throws.
 */
async function log(event = {}) {
    const {
        action,
        resource_type,
        resource_id = null,
        actor_user_id = null,
        actor_firebase_uid = null,
        actor_role = null,
        patient_id = null,
        success = true,
        severity = 'info',
        request_id = null,
        ip_address = null,
        user_agent = null,
        metadata = {}
    } = event;

    // Defensive: required fields. Don't throw — audit must never break a request.
    if (!action || !resource_type) {
        logError('auditServiceV2: missing required field', new Error('action and resource_type are required'), {
            actionPresent: Boolean(action),
            resourceTypePresent: Boolean(resource_type)
        });
        return null;
    }

    // ── 1. Legacy Firestore write (preserve existing behavior) ──
    try {
        const eventType = inferLegacyEventType({ severity, success, action });
        await legacyAuditLogger.log({
            eventType,
            userId: actor_firebase_uid || actor_user_id,
            userRole: actor_role,
            resourceType: resource_type,
            resourceId: resource_id,
            action,
            success,
            severity,
            metadata
        });
    } catch (err) {
        // logError already redacts the context
        logError('auditServiceV2: legacy Firestore write failed', err, {
            action,
            resource_type
        });
    }

    // ── 2. Postgres dual-write (best effort) ──
    try {
        const safeMetadata = redactPhi(metadata);
        const result = await query(INSERT_SQL, [
            action,
            resource_type,
            resource_id ? String(resource_id) : null,
            actor_user_id,
            actor_firebase_uid,
            actor_role,
            patient_id,
            success,
            severity,
            request_id,
            ip_address,
            user_agent,
            JSON.stringify(safeMetadata ?? {})
        ]);

        if (result._skipped) {
            // Pool not configured — expected during early Phase 1 dev. Not an error.
            return null;
        }
        return result.rows?.[0]?.id ?? null;
    } catch (err) {
        // Don't propagate — audit failures must not break the request.
        logError('auditServiceV2: Postgres audit_log insert failed', err, {
            action,
            resource_type
        });
        return null;
    }
}

module.exports = { log };
