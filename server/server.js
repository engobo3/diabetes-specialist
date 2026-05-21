const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const { logError } = require('./utils/safeLogger');
const { safeErrorMessage } = require('./utils/safeError');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust first proxy (Firebase Cloud Functions / Cloud Run)
// Ensures req.ip returns the real client IP for rate limiting
app.set('trust proxy', 1);

// Fail fast on missing production secrets — better than running with insecure defaults
if (process.env.NODE_ENV === 'production') {
    const requiredInProd = ['FIREBASE_SERVICE_ACCOUNT'];
    const missing = requiredInProd.filter(k => !process.env[k]);
    if (missing.length) {
        console.error(`FATAL: required env vars missing in production: ${missing.join(', ')}`);
        process.exit(1);
    }
}

// Note on CSRF: this API authenticates exclusively with `Authorization: Bearer <token>`
// (Firebase ID tokens) and the optional `x-session-id` header. Neither is sent
// automatically by browsers on cross-origin requests, so traditional CSRF attacks
// do not apply. If session cookies are added later, install `cookie-parser` and a
// double-submit-cookie / SameSite=strict scheme before relying on cookie auth.

// Security middleware
const {
    enforceHTTPS,
    securityHeaders,
    rateLimit,
    sanitizeInput,
    validateContentType
} = require('./middleware/securityMiddleware');

// Apply early security middleware (before body parsing)
app.use(enforceHTTPS); // Enforce HTTPS in production
app.use(securityHeaders); // Add security headers
app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 1000 })); // General rate limit

// Attach a request ID so logs can be correlated without including PHI.
app.use((req, res, next) => {
    const incoming = req.headers['x-request-id'];
    const id = (typeof incoming === 'string' && /^[\w-]{8,128}$/.test(incoming))
        ? incoming
        : crypto.randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
});

// CORS: restrict to known origins
const allowedOrigins = [
    'https://diabetes-specialist.web.app',
    'https://diabetes-specialist.firebaseapp.com',
    process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : null,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null,
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, server-to-server, curl, webhooks)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// Apply security middleware that needs parsed body (after body parsing)
app.use(sanitizeInput); // Sanitize all input (needs parsed body)
app.use(validateContentType); // Validate content type for POST/PUT/PATCH

app.get('/', (req, res) => {
    res.send('Diabetes Specialist API v2.1 - Running');
});

// Import Routes
const patientRoutes = require('./routes/patientRoutes');
const caregiverRoutes = require('./routes/caregiverRoutes');

app.use('/api/patients', patientRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/2fa', require('./routes/twoFactorAuthRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/security/dashboard', require('./routes/securityDashboardRoutes'));
app.use('/api/medical-records', require('./routes/medicalRecordRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/foot-risk', require('./routes/footRiskRoutes'));
app.use('/api/specialties', require('./routes/specialtyRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/doctor-events', require('./routes/doctorEventRoutes'));
app.use('/api/notification-preferences', require('./routes/notificationPreferencesRoutes'));
app.use('/api/medication-schedules', require('./routes/medicationScheduleRoutes'));

// Global error handler — must be after all route mounts.
// Never leak stack traces, request bodies, or upstream error details to the
// client. Log a safe summary with the request ID so the entry can be cross-
// referenced without exposing PHI.
app.use((err, req, res, next) => {
    // CORS rejection from origin callback
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    logError('unhandled-error', err, {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.uid || 'anonymous',
        userRole: req.user?.role || 'unknown'
    });

    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: status >= 500 ? 'Internal server error' : safeErrorMessage(err),
        requestId: req.requestId
    });
});

// --- Firebase Functions Setup ---
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

// Only start the server if running locally (not in Cloud Functions environment)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export the Express app as a Cloud Function
exports.api = onRequest(app);
exports.app = app;

// --- Scheduled Functions ---

// Morning vital reminder: 7:00 AM Africa/Kinshasa daily
exports.morningVitalReminder = onSchedule({
    schedule: '0 7 * * *',
    timeZone: 'Africa/Kinshasa'
}, async () => {
    const { db } = require('./config/firebaseConfig');
    const { createNotification } = require('./services/notificationService');
    const admin = require('firebase-admin');

    try {
        let sent = 0;
        const BATCH_SIZE = 500;
        let lastDoc = null;

        while (true) {
            let query = db.collection('patients').limit(BATCH_SIZE);
            if (lastDoc) query = query.startAfter(lastDoc);
            const snapshot = await query.get();

            if (snapshot.empty) break;
            lastDoc = snapshot.docs[snapshot.docs.length - 1];

            const todayStr = new Date().toISOString().split('T')[0];

            for (const doc of snapshot.docs) {
                const patient = doc.data();
                if (!patient.email) continue;

                try {
                    // Check patient preferences — skip if vital reminders disabled
                    const prefsDoc = await db.collection('notification_preferences')
                        .doc(doc.id).get();
                    if (prefsDoc.exists && prefsDoc.data().vitalReminderEnabled === false) continue;

                    // Check if patient already logged vitals today — skip if so
                    const vitalsSnap = await db.collection('patients')
                        .doc(doc.id)
                        .collection('vitals')
                        .orderBy('date', 'desc')
                        .limit(1)
                        .get();

                    if (!vitalsSnap.empty) {
                        const latestDate = vitalsSnap.docs[0].data().date;
                        if (latestDate && latestDate.startsWith(todayStr)) continue;
                    }

                    const firebaseUser = await admin.auth().getUserByEmail(patient.email);
                    await createNotification({
                        userId: firebaseUser.uid,
                        type: 'vital_reminder',
                        title: 'Rappel: Saisir vos mesures',
                        body: 'Bonjour! N\'oubliez pas de saisir vos mesures du matin (glycémie, tension, etc.).',
                        data: { patientId: doc.id, period: 'morning' }
                    });
                    sent++;
                } catch (err) {
                    // Patient may not have a Firebase account — skip
                }
            }

            if (snapshot.docs.length < BATCH_SIZE) break;
        }

        console.log(`morningVitalReminder: sent ${sent} notifications`);
    } catch (error) {
        console.error('morningVitalReminder error:', error);
    }
});

// Appointment reminder: runs every hour, finds appointments 24h ahead
exports.appointmentReminder = onSchedule({
    schedule: '0 * * * *',
    timeZone: 'Africa/Kinshasa'
}, async () => {
    const { db } = require('./config/firebaseConfig');
    const { createNotification } = require('./services/notificationService');
    const admin = require('firebase-admin');

    try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const snapshot = await db.collection('appointments')
            .where('status', 'in', ['confirmed', 'pending'])
            .where('date', 'in', [todayStr, tomorrowStr])
            .get();

        let sent = 0;

        for (const doc of snapshot.docs) {
            const apt = doc.data();
            const aptDateTime = new Date(`${apt.date}T${apt.time || '00:00'}:00`);
            const hoursUntil = (aptDateTime - now) / (1000 * 60 * 60);
            if (hoursUntil < 0 || hoursUntil > 24) continue;

            const timeLabel = hoursUntil < 2 ? 'dans moins de 2h' : `demain à ${apt.time}`;

            // Notify patient
            if (apt.patientId) {
                try {
                    const patientDoc = await db.collection('patients').doc(String(apt.patientId)).get();
                    if (patientDoc.exists && patientDoc.data().email) {
                        const fbUser = await admin.auth().getUserByEmail(patientDoc.data().email);
                        await createNotification({
                            userId: fbUser.uid,
                            type: 'appointment_reminder',
                            title: 'Rappel de RDV',
                            body: `Vous avez un RDV ${timeLabel}.`,
                            data: { appointmentId: doc.id }
                        });
                        sent++;
                    }
                } catch (err) { /* skip */ }
            }

            // Notify doctor
            if (apt.doctorId) {
                try {
                    const doctorDoc = await db.collection('doctors').doc(String(apt.doctorId)).get();
                    if (doctorDoc.exists && doctorDoc.data()?.contact?.email) {
                        const fbUser = await admin.auth().getUserByEmail(doctorDoc.data().contact.email);
                        await createNotification({
                            userId: fbUser.uid,
                            type: 'appointment_reminder',
                            title: 'Rappel: RDV patient',
                            body: `RDV avec ${apt.patientName || 'un patient'} ${timeLabel}.`,
                            data: { appointmentId: doc.id }
                        });
                        sent++;
                    }
                } catch (err) { /* skip */ }
            }
        }

        console.log(`appointmentReminder: sent ${sent} notifications`);
    } catch (error) {
        console.error('appointmentReminder error:', error);
    }
});

// Evening vital reminder: 7:00 PM Africa/Kinshasa daily (opt-in only)
exports.eveningVitalReminder = onSchedule({
    schedule: '0 19 * * *',
    timeZone: 'Africa/Kinshasa'
}, async () => {
    const { db } = require('./config/firebaseConfig');
    const { createNotification } = require('./services/notificationService');
    const admin = require('firebase-admin');

    try {
        let sent = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        // Only query patients who opted in to evening reminders
        const prefsSnap = await db.collection('notification_preferences')
            .where('eveningReminderEnabled', '==', true)
            .get();

        if (prefsSnap.empty) {
            console.log('eveningVitalReminder: no patients with evening reminders enabled');
            return;
        }

        for (const prefsDoc of prefsSnap.docs) {
            const patientId = prefsDoc.id;

            try {
                // Check if patient already logged vitals today
                const vitalsSnap = await db.collection('patients')
                    .doc(patientId)
                    .collection('vitals')
                    .orderBy('date', 'desc')
                    .limit(1)
                    .get();

                if (!vitalsSnap.empty) {
                    const latestDate = vitalsSnap.docs[0].data().date;
                    if (latestDate && latestDate.startsWith(todayStr)) continue;
                }

                // Get patient email -> Firebase UID
                const patientDoc = await db.collection('patients')
                    .doc(patientId).get();
                if (!patientDoc.exists) continue;
                const patient = patientDoc.data();
                if (!patient.email) continue;

                const fbUser = await admin.auth().getUserByEmail(patient.email);
                await createNotification({
                    userId: fbUser.uid,
                    type: 'vital_reminder',
                    title: 'Rappel du soir: Saisir vos mesures',
                    body: 'Bonsoir! N\'oubliez pas de saisir vos mesures du soir (glycemie, tension, etc.).',
                    data: { patientId, period: 'evening' }
                });
                sent++;
            } catch (err) {
                // skip individual patient errors
            }
        }

        console.log(`eveningVitalReminder: sent ${sent} notifications`);
    } catch (error) {
        console.error('eveningVitalReminder error:', error);
    }
});

// Vital escalation: 10:00 AM daily — alert doctors if patient hasn't logged vitals in N days
exports.vitalEscalationCheck = onSchedule({
    schedule: '0 10 * * *',
    timeZone: 'Africa/Kinshasa'
}, async () => {
    const { db } = require('./config/firebaseConfig');
    const { createNotification } = require('./services/notificationService');
    const admin = require('firebase-admin');

    try {
        let sent = 0;
        const BATCH_SIZE = 500;
        let lastDoc = null;

        while (true) {
            let query = db.collection('patients').limit(BATCH_SIZE);
            if (lastDoc) query = query.startAfter(lastDoc);
            const snapshot = await query.get();

            if (snapshot.empty) break;
            lastDoc = snapshot.docs[snapshot.docs.length - 1];

            for (const doc of snapshot.docs) {
                const patient = doc.data();

                try {
                    // Check preferences — skip if escalation disabled
                    const prefsDoc = await db.collection('notification_preferences')
                        .doc(doc.id).get();
                    const escalationDays = prefsDoc.exists
                        ? (prefsDoc.data().escalationDays || 3)
                        : 3;
                    const escalationEnabled = prefsDoc.exists
                        ? (prefsDoc.data().escalationEnabled !== false)
                        : true;

                    if (!escalationEnabled) continue;

                    // Check latest vital
                    const vitalsSnap = await db.collection('patients')
                        .doc(doc.id)
                        .collection('vitals')
                        .orderBy('date', 'desc')
                        .limit(1)
                        .get();

                    let daysSinceLastVital = Infinity;
                    if (!vitalsSnap.empty) {
                        const lastVitalDate = new Date(vitalsSnap.docs[0].data().date);
                        daysSinceLastVital = Math.floor(
                            (Date.now() - lastVitalDate.getTime()) / (1000 * 60 * 60 * 24)
                        );
                    }

                    if (daysSinceLastVital < escalationDays) continue;

                    // Resolve doctor IDs
                    const doctorIds = new Set();
                    if (patient.doctorIds && Array.isArray(patient.doctorIds)) {
                        patient.doctorIds.forEach(id => doctorIds.add(String(id)));
                    }
                    if (patient.doctorId) doctorIds.add(String(patient.doctorId));

                    if (doctorIds.size === 0) continue;

                    // Notify each doctor
                    for (const doctorId of doctorIds) {
                        try {
                            const doctorDoc = await db.collection('doctors')
                                .doc(doctorId).get();
                            if (!doctorDoc.exists) continue;
                            const doctor = doctorDoc.data();
                            const email = doctor.contact?.email || doctor.email;
                            if (!email) continue;

                            const fbUser = await admin.auth().getUserByEmail(email);
                            await createNotification({
                                userId: fbUser.uid,
                                type: 'vital_escalation',
                                title: 'Alerte: Patient sans mesures',
                                body: `${patient.name} n'a pas saisi de mesures depuis ${daysSinceLastVital === Infinity ? 'jamais' : daysSinceLastVital + ' jours'}.`,
                                data: { patientId: doc.id, daysMissing: String(daysSinceLastVital) }
                            });
                            sent++;
                        } catch (err) {
                            // Doctor may not have Firebase account — skip
                        }
                    }
                } catch (err) {
                    // skip individual patient errors
                }
            }

            if (snapshot.docs.length < BATCH_SIZE) break;
        }

        console.log(`vitalEscalationCheck: sent ${sent} notifications`);
    } catch (error) {
        console.error('vitalEscalationCheck error:', error);
    }
});

// Breach detection: 06:00 Africa/Kinshasa daily. Scans the last 24h of audit
// logs for anomalies (bulk PHI access, mass exports, RBAC denial spikes,
// off-hours patterns) and writes SECURITY events / fires alerts.
exports.breachDetectionDaily = onSchedule({
    schedule: '0 6 * * *',
    timeZone: 'Africa/Kinshasa'
}, async () => {
    const { runDetection } = require('./services/breachDetector');
    try {
        const findings = await runDetection();
        console.log(`breachDetectionDaily: ${findings.length} findings emitted`);
    } catch (error) {
        console.error('breachDetectionDaily error:', error.message);
    }
});

// Data retention: 03:00 Africa/Kinshasa every Sunday. Purges audit_logs > 6yr,
// invalidated sessions > 30d, terminal invitations > 1yr. HIPAA requires the
// 6-year minimum but no maximum, so we delete the moment we're allowed.
exports.retentionWeekly = onSchedule({
    schedule: '0 3 * * 0',
    timeZone: 'Africa/Kinshasa'
}, async () => {
    const { runAllRetention } = require('./services/retentionService');
    try {
        const result = await runAllRetention();
        console.log('retentionWeekly result:', JSON.stringify(result));
    } catch (error) {
        console.error('retentionWeekly error:', error.message);
    }
});

// Medication reminder: runs every hour, checks schedules due
exports.medicationReminder = onSchedule({
    schedule: '0 * * * *',
    timeZone: 'Africa/Kinshasa'
}, async () => {
    const { db } = require('./config/firebaseConfig');
    const { createNotification } = require('./services/notificationService');
    const admin = require('firebase-admin');

    try {
        let sent = 0;
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const todayStr = now.toISOString().split('T')[0];

        // Get all active medication schedules
        const schedulesSnap = await db.collection('medication_schedules')
            .where('active', '==', true)
            .get();

        for (const schedDoc of schedulesSnap.docs) {
            const schedule = schedDoc.data();

            // Check date bounds
            if (schedule.endDate && schedule.endDate < todayStr) continue;
            if (schedule.startDate > todayStr) continue;

            // Check if any scheduled time matches current hour
            const matchingTime = schedule.times?.find(
                t => t.startsWith(currentHour + ':')
            );
            if (!matchingTime) continue;

            // Check patient preferences
            const patientId = String(schedule.patientId);
            try {
                const prefsDoc = await db.collection('notification_preferences')
                    .doc(patientId).get();
                if (prefsDoc.exists && prefsDoc.data().medicationReminderEnabled === false) continue;

                const patientDoc = await db.collection('patients')
                    .doc(patientId).get();
                if (!patientDoc.exists) continue;
                const patient = patientDoc.data();
                if (!patient.email) continue;

                const fbUser = await admin.auth().getUserByEmail(patient.email);
                await createNotification({
                    userId: fbUser.uid,
                    type: 'medication_reminder',
                    title: `Rappel: ${schedule.medication}`,
                    body: `Il est l'heure de prendre ${schedule.medication} (${schedule.dosage}). Heure prevue: ${matchingTime}.`,
                    data: {
                        patientId,
                        medicationScheduleId: schedDoc.id,
                        medication: schedule.medication
                    }
                });
                sent++;
            } catch (err) {
                // skip
            }
        }

        console.log(`medicationReminder: sent ${sent} notifications`);
    } catch (error) {
        console.error('medicationReminder error:', error);
    }
});
