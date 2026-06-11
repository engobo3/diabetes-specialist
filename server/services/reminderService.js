/**
 * Reminder Service (Phase 5) — pre-generated medication reminders.
 *
 * GENERATION (hourly): for every active medication_schedule, pre-create
 * medication_reminders rows for the next 14 days. Schedule times are LOCAL
 * 'HH:MM' strings; conversion to UTC happens HERE, at generation, using the
 * patient's notification_preferences.timezone (default Africa/Kinshasa).
 * Idempotent via the partial unique index on (schedule, scheduled_at_utc).
 *
 * DISPATCH (per minute): claim due pending rows with FOR UPDATE SKIP LOCKED
 * inside a transaction (safe under concurrent dispatchers), mark them 'sent',
 * then deliver FCM/in-app notifications OUTSIDE the transaction so row locks
 * are never held across network I/O. Claim-before-send = at-most-once delivery;
 * a delivery failure records last_error but does not retry (the row was
 * claimed) — operators see failures in the table.
 *
 * Rows older than 6h that were never sent are swept to 'missed' (the brief:
 * "ignores reminders >6h stale" — a 7am reminder delivered at 3pm is noise).
 *
 * Everything no-ops gracefully when Postgres is unconfigured (_skipped), and
 * nothing here throws into a request path.
 */

const { query, withTransaction } = require('../db/client');
const { logError } = require('../utils/safeLogger');
const { localToUtc, isoDateInTz, DEFAULT_TZ, TIME_RE } = require('../utils/timezone');

const HORIZON_DAYS = 14;
const STALE_HOURS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' from a pg date (Date object) or string. */
function isoDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
}

const ACTIVE_SCHEDULES_SQL = `
    SELECT ms.id, ms.patient_id, ms.times, ms.start_date, ms.end_date,
           COALESCE(np.timezone, $1)                        AS tz,
           COALESCE(np.medication_reminder_enabled, true)   AS enabled
    FROM medication_schedules ms
    LEFT JOIN notification_preferences np ON np.patient_id = ms.patient_id
    WHERE ms.active = true AND ms.deleted_at IS NULL
`;

const INSERT_REMINDER_SQL = `
    INSERT INTO medication_reminders
        (medication_schedule_id, patient_id, scheduled_at_utc, scheduled_local, timezone, status)
    VALUES ($1, $2, $3, $4, $5, 'pending')
    ON CONFLICT (medication_schedule_id, scheduled_at_utc)
        WHERE parent_reminder_id IS NULL AND status <> 'cancelled'
        DO NOTHING
    RETURNING id
`;

/**
 * Generate upcoming reminder rows for one schedule row (as returned by
 * ACTIVE_SCHEDULES_SQL). Skips past instants and out-of-range dates.
 */
async function generateForScheduleRow(row, { horizonDays = HORIZON_DAYS, now = new Date() } = {}) {
    const tz = row.tz || DEFAULT_TZ;
    const times = Array.isArray(row.times) ? row.times : [];
    const startStr = isoDate(row.start_date);
    const endStr = isoDate(row.end_date);

    let inserted = 0, duplicate = 0, badTimes = 0;

    for (let d = 0; d < horizonDays; d++) {
        const dayStr = isoDateInTz(new Date(now.getTime() + d * DAY_MS), tz);
        if (startStr && dayStr < startStr) continue;
        if (endStr && dayStr > endStr) continue;

        for (const t of times) {
            if (typeof t !== 'string' || !TIME_RE.test(t)) { badTimes++; continue; }
            const utc = localToUtc(dayStr, t, tz);
            if (!utc || utc.getTime() <= now.getTime()) continue;   // never generate past reminders

            const r = await query(INSERT_REMINDER_SQL, [row.id, row.patient_id, utc, t, tz]);
            if (r._skipped) return { inserted, duplicate, badTimes, skipped: true };
            if (r.rowCount > 0) inserted++;
            else duplicate++;
        }
    }
    return { inserted, duplicate, badTimes };
}

/**
 * Hourly job: pre-generate rows for the next `horizonDays` for every active,
 * reminder-enabled schedule. Idempotent — re-running inserts nothing new.
 */
async function generateUpcoming({ horizonDays = HORIZON_DAYS, now = new Date() } = {}) {
    try {
        const res = await query(ACTIVE_SCHEDULES_SQL, [DEFAULT_TZ]);
        if (res._skipped) return { skipped: true };

        let schedules = 0, inserted = 0, duplicate = 0, badTimes = 0;
        for (const row of res.rows) {
            if (row.enabled === false) continue;
            schedules++;
            const r = await generateForScheduleRow(row, { horizonDays, now });
            if (r.skipped) return { skipped: true };
            inserted += r.inserted;
            duplicate += r.duplicate;
            badTimes += r.badTimes;
        }
        return { schedules, inserted, duplicate, badTimes };
    } catch (err) {
        logError('reminderService.generateUpcoming failed', err);
        return { error: true };
    }
}

/**
 * Regenerate for a single schedule (after an edit). Caller should
 * cancelForSchedule() first so removed times don't linger.
 */
async function generateForSchedule(scheduleId, opts = {}) {
    try {
        const res = await query(`${ACTIVE_SCHEDULES_SQL} AND ms.id = $2`, [DEFAULT_TZ, scheduleId]);
        if (res._skipped || res.rowCount === 0) return { inserted: 0, duplicate: 0, badTimes: 0 };
        if (res.rows[0].enabled === false) return { inserted: 0, duplicate: 0, badTimes: 0 };
        return await generateForScheduleRow(res.rows[0], opts);
    } catch (err) {
        logError('reminderService.generateForSchedule failed', err, { scheduleId });
        return { error: true };
    }
}

/**
 * Per-minute job: claim due pending reminders (≤ now, < 6h old) with
 * FOR UPDATE SKIP LOCKED, mark sent inside the txn, deliver after commit.
 */
async function dispatchDue({ batchSize = 100, staleHours = STALE_HOURS } = {}) {
    let claimed;
    try {
        claimed = await withTransaction(async (client) => {
            const { rows } = await client.query(
                `SELECT r.id, r.patient_id, r.scheduled_local,
                        ms.medication, ms.dosage,
                        u.firebase_uid
                 FROM medication_reminders r
                 JOIN medication_schedules ms ON ms.id = r.medication_schedule_id
                 JOIN patient_profiles pp ON pp.id = r.patient_id
                 JOIN users u ON u.id = pp.user_id
                 WHERE r.status = 'pending'
                   AND r.scheduled_at_utc <= now()
                   AND r.scheduled_at_utc > now() - make_interval(hours => $1)
                 ORDER BY r.scheduled_at_utc
                 FOR UPDATE OF r SKIP LOCKED
                 LIMIT $2`,
                [staleHours, batchSize]
            );
            if (rows.length > 0) {
                await client.query(
                    `UPDATE medication_reminders
                     SET status = 'sent', sent_at = now(), attempts = attempts + 1
                     WHERE id = ANY($1)`,
                    [rows.map(r => r.id)]
                );
            }
            return rows;
        });
    } catch (err) {
        logError('reminderService.dispatchDue claim failed', err);
        return { error: true };
    }
    if (claimed && claimed._skipped) return { skipped: true };

    // Deliver outside the transaction — never hold row locks across network I/O.
    let delivered = 0, failed = 0;
    for (const r of claimed) {
        try {
            const { createNotification } = require('./notificationService');
            await createNotification({
                userId: r.firebase_uid,
                type: 'medication_reminder',
                title: `Rappel: ${r.medication}`,
                body: `Il est l'heure de prendre ${r.medication}${r.dosage ? ` (${r.dosage})` : ''}.` +
                      (r.scheduled_local ? ` Heure prevue: ${r.scheduled_local}.` : ''),
                data: { reminderId: r.id }
            });
            delivered++;
        } catch (err) {
            failed++;
            await query(
                `UPDATE medication_reminders SET last_error = $2 WHERE id = $1`,
                [r.id, String(err.message || err).slice(0, 500)]
            ).catch(() => {});
        }
    }
    return { claimed: claimed.length, delivered, failed };
}

/** Pending rows older than the staleness window were never sent → 'missed'. */
async function sweepStale({ staleHours = STALE_HOURS } = {}) {
    try {
        const r = await query(
            `UPDATE medication_reminders
             SET status = 'missed'
             WHERE status = 'pending'
               AND scheduled_at_utc <= now() - make_interval(hours => $1)
             RETURNING id`,
            [staleHours]
        );
        if (r._skipped) return { skipped: true };
        return { missed: r.rowCount };
    } catch (err) {
        logError('reminderService.sweepStale failed', err);
        return { error: true };
    }
}

/**
 * Snooze: mark the original 'snoozed' and spawn a child row due in `minutes`.
 * Ownership-checked (patient can only snooze their own). Returns the child row
 * or null (not found / not yours / not snoozable / PG unavailable).
 */
async function snooze(reminderId, minutes, profileId) {
    try {
        const result = await withTransaction(async (client) => {
            const { rows } = await client.query(
                `SELECT id, medication_schedule_id, patient_id, scheduled_local, timezone
                 FROM medication_reminders
                 WHERE id = $1 AND patient_id = $2 AND status IN ('pending', 'sent')
                 FOR UPDATE`,
                [reminderId, profileId]
            );
            if (rows.length === 0) return null;
            const orig = rows[0];

            await client.query(
                `UPDATE medication_reminders SET status = 'snoozed' WHERE id = $1`,
                [orig.id]
            );
            const ins = await client.query(
                `INSERT INTO medication_reminders
                    (medication_schedule_id, patient_id, scheduled_at_utc,
                     scheduled_local, timezone, status, parent_reminder_id)
                 VALUES ($1, $2, now() + make_interval(mins => $3), $4, $5, 'pending', $6)
                 RETURNING id, scheduled_at_utc`,
                [orig.medication_schedule_id, orig.patient_id, minutes,
                 orig.scheduled_local, orig.timezone, orig.id]
            );
            return ins.rows[0];
        });
        if (result && result._skipped) return null;
        return result;
    } catch (err) {
        logError('reminderService.snooze failed', err, { reminderId });
        return null;
    }
}

/**
 * Acknowledge a reminder as taken or skipped. Ownership-checked. Returns the
 * updated row or null.
 */
async function acknowledge(reminderId, status, profileId) {
    if (status !== 'taken' && status !== 'skipped') return null;
    try {
        const r = await query(
            `UPDATE medication_reminders
             SET status = $3, acknowledged_at = now()
             WHERE id = $1 AND patient_id = $2 AND status IN ('pending', 'sent', 'snoozed')
             RETURNING id, status, acknowledged_at`,
            [reminderId, profileId, status]
        );
        if (r._skipped || r.rowCount === 0) return null;
        return r.rows[0];
    } catch (err) {
        logError('reminderService.acknowledge failed', err, { reminderId });
        return null;
    }
}

/**
 * Cancel all FUTURE pending reminders for a schedule (called on schedule
 * edit/delete; regeneration re-inserts for the new times).
 */
async function cancelForSchedule(scheduleId) {
    try {
        const r = await query(
            `UPDATE medication_reminders
             SET status = 'cancelled'
             WHERE medication_schedule_id = $1
               AND status = 'pending'
               AND scheduled_at_utc > now()
             RETURNING id`,
            [scheduleId]
        );
        if (r._skipped) return 0;
        return r.rowCount;
    } catch (err) {
        logError('reminderService.cancelForSchedule failed', err, { scheduleId });
        return 0;
    }
}

/** Patient-facing list: ±7 days around now. */
async function listForPatient(profileId, { limit = 100 } = {}) {
    try {
        const r = await query(
            `SELECT r.id, r.scheduled_at_utc, r.scheduled_local, r.timezone, r.status,
                    r.sent_at, r.acknowledged_at, ms.medication, ms.dosage
             FROM medication_reminders r
             JOIN medication_schedules ms ON ms.id = r.medication_schedule_id
             WHERE r.patient_id = $1
               AND r.scheduled_at_utc BETWEEN now() - interval '7 days'
                                          AND now() + interval '7 days'
             ORDER BY r.scheduled_at_utc DESC
             LIMIT $2`,
            [profileId, limit]
        );
        if (r._skipped) return [];
        return r.rows;
    } catch (err) {
        logError('reminderService.listForPatient failed', err);
        return [];
    }
}

module.exports = {
    generateUpcoming,
    generateForSchedule,
    generateForScheduleRow,
    dispatchDue,
    sweepStale,
    snooze,
    acknowledge,
    cancelForSchedule,
    listForPatient
};
