const { getPrescriptions, createPrescription } = require('../services/database');

const getPatientPrescriptions = async (req, res) => {
    try {
        const { patientId } = req.params;
        const prescriptions = await getPrescriptions(patientId);
        res.json(prescriptions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching prescriptions' });
    }
};

const addPrescription = async (req, res) => {
    try {
        const { patientId, medication, dosage, instructions, date } = req.body;

        if (!patientId || !medication || !dosage) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const newPrescription = await createPrescription({
            patientId,
            medication,
            dosage,
            instructions,
            date,
            doctorName: "Dr. Specialist" // Could be dynamic
        });

        res.status(201).json(newPrescription);
    } catch (error) {
        res.status(500).json({ message: 'Error creating prescription' });
    }
};

module.exports = {
    getPatientPrescriptions,
    addPrescription
};
