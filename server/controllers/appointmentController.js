const { getAppointments, createAppointment, updateAppointment } = require('../services/database');
const { createNotification } = require('../services/notificationService');
const { db } = require('../config/firebaseConfig');
const admin = require('firebase-admin');

const getAllAppointments = async (req, res) => {
    try {
        const { doctorId } = req.query;
        const appointments = await getAppointments(doctorId);
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching appointments' });
    }
};

const createNewAppointment = async (req, res) => {
    try {
        // Validate required fields (basic)
        const { patientId, patientName, doctorId, date, time, reason } = req.body;
        if (!patientId || !date || !time) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Conflict check: ensure no existing active appointment for same doctor+date+time
        if (doctorId && date && time) {
            const existing = await getAppointments(doctorId);
            const activeStatuses = ['pending', 'confirmed', 'Scheduled'];
            const conflict = existing.find(a =>
                a.date === date &&
                a.time === time &&
                activeStatuses.includes(a.status)
            );
            if (conflict) {
                return res.status(409).json({ message: 'Ce créneau est déjà réservé. Veuillez en choisir un autre.' });
            }
        }

        const appointment = await createAppointment({
            patientId,
            patientName,
            doctorId,
            date,
            time,
            reason,
            status: 'pending' // Default status
        });

        // Notify the doctor (non-blocking)
        _notifyDoctor(doctorId, {
            type: 'appointment_new',
            title: 'Nouvelle demande de RDV',
            body: `${patientName || 'Un patient'} demande un RDV le ${date} à ${time}.`,
            data: { appointmentId: appointment.id, patientId }
        });

        res.status(201).json(appointment);
    } catch (error) {
        res.status(500).json({ message: 'Error creating appointment' });
    }
};

const updateAppointmentDetails = async (req, res) => {
    try {
        const { status, notes } = req.body;
        // Validate inputs if needed
        const updateData = {};
        if (status) {
            if (!['confirmed', 'rejected', 'completed', 'pending'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }
            updateData.status = status;
        }
        if (notes !== undefined) updateData.notes = notes;

        const updated = await updateAppointment(req.params.id, updateData);
        if (!updated) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Notify patient on status change (non-blocking)
        if (status && updated.patientId) {
            const statusMessages = {
                confirmed: { type: 'appointment_confirmed', title: 'RDV confirmé', body: `Votre RDV du ${updated.date || ''} a été confirmé.` },
                rejected: { type: 'appointment_rejected', title: 'RDV refusé', body: `Votre RDV du ${updated.date || ''} a été refusé.` }
            };
            const msg = statusMessages[status];
            if (msg) {
                _notifyPatient(updated.patientId, {
                    ...msg,
                    data: { appointmentId: req.params.id }
                });
            }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating appointment' });
    }
};

// --- Notification helpers (fire-and-forget) ---

const _notifyDoctor = async (doctorId, notification) => {
    try {
        // Look up doctor document to get email, then resolve Firebase UID
        let doctorDoc = await db.collection('doctors').doc(String(doctorId)).get();
        if (!doctorDoc.exists) {
            const snap = await db.collection('doctors').where('id', '==', parseInt(doctorId)).limit(1).get();
            if (!snap.empty) doctorDoc = snap.docs[0];
            else return;
        }
        const email = doctorDoc.data()?.contact?.email;
        if (!email) return;

        const firebaseUser = await admin.auth().getUserByEmail(email);
        await createNotification({ ...notification, userId: firebaseUser.uid });
    } catch (err) {
        console.error('_notifyDoctor error (non-critical):', err.message);
    }
};

const _notifyPatient = async (patientId, notification) => {
    try {
        // Look up patient to get email, then resolve Firebase UID
        let patientDoc = await db.collection('patients').doc(String(patientId)).get();
        if (!patientDoc.exists) {
            const snap = await db.collection('patients').where('id', '==', parseInt(patientId)).limit(1).get();
            if (!snap.empty) patientDoc = snap.docs[0];
            else return;
        }
        const email = patientDoc.data()?.email;
        if (!email) return;

        const firebaseUser = await admin.auth().getUserByEmail(email);
        await createNotification({ ...notification, userId: firebaseUser.uid });
    } catch (err) {
        console.error('_notifyPatient error (non-critical):', err.message);
    }
};

module.exports = {
    getAllAppointments,
    createNewAppointment,
    updateAppointmentDetails
};
