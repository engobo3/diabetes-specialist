/**
 * Data Retention Service
 *
 * HIPAA requires audit logs to be retained for at least 6 years. After that,
 * they should be purged to limit data exposure. This service implements those
 * deletions in batches that fit Firestore's quotas.
 *
 * Scope:
 *   - audit_logs older than 6 years → deleted
 *   - user_sessions older than 30 days that are already invalidated → deleted
 *   - caregiver_invitations in terminal state older than 1 year → deleted
 *
 * Active medical records, vitals, prescriptions, and patient profiles are
 * NEVER purged by this service — that's a clinical decision, not a technical one.
 */

const { db } = require('../config/firebaseConfig');
const auditLogger = require('./auditLogger');

const SIX_YEARS_MS = 6 * 365.25 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

const BATCH_SIZE = 400;  // Firestore batch limit is 500 — leave headroom

async function deleteOlderThan({ collection, field, cutoffMs, label, where = null }) {
    if (!db) return { deleted: 0, skipped: 'db_unavailable' };

    const cutoff = new Date(Date.now() - cutoffMs).toISOString();
    let totalDeleted = 0;
    let lastDoc = null;

    while (true) {
        let query = db.collection(collection)
            .where(field, '<', cutoff)
            .orderBy(field)
            .limit(BATCH_SIZE);

        if (where) {
            query = where.reduce((q, [f, op, v]) => q.where(f, op, v), query);
        }
        if (lastDoc) query = query.startAfter(lastDoc);

        const snap = await query.get();
        if (snap.empty) break;

        const batch = db.batch();
        for (const doc of snap.docs) batch.delete(doc.ref);
        await batch.commit();

        totalDeleted += snap.docs.length;
        lastDoc = snap.docs[snap.docs.length - 1];

        if (snap.docs.length < BATCH_SIZE) break;
    }

    return { deleted: totalDeleted, label, cutoff };
}

async function purgeOldAuditLogs() {
    const result = await deleteOlderThan({
        collection: 'audit_logs',
        field: 'timestamp',
        cutoffMs: SIX_YEARS_MS,
        label: 'audit_logs_6yr'
    });

    // Log the retention activity itself — meta-audit
    await auditLogger.logSecurity({
        userId: 'system',
        userRole: 'system',
        eventType: 'retention_purge',
        description: `Purged ${result.deleted} audit_logs older than 6 years`,
        severity: 'info',
        metadata: result
    }).catch(() => {});

    return result;
}

async function purgeInvalidatedSessions() {
    const result = await deleteOlderThan({
        collection: 'user_sessions',
        field: 'invalidatedAt',
        cutoffMs: THIRTY_DAYS_MS,
        label: 'invalidated_sessions_30d',
        where: [['status', '==', 'invalidated']]
    });

    await auditLogger.logSecurity({
        userId: 'system',
        userRole: 'system',
        eventType: 'retention_purge',
        description: `Purged ${result.deleted} invalidated sessions older than 30 days`,
        severity: 'info',
        metadata: result
    }).catch(() => {});

    return result;
}

async function purgeOldInvitations() {
    // Invitations in terminal states (rejected, cancelled, expired) older than 1 year
    let totalDeleted = 0;
    const terminalStates = ['rejected', 'cancelled', 'expired'];
    const cutoff = new Date(Date.now() - ONE_YEAR_MS).toISOString();

    if (!db) return { deleted: 0, skipped: 'db_unavailable' };

    for (const status of terminalStates) {
        let lastDoc = null;
        while (true) {
            let query = db.collection('caregiver_invitations')
                .where('status', '==', status)
                .where('createdAt', '<', cutoff)
                .orderBy('createdAt')
                .limit(BATCH_SIZE);
            if (lastDoc) query = query.startAfter(lastDoc);

            const snap = await query.get();
            if (snap.empty) break;

            const batch = db.batch();
            for (const doc of snap.docs) batch.delete(doc.ref);
            await batch.commit();

            totalDeleted += snap.docs.length;
            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.docs.length < BATCH_SIZE) break;
        }
    }

    await auditLogger.logSecurity({
        userId: 'system',
        userRole: 'system',
        eventType: 'retention_purge',
        description: `Purged ${totalDeleted} terminal-state invitations older than 1 year`,
        severity: 'info',
        metadata: { deleted: totalDeleted }
    }).catch(() => {});

    return { deleted: totalDeleted, label: 'invitations_1yr' };
}

async function runAllRetention() {
    const results = {
        startedAt: new Date().toISOString(),
        auditLogs: null,
        sessions: null,
        invitations: null,
        errors: []
    };

    try {
        results.auditLogs = await purgeOldAuditLogs();
    } catch (err) {
        results.errors.push({ task: 'auditLogs', message: err.message });
    }
    try {
        results.sessions = await purgeInvalidatedSessions();
    } catch (err) {
        results.errors.push({ task: 'sessions', message: err.message });
    }
    try {
        results.invitations = await purgeOldInvitations();
    } catch (err) {
        results.errors.push({ task: 'invitations', message: err.message });
    }

    results.completedAt = new Date().toISOString();
    return results;
}

module.exports = {
    runAllRetention,
    purgeOldAuditLogs,
    purgeInvalidatedSessions,
    purgeOldInvitations
};
