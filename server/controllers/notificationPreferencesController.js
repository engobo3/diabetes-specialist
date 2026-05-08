const NotificationPreferencesRepository = require('../repositories/NotificationPreferencesRepository');
const prefsRepo = new NotificationPreferencesRepository();

const getPreferences = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const prefs = await prefsRepo.findByPatientId(patientId);
        res.json(prefs);
    } catch (error) {
        console.error('getPreferences error:', error);
        res.status(500).json({ message: 'Erreur lors de la lecture des preferences' });
    }
};

const updatePreferences = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const result = await prefsRepo.upsert(patientId, req.body);
        res.json(result);
    } catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ message: 'Donnees invalides', errors: error.errors });
        }
        console.error('updatePreferences error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise a jour des preferences' });
    }
};

module.exports = { getPreferences, updatePreferences };
