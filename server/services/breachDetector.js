/**
 * Breach / Anomaly Detector
 *
 * Reads the audit log and flags suspicious access patterns that could indicate
 * a credential compromise or insider misuse:
 *   - **Bulk PHI access**: one user reading > N distinct patient records in a
 *     short window.
 *   - **Off-hours access**: non-admin users hitting PHI outside business hours.
 *   - **Mass exports**: one user pulling > M PDF dossiers in 24h.
 *   - **RBAC denial spike**: many "rbac_denied" events from a single user
 *     (probable enumeration attack).
 *
 * Each detected anomaly is written back to the audit log as a SECURITY event,
 * and an email alert is sent for high-severity findings. This is meant to run
 * as a scheduled Cloud Function (see server.js).
 */

const { db } = require('../config/firebaseConfig');
const auditLogger = require('./auditLogger');
const emailService = require('./emailNotificationService');

// ── Thresholds ──────────────────────────────────────────────────────────
const BULK_ACCESS_PATIENT_THRESHOLD = 50;     // distinct patients in window
const BULK_ACCESS_WINDOW_MIN = 15;
const MASS_EXPORT_THRESHOLD = 20;             // PDF exports in 24h
const RBAC_DENIAL_THRESHOLD = 10;             // denials per user per hour
const OFF_HOURS_START = 22;                   // 22:00 local
const OFF_HOURS_END = 5;                      // 05:00 local

function isOffHours(date) {
    const h = date.getHours();
    return h >= OFF_HOURS_START || h < OFF_HOURS_END;
}

async function fetchAuditLogs(sinceMs) {
    if (!db) return [];
    const since = new Date(Date.now() - sinceMs).toISOString();
    const snap = await db.collection('audit_logs')
        .where('timestamp', '>=', since)
        .limit(5000)
        .get();
    return snap.docs.map(d => d.data());
}

async function detectBulkPatientAccess(logs) {
    const byUser = new Map();
    const windowMs = BULK_ACCESS_WINDOW_MIN * 60 * 1000;
    const cutoff = Date.now() - windowMs;

    for (const log of logs) {
        if (log.eventType !== 'data_access') continue;
        if (!log.resourceId || log.resourceId === 'multiple') continue;
        const ts = new Date(log.timestamp || 0).getTime();
        if (ts < cutoff) continue;
        if (!log.userId) continue;

        if (!byUser.has(log.userId)) byUser.set(log.userId, { role: log.userRole, ids: new Set() });
        byUser.get(log.userId).ids.add(String(log.resourceId));
    }

    const findings = [];
    for (const [userId, info] of byUser) {
        if (info.ids.size >= BULK_ACCESS_PATIENT_THRESHOLD) {
            findings.push({
                severity: 'critical',
                pattern: 'bulk_patient_access',
                userId,
                userRole: info.role,
                description: `User accessed ${info.ids.size} distinct patient records in ${BULK_ACCESS_WINDOW_MIN} min`,
                metadata: { distinctPatients: info.ids.size, windowMin: BULK_ACCESS_WINDOW_MIN }
            });
        }
    }
    return findings;
}

async function detectMassExports(logs) {
    const byUser = new Map();
    for (const log of logs) {
        if (log.action !== 'export') continue;
        if (!log.userId) continue;
        byUser.set(log.userId, (byUser.get(log.userId) || 0) + 1);
    }

    const findings = [];
    for (const [userId, count] of byUser) {
        if (count >= MASS_EXPORT_THRESHOLD) {
            findings.push({
                severity: 'critical',
                pattern: 'mass_export',
                userId,
                description: `User exported ${count} patient dossiers in 24h`,
                metadata: { exportCount: count }
            });
        }
    }
    return findings;
}

async function detectRbacDenialSpike(logs) {
    const byUser = new Map();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const log of logs) {
        if (log.eventType !== 'rbac_denied') continue;
        const ts = new Date(log.timestamp || 0).getTime();
        if (ts < oneHourAgo) continue;
        if (!log.userId) continue;
        byUser.set(log.userId, (byUser.get(log.userId) || 0) + 1);
    }

    const findings = [];
    for (const [userId, count] of byUser) {
        if (count >= RBAC_DENIAL_THRESHOLD) {
            findings.push({
                severity: 'warning',
                pattern: 'rbac_denial_spike',
                userId,
                description: `User triggered ${count} RBAC denials in 1h — possible enumeration probe`,
                metadata: { denialCount: count }
            });
        }
    }
    return findings;
}

async function detectOffHoursAccess(logs) {
    // Group by user, count off-hours accesses. A single off-hours read isn't a
    // finding — but a pattern of them by a non-admin is.
    const byUser = new Map();
    for (const log of logs) {
        if (log.eventType !== 'data_access') continue;
        if (log.userRole === 'admin') continue; // admins are expected to be online
        const ts = new Date(log.timestamp || 0);
        if (!isOffHours(ts)) continue;
        if (!log.userId) continue;
        if (!byUser.has(log.userId)) byUser.set(log.userId, { role: log.userRole, count: 0 });
        byUser.get(log.userId).count++;
    }

    const findings = [];
    for (const [userId, info] of byUser) {
        if (info.count >= 10) {
            findings.push({
                severity: 'info',
                pattern: 'off_hours_access',
                userId,
                userRole: info.role,
                description: `User had ${info.count} off-hours PHI accesses (between ${OFF_HOURS_START}:00 and ${OFF_HOURS_END}:00)`,
                metadata: { count: info.count }
            });
        }
    }
    return findings;
}

async function emitFinding(finding) {
    await auditLogger.logSecurity({
        userId: finding.userId,
        userRole: finding.userRole || 'unknown',
        eventType: 'breach_detected',
        description: `${finding.pattern}: ${finding.description}`,
        severity: finding.severity,
        metadata: finding.metadata
    });

    if (finding.severity === 'critical') {
        await emailService.notifySuspiciousActivity({
            userId: finding.userId,
            activity: finding.pattern,
            metadata: { description: finding.description, ...finding.metadata },
            timestamp: new Date().toISOString()
        }).catch(err => console.error('Breach alert email failed:', err.message));
    }
}

/**
 * Run all detectors on the last 24h of audit logs. Returns the list of findings
 * for inspection or testing.
 */
async function runDetection() {
    const dayMs = 24 * 60 * 60 * 1000;
    const logs = await fetchAuditLogs(dayMs);

    const allFindings = [];
    const detectors = [
        detectBulkPatientAccess,
        detectMassExports,
        detectRbacDenialSpike,
        detectOffHoursAccess
    ];

    for (const detector of detectors) {
        try {
            const findings = await detector(logs);
            for (const f of findings) {
                await emitFinding(f);
                allFindings.push(f);
            }
        } catch (err) {
            console.error(`Breach detector ${detector.name} failed:`, err.message);
        }
    }

    return allFindings;
}

module.exports = {
    runDetection,
    // Exported for unit tests
    detectBulkPatientAccess,
    detectMassExports,
    detectRbacDenialSpike,
    detectOffHoursAccess
};
