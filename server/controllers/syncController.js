/**
 * Offline-sync controller (Phase 4a).
 *
 * POST /api/sync/batch  — accept a batch of append-only records, idempotent on
 *                         client_uuid. Returns a per-item disposition:
 *                           accepted  — newly written
 *                           duplicate — client_uuid already present (already synced)
 *                           rejected  — permanently invalid (client should drop + log)
 *                           deferred  — couldn't process now (PG down, or this
 *                                       account isn't migrated yet) → client keeps
 *                                       it queued and retries with backoff
 *
 * GET  /api/sync/changes — down-sync via SERVER-clock high-water-mark
 *                          (recorded_at), never the device clock.
 *
 * Scope: patient-self. The patient_profile is resolved from the token, never
 * trusted from the request body. Doctors/caregivers don't use this (their
 * clients are online); for them the patient resolves to null → deferred/empty.
 */

const { query } = require('../db/client');
const patientResolver = require('../services/patientResolver');
const audit = require('../services/auditServiceV2');
const { logError } = require('../utils/safeLogger');

/**
 * Resolve the authenticated user's patient_profiles UUID.
 *  - Postgres-sourced token already carries the profile UUID as patientId.
 *  - Firestore-sourced token carries the legacy patient id → resolve it.
 */
async function resolveAuthedPatientProfileId(req) {
    if (req.user?._userSource === 'postgres' && req.user.patientId) {
        return req.user.patientId;
    }
    if (req.user?.patientId != null) {
        return patientResolver.toProfileId(req.user.patientId);
    }
    return null;
}

async function syncBatch(req, res) {
    try {
        const profileId = await resolveAuthedPatientProfileId(req);
        const items = req.body.items;

        // Account not (yet) in Postgres — defer the whole batch. Client keeps queue.
        if (!profileId) {
            return res.status(200).json({
                results: items.map(i => ({ client_uuid: i.client_uuid, status: 'deferred', reason: 'account_not_migrated' }))
            });
        }

        const results = [];
        let accepted = 0, duplicate = 0, rejected = 0, deferred = 0;

        for (const item of items) {
            try {
                if (item.type === 'glucose') {
                    const measured = new Date(item.measured_at);
                    if (!Number.isFinite(measured.getTime())) {
                        results.push({ client_uuid: item.client_uuid, status: 'rejected', reason: 'bad_measured_at' });
                        rejected++;
                        continue;
                    }
                    const r = await query(
                        `INSERT INTO glucose_readings
                            (patient_id, value_mg_dl, measured_at, recorded_at, context, source, notes, client_uuid)
                         VALUES ($1, $2, $3, now(), $4, $5, $6, $7)
                         ON CONFLICT (client_uuid) DO NOTHING
                         RETURNING id`,
                        [
                            profileId,
                            item.value_mg_dl,
                            measured,
                            item.context || 'unknown',
                            item.source || 'manual',
                            item.notes || null,
                            item.client_uuid
                        ]
                    );
                    if (r._skipped) {
                        results.push({ client_uuid: item.client_uuid, status: 'deferred', reason: 'sync_unavailable' });
                        deferred++;
                    } else if (r.rowCount > 0) {
                        results.push({ client_uuid: item.client_uuid, status: 'accepted', id: r.rows[0].id });
                        accepted++;
                    } else {
                        results.push({ client_uuid: item.client_uuid, status: 'duplicate' });
                        duplicate++;
                    }
                } else {
                    // Unknown type — shouldn't happen (Zod union), but be safe.
                    results.push({ client_uuid: item.client_uuid, status: 'rejected', reason: 'unsupported_type' });
                    rejected++;
                }
            } catch (err) {
                logError('syncBatch item failed', err, { client_uuid: item.client_uuid, type: item.type });
                results.push({ client_uuid: item.client_uuid, status: 'rejected', reason: 'error' });
                rejected++;
            }
        }

        audit.log({
            action: 'sync.batch',
            resource_type: 'glucose_reading',
            actor_user_id: req.user?.userId || null,
            actor_firebase_uid: req.user?.uid || null,
            actor_role: req.user?.role || null,
            patient_id: profileId,
            request_id: req.requestId,
            ip_address: req.ip,
            metadata: { total: items.length, accepted, duplicate, rejected, deferred }
        });

        return res.status(200).json({ results });
    } catch (err) {
        logError('syncBatch failed', err, { userId: req.user?.uid });
        return res.status(500).json({ error: 'Sync failed' });
    }
}

async function getChanges(req, res) {
    try {
        const profileId = await resolveAuthedPatientProfileId(req);
        if (!profileId) {
            return res.status(200).json({ changes: [], watermark: req.query.since || null });
        }

        const since = req.query.since ? new Date(req.query.since) : new Date(0);
        const sinceValid = Number.isFinite(since.getTime()) ? since : new Date(0);
        const limit = req.query.limit || 500;

        const r = await query(
            `SELECT id, value_mg_dl, measured_at, recorded_at, context, source, notes, client_uuid
             FROM glucose_readings
             WHERE patient_id = $1 AND recorded_at > $2 AND deleted_at IS NULL
             ORDER BY recorded_at ASC
             LIMIT $3`,
            [profileId, sinceValid, limit]
        );

        if (r._skipped) {
            return res.status(200).json({ changes: [], watermark: req.query.since || null });
        }

        const changes = r.rows;
        // Watermark is the server-assigned recorded_at of the last row — never the device clock.
        const watermark = changes.length
            ? changes[changes.length - 1].recorded_at
            : (req.query.since || null);

        return res.status(200).json({ changes, watermark });
    } catch (err) {
        logError('getChanges failed', err, { userId: req.user?.uid });
        return res.status(500).json({ error: 'Sync changes failed' });
    }
}

module.exports = { syncBatch, getChanges, resolveAuthedPatientProfileId };
