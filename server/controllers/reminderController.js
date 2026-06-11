/**
 * Reminder endpoints (Phase 5) — patient-self-scoped.
 *
 * The patient_profile is resolved from the TOKEN (same pattern as
 * syncController), never trusted from params/body. Users whose account isn't
 * in Postgres yet (pre-cutover) get an empty list / 404s — the legacy
 * Firestore reminder crons still serve them until activation.
 */

const reminderService = require('../services/reminderService');
const patientResolver = require('../services/patientResolver');
const audit = require('../services/auditServiceV2');
const { logError } = require('../utils/safeLogger');

async function resolveAuthedPatientProfileId(req) {
    if (req.user?._userSource === 'postgres' && req.user.patientId) {
        return req.user.patientId;
    }
    if (req.user?.patientId != null) {
        return patientResolver.toProfileId(req.user.patientId);
    }
    return null;
}

async function listMyReminders(req, res) {
    try {
        const profileId = await resolveAuthedPatientProfileId(req);
        if (!profileId) return res.json({ reminders: [] });

        const reminders = await reminderService.listForPatient(profileId, {
            limit: req.query.limit || 100
        });
        return res.json({ reminders });
    } catch (err) {
        logError('listMyReminders failed', err, { userId: req.user?.uid });
        return res.status(500).json({ error: 'Failed to list reminders' });
    }
}

async function ackReminder(req, res) {
    try {
        const profileId = await resolveAuthedPatientProfileId(req);
        if (!profileId) return res.status(404).json({ message: 'Reminder not found' });

        const result = await reminderService.acknowledge(req.params.id, req.body.status, profileId);
        if (!result) return res.status(404).json({ message: 'Reminder not found' });

        audit.log({
            action: 'reminder.ack',
            resource_type: 'medication_reminder',
            resource_id: req.params.id,
            actor_user_id: req.user?.userId || null,
            actor_firebase_uid: req.user?.uid || null,
            actor_role: req.user?.role || null,
            patient_id: profileId,
            request_id: req.requestId,
            ip_address: req.ip,
            metadata: { status: req.body.status }
        });
        return res.json(result);
    } catch (err) {
        logError('ackReminder failed', err, { reminderId: req.params?.id });
        return res.status(500).json({ error: 'Failed to acknowledge reminder' });
    }
}

async function snoozeReminder(req, res) {
    try {
        const profileId = await resolveAuthedPatientProfileId(req);
        if (!profileId) return res.status(404).json({ message: 'Reminder not found' });

        const child = await reminderService.snooze(req.params.id, req.body.minutes, profileId);
        if (!child) return res.status(404).json({ message: 'Reminder not found' });

        audit.log({
            action: 'reminder.snooze',
            resource_type: 'medication_reminder',
            resource_id: req.params.id,
            actor_user_id: req.user?.userId || null,
            actor_firebase_uid: req.user?.uid || null,
            actor_role: req.user?.role || null,
            patient_id: profileId,
            request_id: req.requestId,
            ip_address: req.ip,
            metadata: { minutes: req.body.minutes, childId: child.id }
        });
        return res.json({ snoozed: true, next: child });
    } catch (err) {
        logError('snoozeReminder failed', err, { reminderId: req.params?.id });
        return res.status(500).json({ error: 'Failed to snooze reminder' });
    }
}

module.exports = { listMyReminders, ackReminder, snoozeReminder };
