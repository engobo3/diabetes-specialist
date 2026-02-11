const { getPatients, getPatientById, getPatientByEmail, getPatientByPhone, createPatient, updatePatient, deletePatient, getPatientsByDoctorId, migrateToFirestore, getVitals, addVital, getPatientDocuments, addPatientDocument } = require('../services/database');
const { validatePatient } = require('../utils/validation');
const { generateActivationCode, generateCodeExpiry } = require('../utils/activationCode');
const emailService = require('../services/emailNotificationService');

const getAllPatients = async (req, res) => {
    try {
        await migrateToFirestore(); // Attempt migration on first access
        let patients;

        if (req.query.doctorId) {
            // Use efficient Firestore array-contains query
            patients = await getPatientsByDoctorId(req.query.doctorId);
        } else if (req.user && req.user.email === 'demo@glucosoin.com') {
            patients = await getPatientsByDoctorId(99);
        } else {
            patients = await getPatients();
            // Hide demo patients for everyone else
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

        // Generate activation code if patient has email or phone
        let activationCode = null;
        const hasEmail = newPatient.email && newPatient.email.trim() !== '';
        const hasPhone = newPatient.phone && newPatient.phone.trim() !== '';

        if (hasEmail || hasPhone) {
            activationCode = generateActivationCode();
            const activationCodeExpiry = generateCodeExpiry();

            await updatePatient(newPatient.id, {
                activationCode,
                activationCodeExpiry,
                activated: false
            });

            // Send activation email if patient has email
            if (hasEmail) {
                await emailService._sendEmail({
                    to: newPatient.email,
                    subject: 'GlucoCare - Votre code d\'activation',
                    text: `Bonjour ${newPatient.name},\n\nVotre médecin vous a ajouté sur GlucoCare.\n\nVotre code d'activation : ${activationCode}\n\nCe code est valide pendant 24 heures.\n\nRendez-vous sur la page d'inscription pour activer votre compte.\n\n--\nL'équipe GlucoCare`
                }).catch(err => console.error('Activation email failed:', err));
            }
        }

        res.status(201).json({ ...newPatient, activationCode });
    } catch (error) {
        console.error('Error creating patient:', error);
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

const addDoctorToPatient = async (req, res) => {
    try {
        const { id } = req.params;
        const { doctorId } = req.body;
        if (!doctorId) return res.status(400).json({ message: 'doctorId is required' });

        const patient = await getPatientById(id);
        if (!patient) return res.status(404).json({ message: 'Patient not found' });

        const existingIds = (patient.doctorIds || []).map(String);
        if (existingIds.includes(String(doctorId))) {
            return res.status(200).json(patient); // Already linked
        }

        const newDoctorIds = [...existingIds, String(doctorId)];
        const updated = await updatePatient(id, { doctorIds: newDoctorIds, doctorId: newDoctorIds[0] });
        // Re-fetch with doctor details attached
        const result = await getPatientById(id);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error adding doctor to patient:', error);
        res.status(500).json({ message: 'Error adding doctor to patient' });
    }
};

const removeDoctorFromPatient = async (req, res) => {
    try {
        const { id, doctorId } = req.params;

        const patient = await getPatientById(id);
        if (!patient) return res.status(404).json({ message: 'Patient not found' });

        const existingIds = (patient.doctorIds || []).map(String);
        const newDoctorIds = existingIds.filter(did => did !== String(doctorId));

        if (newDoctorIds.length === 0) {
            return res.status(400).json({ message: 'Patient must have at least one doctor' });
        }

        await updatePatient(id, { doctorIds: newDoctorIds, doctorId: newDoctorIds[0] });
        const result = await getPatientById(id);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error removing doctor from patient:', error);
        res.status(500).json({ message: 'Error removing doctor from patient' });
    }
};

// ========== ACTIVATION CODE CONTROLLERS (PUBLIC) ==========

// Helper: look up patient by email or phone
const _findPatientByIdentifier = async (identifier) => {
    if (!identifier) return null;
    // Try email first, then phone
    const byEmail = await getPatientByEmail(identifier);
    if (byEmail) return byEmail;
    const byPhone = await getPatientByPhone(identifier);
    return byPhone;
};

const verifyActivationCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        // "email" field accepts email or phone
        if (!email || !code) {
            return res.status(400).json({ message: 'Email/téléphone et code requis' });
        }

        const patient = await _findPatientByIdentifier(email);
        if (!patient) {
            return res.status(404).json({ message: 'Aucun patient trouvé' });
        }

        if (patient.activated) {
            return res.status(400).json({ message: 'Ce compte est déjà activé' });
        }

        if (!patient.activationCode) {
            return res.status(400).json({ message: 'Aucun code d\'activation. Contactez votre médecin.' });
        }

        if (new Date(patient.activationCodeExpiry) < new Date()) {
            return res.status(410).json({ message: 'Code expiré. Demandez un nouveau code.' });
        }

        if (patient.activationCode !== code) {
            return res.status(401).json({ message: 'Code incorrect' });
        }

        res.json({
            valid: true,
            patientId: patient.id,
            patientName: patient.name,
            email: patient.email,
            phone: patient.phone
        });
    } catch (error) {
        console.error('Activation verification error:', error);
        res.status(500).json({ message: 'Erreur lors de la vérification' });
    }
};

const resendActivationCode = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email ou téléphone requis' });
        }

        const patient = await _findPatientByIdentifier(email);
        if (!patient) {
            return res.status(404).json({ message: 'Aucun patient trouvé' });
        }

        if (patient.activated) {
            return res.status(400).json({ message: 'Ce compte est déjà activé' });
        }

        const activationCode = generateActivationCode();
        const activationCodeExpiry = generateCodeExpiry();

        await updatePatient(patient.id, { activationCode, activationCodeExpiry });

        // Send email only if patient has an email
        if (patient.email && patient.email.trim() !== '') {
            await emailService._sendEmail({
                to: patient.email,
                subject: 'GlucoCare - Nouveau code d\'activation',
                text: `Bonjour ${patient.name},\n\nVoici votre nouveau code d'activation : ${activationCode}\n\nCe code est valide pendant 24 heures.\n\n--\nL'équipe GlucoCare`
            }).catch(err => console.error('Resend activation email failed:', err));
        }

        res.json({ success: true, message: 'Nouveau code envoyé' });
    } catch (error) {
        console.error('Resend activation code error:', error);
        res.status(500).json({ message: 'Erreur lors du renvoi du code' });
    }
};

const activatePatient = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email ou téléphone requis' });
        }

        const patient = await _findPatientByIdentifier(email);
        if (!patient) {
            return res.status(404).json({ message: 'Patient non trouvé' });
        }

        await updatePatient(patient.id, {
            activated: true,
            activationCode: null,
            activationCodeExpiry: null
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Activate patient error:', error);
        res.status(500).json({ message: 'Erreur lors de l\'activation' });
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
    addDocument,
    addDoctorToPatient,
    removeDoctorFromPatient,
    verifyActivationCode,
    resendActivationCode,
    activatePatient
};
