const MedicationScheduleRepository = require('../repositories/MedicationScheduleRepository');
const scheduleRepo = new MedicationScheduleRepository();

const getByPatient = async (req, res) => {
    try {
        const { patientId } = req.params;
        const schedules = await scheduleRepo.findByPatientId(patientId);
        res.json(schedules);
    } catch (error) {
        console.error('getByPatient error:', error);
        res.status(500).json({ message: 'Erreur lors de la lecture des medicaments' });
    }
};

const createSchedule = async (req, res) => {
    try {
        const result = await scheduleRepo.create(req.body);
        res.status(201).json(result);
    } catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ message: 'Donnees invalides', errors: error.errors });
        }
        console.error('createSchedule error:', error);
        res.status(500).json({ message: 'Erreur lors de la creation du rappel medicament' });
    }
};

const updateSchedule = async (req, res) => {
    try {
        const result = await scheduleRepo.update(req.params.id, req.body);
        if (!result) return res.status(404).json({ message: 'Rappel medicament introuvable' });
        res.json(result);
    } catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ message: 'Donnees invalides', errors: error.errors });
        }
        console.error('updateSchedule error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise a jour' });
    }
};

const deleteSchedule = async (req, res) => {
    try {
        // Soft delete: mark as inactive
        const result = await scheduleRepo.update(req.params.id, { active: false });
        if (!result) return res.status(404).json({ message: 'Rappel medicament introuvable' });
        res.json({ message: 'Rappel medicament desactive', ...result });
    } catch (error) {
        console.error('deleteSchedule error:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression' });
    }
};

module.exports = { getByPatient, createSchedule, updateSchedule, deleteSchedule };
