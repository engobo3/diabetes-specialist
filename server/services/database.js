const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebaseConfig');

const dataPath = path.join(__dirname, '../data/patients.json');

// --- Helper for File-Based Mock DB ---
const readLocalData = () => {
    try {
        if (!fs.existsSync(dataPath)) return [];
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading local data:', e);
        return [];
    }
};

const doctorsPath = path.join(__dirname, '../data/doctors.json');
const getLocalDoctors = () => {
    try {
        if (!fs.existsSync(doctorsPath)) return [];
        const data = fs.readFileSync(doctorsPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading local doctors:', e);
        return [];
    }
};

// Helper: Attach Doctor Info to Patient
const attachDoctorInfo = async (patient) => {
    if (!patient) return null;
    try {
        const doctorId = patient.doctorId || 1;
        let doctor = null;

        // Try getting doctor from Firestore first
        if (db) {
            try {
                const docSnap = await db.collection('doctors').doc(String(doctorId)).get();
                if (docSnap.exists) {
                    doctor = { id: docSnap.id, ...docSnap.data() };
                }
            } catch (fsError) {
                console.warn("Firestore Doctor look up failed, falling back to local:", fsError.message);
            }
        }

        // Fallback to local if not found in DB
        if (!doctor) {
            const doctors = getLocalDoctors();
            doctor = doctors.find(d => String(d.id) === String(doctorId));
        }

        if (doctor) {
            return {
                ...patient,
                doctorName: doctor.name,
                doctorPhoto: doctor.photo || doctor.image || null,
                doctorSpecialty: doctor.specialty
            };
        }
        return patient;
    } catch (error) {
        console.warn("Error attaching doctor info:", error);
        return patient;
    }
};


const writeLocalData = (data) => {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing local data:', e);
    }
};

// --- Database Operations ---

const getPatients = async () => {
    try {
        if (db) {
            console.log('Fetching patients from Firestore...');
            try {
                const snapshot = await db.collection('patients').get();
                // We should also look up doctors here for each patient, but for list view it might be heavy.
                // However, let's keep it simple for now and only attach detail on single fetch.
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return readLocalData();
            }
        } else {
            console.log('Fetching patients from Local File...');
            return readLocalData();
        }
    } catch (error) {
        console.error('Error in getPatients:', error);
        throw error;
    }
};

// --- Appointment Operations ---

const getAppointments = async (doctorId) => {
    try {
        if (db) {
            try {
                let query = db.collection('appointments');
                if (doctorId) {
                    // Try comparing as number first (legacy), then string if needed, or just string.
                    // safely handle both by not using strict equality in where if possible? No, Firestore is strict.
                    // Let's assume we store as Number for now based on other IDs.
                    query = query.where('doctorId', '==', parseInt(doctorId) || doctorId);
                }
                const snapshot = await query.get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return getLocalAppointments(doctorId);
            }
        } else {
            return getLocalAppointments(doctorId);
        }
    } catch (error) {
        console.error('Error in getAppointments:', error);
        throw error;
    }
};

const createAppointment = async (appointmentData) => {
    try {
        if (db) {
            try {
                const docRef = await db.collection('appointments').add(appointmentData);
                return { id: docRef.id, ...appointmentData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return createLocalAppointment(appointmentData);
            }
        } else {
            return createLocalAppointment(appointmentData);
        }
    } catch (error) {
        console.error('Error in createAppointment:', error);
        throw error;
    }
};

const updateAppointment = async (id, updateData) => {
    try {
        if (db) {
            try {
                // Determine if updateData is just status or full object
                // If it came from legacy call it might be just status?
                // But we control the controller.
                await db.collection('appointments').doc(String(id)).update(updateData);
                return { id, ...updateData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return updateLocalAppointment(id, updateData);
            }
        } else {
            return updateLocalAppointment(id, updateData);
        }
    } catch (error) {
        console.error('Error in updateAppointment:', error);
        throw error;
    }
};

const appointmentsPath = path.join(__dirname, '../data/appointments.json');

const getLocalAppointments = (doctorId) => {
    try {
        if (!fs.existsSync(appointmentsPath)) return [];
        const data = fs.readFileSync(appointmentsPath, 'utf8');
        let appointments = JSON.parse(data);
        if (doctorId) {
            appointments = appointments.filter(a => String(a.doctorId) === String(doctorId));
        }
        return appointments;
    } catch (e) {
        console.error('Error reading local appointments:', e);
        return [];
    }
};

const createLocalAppointment = (data) => {
    const appointments = getLocalAppointments();
    const newId = appointments.length > 0 ? Math.max(...appointments.map(a => parseInt(a.id) || 0)) + 1 : 1;
    const newAppointment = { ...data, id: newId };

    appointments.push(newAppointment);
    try {
        fs.writeFileSync(appointmentsPath, JSON.stringify(appointments, null, 2));
    } catch (e) {
        console.error('Error writing local appointments:', e);
    }
    return newAppointment;
};

const updateLocalAppointment = (id, updateData) => {
    let appointments = getLocalAppointments();
    const index = appointments.findIndex(a => String(a.id) === String(id));

    if (index === -1) return null;

    appointments[index] = { ...appointments[index], ...updateData };
    try {
        fs.writeFileSync(appointmentsPath, JSON.stringify(appointments, null, 2));
    } catch (e) {
        console.error('Error updating local appointment:', e);
    }
    return appointments[index];
};



// --- Messaging Operations ---

const getMessages = async (contactId) => {
    try {
        if (db) {
            try {
                // If contactId provided, filter by it (either sender or receiver)
                const snapshot = await db.collection('messages').orderBy('timestamp', 'asc').get();
                let messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (contactId) {
                    // Smart Filter: Check if contactId refers to a patient with a known UID
                    let targetIds = [String(contactId)];
                    try {
                        const patientDoc = await db.collection('patients').doc(String(contactId)).get();
                        if (patientDoc.exists && patientDoc.data().uid) {
                            targetIds.push(patientDoc.data().uid);
                        }
                    } catch (e) { /* ignore lookup error */ }

                    // Look for messages matching ANY of the target IDs (Database ID or Firebase UID)
                    messages = messages.filter(m =>
                        targetIds.includes(String(m.senderId)) || targetIds.includes(String(m.receiverId))
                    );
                }
                return messages;
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return getLocalMessages(contactId);
            }
        } else {
            return getLocalMessages(contactId);
        }
    } catch (error) {
        console.error('Error in getMessages:', error);
        throw error;
    }
};

const saveMessage = async (messageData) => {
    try {
        if (db) {
            try {
                // Ensure timestamp is a Date object or server timestamp if possible, but for simplicity here use ISO string or Date
                // The frontend sends timestamp usually.
                const docRef = await db.collection('messages').add(messageData);
                return { id: docRef.id, ...messageData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return saveLocalMessage(messageData);
            }
        } else {
            return saveLocalMessage(messageData);
        }
    } catch (error) {
        console.error('Error in saveMessage:', error);
        throw error;
    }
};

const messagesPath = path.join(__dirname, '../data/messages.json');

const getLocalMessages = (contactId) => {
    try {
        if (!fs.existsSync(messagesPath)) return [];
        const data = fs.readFileSync(messagesPath, 'utf8');
        let messages = JSON.parse(data);
        if (contactId) {
            messages = messages.filter(m => String(m.senderId) === String(contactId) || String(m.receiverId) === String(contactId));
        }
        return messages;
    } catch (e) {
        console.error('Error reading local messages:', e);
        return [];
    }
};

const saveLocalMessage = (messageData) => {
    let messages = [];
    try {
        if (fs.existsSync(messagesPath)) {
            const data = fs.readFileSync(messagesPath, 'utf8');
            messages = JSON.parse(data);
        }
    } catch (e) {
        // ignore
    }

    const newMessage = { id: Date.now().toString(), ...messageData };
    messages.push(newMessage);

    try {
        fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));
    } catch (e) {
        console.error('Error writing local messages:', e);
    }
    return newMessage;
};





// --- Prescription Operations ---

const getPrescriptions = async (patientId) => {
    try {
        if (db) {
            try {
                const snapshot = await db.collection('prescriptions').where('patientId', '==', parseInt(patientId)).get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return getLocalPrescriptions(patientId);
            }
        } else {
            return getLocalPrescriptions(patientId);
        }
    } catch (error) {
        console.error('Error in getPrescriptions:', error);
        throw error;
    }
};

const createPrescription = async (prescriptionData) => {
    try {
        if (db) {
            try {
                const docRef = await db.collection('prescriptions').add(prescriptionData);
                return { id: docRef.id, ...prescriptionData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return createLocalPrescription(prescriptionData);
            }
        } else {
            return createLocalPrescription(prescriptionData);
        }
    } catch (error) {
        console.error('Error in createPrescription:', error);
        throw error;
    }
};

const prescriptionsPath = path.join(__dirname, '../data/prescriptions.json');

const getLocalPrescriptions = (patientId) => {
    try {
        if (!fs.existsSync(prescriptionsPath)) return [];
        const data = fs.readFileSync(prescriptionsPath, 'utf8');
        const prescriptions = JSON.parse(data);
        return prescriptions.filter(p => String(p.patientId) === String(patientId));
    } catch (e) {
        console.error('Error reading local prescriptions:', e);
        return [];
    }
};

const createLocalPrescription = (data) => {
    let prescriptions = [];
    if (fs.existsSync(prescriptionsPath)) {
        prescriptions = JSON.parse(fs.readFileSync(prescriptionsPath, 'utf8'));
    }

    const newId = prescriptions.length > 0 ? Math.max(...prescriptions.map(p => parseInt(p.id) || 0)) + 1 : 1;
    const newPrescription = { ...data, id: newId };

    prescriptions.push(newPrescription);
    try {
        fs.writeFileSync(prescriptionsPath, JSON.stringify(prescriptions, null, 2));
    } catch (e) {
        console.error('Error writing local prescriptions:', e);
    }
    return newPrescription;
};

const getPatientByEmail = async (email) => {
    try {
        if (db) {
            try {
                const snapshot = await db.collection('patients').where('email', '==', email).limit(1).get();
                if (snapshot.empty) return null;
                const doc = snapshot.docs[0];
                return await attachDoctorInfo({ id: doc.id, ...doc.data() });
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                const patients = readLocalData();
                const patient = patients.find(p => p.email === email);
                return await attachDoctorInfo(patient);
            }
        } else {
            const patients = readLocalData();
            const patient = patients.find(p => p.email === email);
            return await attachDoctorInfo(patient);
        }
    } catch (error) {
        console.error('Error in getPatientByEmail:', error);
        throw error;
    }
};

const getPatientByPhone = async (phone) => {
    try {
        if (db) {
            try {
                const snapshot = await db.collection('patients').where('phone', '==', phone).limit(1).get();
                if (snapshot.empty) return null;
                const doc = snapshot.docs[0];
                return await attachDoctorInfo({ id: doc.id, ...doc.data() });
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                const patients = readLocalData();
                const patient = patients.find(p => p.phone === phone);
                return await attachDoctorInfo(patient);
            }
        } else {
            const patients = readLocalData();
            const patient = patients.find(p => p.phone === phone);
            return await attachDoctorInfo(patient);
        }
    } catch (error) {
        console.error('Error in getPatientByPhone:', error);
        throw error;
    }
};

const getPatientById = async (id) => {
    try {
        if (db) {
            try {
                const doc = await db.collection('patients').doc(String(id)).get();
                if (!doc.exists) return null;
                return await attachDoctorInfo({ id: doc.id, ...doc.data() });
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                const patients = readLocalData();
                const patient = patients.find(p => String(p.id) === String(id));
                return await attachDoctorInfo(patient);
            }
        } else {
            const patients = readLocalData();
            const patient = patients.find(p => String(p.id) === String(id));
            return await attachDoctorInfo(patient);
        }
    } catch (error) {
        console.error('Error in getPatientById:', error);
        throw error;
    }
};

const createPatient = async (patientData) => {
    try {
        if (db) {
            try {
                const docRef = await db.collection('patients').add(patientData);
                return { id: docRef.id, ...patientData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return createLocalPatient(patientData);
            }
        } else {
            return createLocalPatient(patientData);
        }
    } catch (error) {
        console.error('Error in createPatient:', error);
        throw error;
    }
};

const createLocalPatient = (patientData) => {
    const patients = readLocalData();
    const newId = patients.length > 0 ? Math.max(...patients.map(p => parseInt(p.id) || 0)) + 1 : 1;
    const newPatient = { ...patientData, id: newId };

    patients.push(newPatient);
    writeLocalData(patients);
    return newPatient;
};

const deletePatient = async (id) => {
    try {
        if (db) {
            try {
                await db.collection('patients').doc(String(id)).delete();
                return true;
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return deleteLocalPatient(id);
            }
        } else {
            return deleteLocalPatient(id);
        }
    } catch (error) {
        console.error('Error in deletePatient:', error);
        throw error;
    }
};

const deleteLocalPatient = (id) => {
    let patients = readLocalData();
    const initialLength = patients.length;
    patients = patients.filter(p => String(p.id) !== String(id));

    if (patients.length === initialLength) return false;

    writeLocalData(patients);
    return true;
};

// --- Migration Tool ---
const migrateToFirestore = async () => {
    try {
        if (!db) return;

        // Try to access Firestore. If it fails (disabled API), catch and abort migration silently or log.
        try {
            const snapshot = await db.collection('patients').limit(1).get();
            const localPatients = readLocalData();

            if (snapshot.empty && localPatients.length > 0) {
                console.log('Migrating local patients to Firestore...');
                for (const p of localPatients) {
                    const { id, ...data } = p;
                    await db.collection('patients').doc(String(id)).set(data);
                }
                console.log('Migration complete.');
            }
        } catch (fsError) {
            console.error('Migration skipped due to Firestore Error:', fsError.message);
        }
    } catch (error) {
        console.error('Error in migrateToFirestore:', error);
    }
};

const updatePatient = async (id, patientData) => {
    try {
        if (db) {
            try {
                await db.collection('patients').doc(String(id)).update(patientData);
                return { id, ...patientData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return updateLocalPatient(id, patientData);
            }
        } else {
            return updateLocalPatient(id, patientData);
        }
    } catch (error) {
        console.error('Error in updatePatient:', error);
        throw error;
    }
};

const updateLocalPatient = (id, patientData) => {
    let patients = readLocalData();
    const index = patients.findIndex(p => String(p.id) === String(id));

    if (index === -1) return null;

    patients[index] = { ...patients[index], ...patientData };
    writeLocalData(patients);
    return patients[index];
};

// --- Vitals Operations ---

const getVitals = async (patientId) => {
    try {
        if (db) {
            try {
                const snapshot = await db.collection('patients').doc(String(patientId)).collection('vitals').orderBy('date', 'desc').get();
                const readings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Return in structure expected by frontend (object with readings array)
                // If we want to maintain backward compatibility with the old JSON structure which was an array of objects like { patientId, readings: [] }
                // We'll wrap it.
                return { patientId: parseInt(patientId), readings };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return getLocalVitals(patientId);
            }
        } else {
            return getLocalVitals(patientId);
        }
    } catch (error) {
        console.error('Error in getVitals:', error);
        throw error;
    }
};

const addVital = async (patientId, vitalData) => {
    try {
        if (db) {
            try {
                await db.collection('patients').doc(String(patientId)).collection('vitals').add(vitalData);
                // Return updated vitals list to update frontend state easily? Or just the new vital?
                // Frontend currently fetches all vitals again or appends.
                // Let's return the new vital with an ID.
                return { ...vitalData, date: vitalData.date };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return addLocalVital(patientId, vitalData);
            }
        } else {
            return addLocalVital(patientId, vitalData);
        }
    } catch (error) {
        console.error('Error in addVital:', error);
        throw error;
    }
};

const vitalsPath = path.join(__dirname, '../data/vitals.json');

const getLocalVitals = (patientId) => {
    try {
        if (!fs.existsSync(vitalsPath)) return { patientId: parseInt(patientId), readings: [] };
        const data = fs.readFileSync(vitalsPath, 'utf8');
        const allVitals = JSON.parse(data);
        const patientVitals = allVitals.find(v => v.patientId === parseInt(patientId));

        if (!patientVitals) {
            return { patientId: parseInt(patientId), readings: [] };
        }
        return patientVitals;
    } catch (e) {
        console.error('Error reading local vitals:', e);
        return { patientId: parseInt(patientId), readings: [] };
    }
};

const addLocalVital = (patientId, vitalData) => {
    try {
        let allVitals = [];
        if (fs.existsSync(vitalsPath)) {
            allVitals = JSON.parse(fs.readFileSync(vitalsPath, 'utf8'));
        }

        let patientVitals = allVitals.find(v => v.patientId === parseInt(patientId));
        if (!patientVitals) {
            patientVitals = { patientId: parseInt(patientId), readings: [] };
            allVitals.push(patientVitals);
        }

        patientVitals.readings.push(vitalData);
        // Sort by date desc
        patientVitals.readings.sort((a, b) => new Date(b.date) - new Date(a.date));

        fs.writeFileSync(vitalsPath, JSON.stringify(allVitals, null, 2));
        return vitalData;
    } catch (e) {
        console.error('Error writing local vitals:', e);
        throw e;
    }
}


// --- Payment Operations ---

const getPayments = async (patientId) => {
    try {
        if (db) {
            try {
                const snapshot = await db.collection('payments')
                    .where('patientId', '==', String(patientId))
                    .orderBy('date', 'desc')
                    .get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return getLocalPayments(patientId);
            }
        } else {
            return getLocalPayments(patientId);
        }
    } catch (error) {
        console.error('Error in getPayments:', error);
        throw error;
    }
};

const createPayment = async (paymentData) => {
    try {
        if (db) {
            try {
                const docRef = await db.collection('payments').add(paymentData);
                return { id: docRef.id, ...paymentData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return createLocalPayment(paymentData);
            }
        } else {
            return createLocalPayment(paymentData);
        }
    } catch (error) {
        console.error('Error in createPayment:', error);
        throw error;
    }
};

const paymentsPath = path.join(__dirname, '../data/payments.json');

const getLocalPayments = (patientId) => {
    try {
        if (!fs.existsSync(paymentsPath)) return [];
        const data = fs.readFileSync(paymentsPath, 'utf8');
        const payments = JSON.parse(data);
        return payments
            .filter(p => String(p.patientId) === String(patientId))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
        console.error('Error reading local payments:', e);
        return [];
    }
};

const createLocalPayment = (data) => {
    let payments = [];
    if (fs.existsSync(paymentsPath)) {
        payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf8'));
    }

    const newId = payments.length > 0 ? Math.max(...payments.map(p => parseInt(p.id) || 0)) + 1 : 1;
    const newPayment = { ...data, id: newId };

    payments.push(newPayment);
    try {
        fs.writeFileSync(paymentsPath, JSON.stringify(payments, null, 2));
    } catch (e) {
        console.error('Error writing local payments:', e);
    }
    return newPayment;
};

const getPatientDocuments = async (patientId) => {
    try {
        if (db) {
            try {
                // Get from sub-collection
                const snapshot = await db.collection('patients').doc(String(patientId)).collection('documents').orderBy('date', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                const patients = readLocalData();
                const p = patients.find(p => String(p.id) === String(patientId));
                return p?.documents || [];
            }
        } else {
            const patients = readLocalData();
            const p = patients.find(p => String(p.id) === String(patientId));
            return p?.documents || [];
        }
    } catch (error) {
        console.error('Error fetching documents:', error);
        return [];
    }
};

const addPatientDocument = async (patientId, docData) => {
    try {
        if (db) {
            try {
                const docRef = await db.collection('patients').doc(String(patientId)).collection('documents').add(docData);
                return { id: docRef.id, ...docData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return addLocalPatientDocument(patientId, docData);
            }
        } else {
            return addLocalPatientDocument(patientId, docData);
        }
    } catch (error) {
        console.error('Error adding document:', error);
        throw error;
    }
};

const addLocalPatientDocument = (patientId, docData) => {
    let patients = readLocalData();
    const index = patients.findIndex(p => String(p.id) === String(patientId));
    if (index === -1) throw new Error("Patient not found");

    const newDoc = { id: Date.now().toString(), ...docData };

    if (!patients[index].documents) patients[index].documents = [];
    patients[index].documents.push(newDoc);

    writeLocalData(patients);
    return newDoc;
};

// --- Medical Records Operations ---

const getMedicalRecords = async (patientId) => {
    try {
        if (db) {
            try {
                const snapshot = await db.collection('patients').doc(String(patientId)).collection('medicalRecords').orderBy('date', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                const patients = readLocalData();
                const p = patients.find(p => String(p.id) === String(patientId));
                return p?.medicalRecords || [];
            }
        } else {
            const patients = readLocalData();
            const p = patients.find(p => String(p.id) === String(patientId));
            return p?.medicalRecords || [];
        }
    } catch (error) {
        console.error('Error fetching medical records:', error);
        return [];
    }
};

const addMedicalRecord = async (patientId, recordData) => {
    try {
        if (db) {
            try {
                const docRef = await db.collection('patients').doc(String(patientId)).collection('medicalRecords').add(recordData);
                return { id: docRef.id, ...recordData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return addLocalMedicalRecord(patientId, recordData);
            }
        } else {
            return addLocalMedicalRecord(patientId, recordData);
        }
    } catch (error) {
        console.error('Error adding medical record:', error);
        throw error;
    }
};

const addLocalMedicalRecord = (patientId, recordData) => {
    let patients = readLocalData();
    const index = patients.findIndex(p => String(p.id) === String(patientId));
    if (index === -1) throw new Error("Patient not found");

    const newRecord = { id: Date.now().toString(), ...recordData };

    if (!patients[index].medicalRecords) patients[index].medicalRecords = [];
    patients[index].medicalRecords.push(newRecord);

    writeLocalData(patients);
    return newRecord;
};

module.exports = {
    getPatients,
    getPatientById,
    getPatientByEmail,
    getVitals,
    addVital,
    createPatient,
    updatePatient,
    deletePatient,
    getAppointments,
    createAppointment,
    updateAppointment,
    getMessages,
    saveMessage,
    getPayments,
    createPayment,
    attachDoctorInfo,
    getPatientDocuments,
    addPatientDocument,
    getMedicalRecords,
    addMedicalRecord
};
