const { getAppointments, createAppointment, updateAppointment } = require('../services/database');

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

        const appointment = await createAppointment({
            patientId,
            patientName,
            doctorId,
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
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating appointment' });
    }
};

module.exports = {
    getAllAppointments,
    createNewAppointment,
    updateAppointmentDetails
};
