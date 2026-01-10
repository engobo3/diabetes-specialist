const { getAppointments, createAppointment, updateAppointmentStatus } = require('../services/database');

const getAllAppointments = async (req, res) => {
    try {
        const appointments = await getAppointments();
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching appointments' });
    }
};

const createNewAppointment = async (req, res) => {
    try {
        // Validate required fields (basic)
        const { patientId, patientName, date, time, reason } = req.body;
        if (!patientId || !date || !time) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const appointment = await createAppointment({
            patientId,
            patientName,
            date,
            time,
            reason,
            status: 'pending' // Default status
        });
        res.status(201).json(appointment);
    } catch (error) {
        res.status(500).json({ message: 'Error creating appointment' });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['confirmed', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const updated = await updateAppointmentStatus(req.params.id, status);
        if (!updated) {
            return res.status(404).json({ message: 'Appointment not found' });
        }
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating appointment' });
    }
};

module.exports = {
    getAllAppointments,
    createNewAppointment,
    updateStatus
};
