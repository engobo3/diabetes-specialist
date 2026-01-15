const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Diabetes Specialist API is running');
});

// Import Routes
const patientRoutes = require('./routes/patientRoutes');

app.use('/api/patients', patientRoutes);
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

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
