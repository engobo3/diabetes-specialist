const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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

app.use(cors());
app.use(express.json());

// Apply security middleware that needs parsed body (after body parsing)
app.use(sanitizeInput); // Sanitize all input (needs parsed body)
app.use(validateContentType); // Validate content type for POST/PUT/PATCH

app.get('/', (req, res) => {
    res.send('Diabetes Specialist API is running - Secured');
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
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/2fa', require('./routes/twoFactorAuthRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/security/dashboard', require('./routes/securityDashboardRoutes'));

// --- Firebase Functions Setup ---
const { onRequest } = require('firebase-functions/v2/https');

// Only start the server if running locally (not in Cloud Functions environment)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export the Express app as a Cloud Function
exports.api = onRequest(app);
exports.app = app;
