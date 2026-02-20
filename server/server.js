const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust first proxy (Firebase Cloud Functions / Cloud Run)
// Ensures req.ip returns the real client IP for rate limiting
app.set('trust proxy', 1);

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

// Global error handler — must be after all route mounts
app.use((err, req, res, next) => {
    // CORS rejection from origin callback
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    console.error('Unhandled error:', err);

    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(err.status || 500).json({
        error: isDev ? err.message : 'Internal server error',
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
        const snapshot = await db.collection('patients').get();
        let sent = 0;

        for (const doc of snapshot.docs) {
            const patient = doc.data();
            if (!patient.email) continue;

            try {
                const firebaseUser = await admin.auth().getUserByEmail(patient.email);
                await createNotification({
                    userId: firebaseUser.uid,
                    type: 'vital_reminder',
                    title: 'Rappel: Saisir vos mesures',
                    body: 'Bonjour! N\'oubliez pas de saisir vos mesures du matin (glycémie, tension, etc.).',
                    data: { patientId: doc.id }
                });
                sent++;
            } catch (err) {
                // Patient may not have a Firebase account — skip
            }
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
