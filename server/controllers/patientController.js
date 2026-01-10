const { getPatients, getPatientById, getPatientByEmail, createPatient, updatePatient, deletePatient, migrateToFirestore, getVitals, addVital } = require('../services/database');

const getAllPatients = async (req, res) => {
    try {
        await migrateToFirestore(); // Attempt migration on first access
        const patients = await getPatients();
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: 'Error reading patient data' });
    }
};

const getPatient = async (req, res) => {
    try {
        const patient = await getPatientById(req.params.id);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: 'Error reading patient data' });
    }
};

const getPatientByEmailController = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Email required' });

        const patient = await getPatientByEmail(email);
        // If not found, return 404. This is a valid state (user is not a patient).
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: 'Error looking up patient' });
    }
};

const getPatientVitals = async (req, res) => {
    try {
        const vitals = await getVitals(req.params.id);
        res.json(vitals);
    } catch (error) {
        res.status(500).json({ message: 'Error reading vitals data' });
    }
};

const addPatientVital = async (req, res) => {
    try {
        const newVital = await addVital(req.params.id, req.body);
        res.status(201).json(newVital);
    } catch (error) {
        res.status(500).json({ message: 'Error adding vital' });
    }
};

const createNewPatient = async (req, res) => {
    try {
        const newPatient = await createPatient(req.body);
        res.status(201).json(newPatient);
    } catch (error) {
        res.status(500).json({ message: 'Error creating patient' });
    }
};

const updateExistingPatient = async (req, res) => {
    try {
        const updatedPatient = await updatePatient(req.params.id, req.body);
        if (!updatedPatient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.status(200).json(updatedPatient);
    } catch (error) {
        res.status(500).json({ message: 'Error updating patient' });
    }
};

const deleteExistingPatient = async (req, res) => {
    try {
        const success = await deletePatient(req.params.id);
        if (!success) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.status(200).json({ message: 'Patient deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting patient' });
    }
};

module.exports = {
    getPatients: getAllPatients,
    getPatientById: getPatient,
    getPatientByEmail: getPatientByEmailController,
    getPatientVitals,
    addPatientVital,
    createPatient: createNewPatient,
    updatePatient: updateExistingPatient,
    deletePatient: deleteExistingPatient
};
