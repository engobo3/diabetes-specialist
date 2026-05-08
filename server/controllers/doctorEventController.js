const DoctorEventRepository = require('../repositories/DoctorEventRepository');
const repo = new DoctorEventRepository();

const getDoctorEvents = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const events = await repo.findByDoctorId(doctorId);
        res.json(events);
    } catch (error) {
        console.error('Error fetching doctor events:', error);
        res.status(500).json({ message: 'Error fetching doctor events' });
    }
};

const createDoctorEvent = async (req, res) => {
    try {
        const { doctorId, title, category, date, startTime, endTime, allDay, notes } = req.body;

        if (!doctorId || !title || !category || !date) {
            return res.status(400).json({ message: 'Missing required fields: doctorId, title, category, date' });
        }

        const newEvent = await repo.create({
            doctorId,
            title,
            category,
            date,
            startTime: allDay ? '07:00' : startTime,
            endTime: allDay ? '19:00' : endTime,
            allDay: allDay || false,
            notes: notes || '',
            createdAt: new Date().toISOString(),
        });

        res.status(201).json(newEvent);
    } catch (error) {
        console.error('Error creating doctor event:', error);
        if (error.name === 'ZodError') {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        res.status(500).json({ message: 'Error creating doctor event' });
    }
};

const updateDoctorEvent = async (req, res) => {
    try {
        const updated = await repo.update(req.params.id, {
            ...req.body,
            updatedAt: new Date().toISOString(),
        });
        if (!updated) return res.status(404).json({ message: 'Event not found' });
        res.json(updated);
    } catch (error) {
        console.error('Error updating doctor event:', error);
        if (error.name === 'ZodError') {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        res.status(500).json({ message: 'Error updating doctor event' });
    }
};

const deleteDoctorEvent = async (req, res) => {
    try {
        const result = await repo.delete(req.params.id);
        if (!result) return res.status(404).json({ message: 'Event not found' });
        res.json({ message: 'Event deleted' });
    } catch (error) {
        console.error('Error deleting doctor event:', error);
        res.status(500).json({ message: 'Error deleting doctor event' });
    }
};

module.exports = { getDoctorEvents, createDoctorEvent, updateDoctorEvent, deleteDoctorEvent };
