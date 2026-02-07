const { getPatients, getPatientById, getPatientByEmail, getPatientByPhone, createPatient, updatePatient, deletePatient, migrateToFirestore, getVitals, addVital, getPatientDocuments, addPatientDocument } = require('../services/database');
const { validatePatient } = require('../utils/validation');

const getAllPatients = async (req, res) => {
    try {
        await migrateToFirestore(); // Attempt migration on first access
        let patients = await getPatients();

        // Data Isolation for Demo
        // If the user is the demo account, ONLY show demo patients (id 99)
        // Filter by Doctor ID if provided in query
        if (req.query.doctorId) {
            patients = patients.filter(p => String(p.doctorId) === String(req.query.doctorId));
        } else if (req.user && req.user.email === 'demo@glucosoin.com') {
            // Fallback: If demo user, show demo patients
            patients = patients.filter(p => p.doctorId === 99);
        } else {
            // Default: Hide demo patients for everyone else
            patients = patients.filter(p => p.doctorId !== 99);
        }

        res.json(patients);
    } catch (error) {
        console.error(error);
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
        const { email, phone } = req.query;
        if (!email && !phone) return res.status(400).json({ message: 'Email or Phone required' });

        let patient = null;
        if (email) {
            patient = await getPatientByEmail(email);
        } else if (phone) {
            patient = await getPatientByPhone(phone);
        }

        // If not found, return 404. This is a valid state (user is not a patient).
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.json(patient);
    } catch (error) {
        console.error("Lookup Error:", error);
        res.status(500).json({ message: 'Error looking up patient' });
    }
};

const getCaregiverPatientsController = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Email required' });

        // Fetch all patients
        const allPatients = await getPatients();
        
        // Filter for patients where this email is a caregiver
        const managedPatients = allPatients.filter(patient => {
            return patient.caregivers && 
                   Array.isArray(patient.caregivers) &&
                   patient.caregivers.some(cg => cg.email === email);
        });

        res.json(managedPatients);
    } catch (error) {
        console.error("Caregiver Lookup Error:", error);
        res.status(500).json({ message: 'Error looking up caregiver patients' });
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
        const { isValid, error } = validatePatient(req.body);
        if (!isValid) {
            return res.status(400).json({ message: error });
        }

        const newPatient = await createPatient(req.body);
        res.status(201).json(newPatient);
    } catch (error) {
        res.status(500).json({ message: 'Error creating patient' });
    }
};

const updateExistingPatient = async (req, res) => {
    try {
        // For updates, we might only validate provided fields, but for strictness we'll validate the merged object if possible.
        // Or simply validate the body if we expect a full update. 
        // Assuming partial updates (PATCH) logic, validation might need to be partial.
        // However, user asked for schema enforcement. Let's validate the incoming body as a full or partial object.
        // Note: For partial updates, validatePatient might fail if required fields are missing.
        // Let's assume for now updates must provide valid data for the fields they are updating.
        // Better approach: Merge with existing patient then validate? 
        // For simplicity and safety against bad data:
        // We will validate the fields present in req.body if they are part of the schema.

        // Actually, easiest way to enforce schema on update is to check if the update creates an invalid state.
        // Let's first fetch the patient, merge, validate, then save.

        const existingPatient = await getPatientById(req.params.id);
        if (!existingPatient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const mergedPatient = { ...existingPatient, ...req.body };
        const { isValid, error } = validatePatient(mergedPatient);

        if (!isValid) {
            return res.status(400).json({ message: error });
        }

        const updatedPatient = await updatePatient(req.params.id, req.body);
        res.status(200).json(updatedPatient);
    } catch (error) {
        res.status(500).json({ message: 'Error updating patient' });
    }
};

const deleteExistingPatient = async (req, res) => {
    try {
        const result = await deletePatient(req.params.id);
        if (!result) return res.status(404).json({ message: 'Patient not found' });
        res.status(200).json({ message: 'Patient deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting patient' });
    }
};

const getDocuments = async (req, res) => {
    try {
        const docs = await getPatientDocuments(req.params.id);
        res.json(docs);
    } catch (error) {
        res.status(500).json({ message: 'Error reading documents' });
    }
};

const addDocument = async (req, res) => {
    try {
        const newDoc = await addPatientDocument(req.params.id, req.body);
        res.status(201).json(newDoc);
    } catch (error) {
        res.status(500).json({ message: 'Error adding document' });
    }
};

module.exports = {
    getPatients: getAllPatients,
    getPatientById: getPatient,
    getPatientByEmail: getPatientByEmailController,
    getCaregiverPatients: getCaregiverPatientsController,
    getPatientVitals,
    addPatientVital,
    createPatient: createNewPatient,
    updatePatient: updateExistingPatient,
    deletePatient: deleteExistingPatient,
    getDocuments,
    addDocument
};
