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

const getAppointments = async () => {
    try {
        if (db) {
            try {
                const snapshot = await db.collection('appointments').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return getLocalAppointments();
            }
        } else {
            return getLocalAppointments();
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

const updateAppointmentStatus = async (id, status) => {
    try {
        if (db) {
            try {
                await db.collection('appointments').doc(String(id)).update({ status });
                return { id, status };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return updateLocalAppointmentStatus(id, status);
            }
        } else {
            return updateLocalAppointmentStatus(id, status);
        }
    } catch (error) {
        console.error('Error in updateAppointmentStatus:', error);
        throw error;
    }
};

const appointmentsPath = path.join(__dirname, '../data/appointments.json');

const getLocalAppointments = () => {
    try {
        if (!fs.existsSync(appointmentsPath)) return [];
        const data = fs.readFileSync(appointmentsPath, 'utf8');
        return JSON.parse(data);
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

const updateLocalAppointmentStatus = (id, status) => {
    let appointments = getLocalAppointments();
    const index = appointments.findIndex(a => String(a.id) === String(id));

    if (index === -1) return null;

    appointments[index].status = status;
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
                // Firestore queries for OR conditions are tricky, usually need separate queries or client-side filter
                // specific to this simple app use case.
                const snapshot = await db.collection('messages').orderBy('timestamp', 'asc').get();
                let messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (contactId) {
                    messages = messages.filter(m => m.senderId === String(contactId) || m.receiverId === String(contactId));
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

const createMessage = async (messageData) => {
    try {
        if (db) {
            try {
                const docRef = await db.collection('messages').add(messageData);
                return { id: docRef.id, ...messageData };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                return createLocalMessage(messageData);
            }
        } else {
            return createLocalMessage(messageData);
        }
    } catch (error) {
        console.error('Error in createMessage:', error);
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
            messages = messages.filter(m => m.senderId === String(contactId) || m.receiverId === String(contactId));
        }
        return messages;
    } catch (e) {
        console.error('Error reading local messages:', e);
        return [];
    }
};

const createLocalMessage = (data) => {
    const messages = getLocalMessages(); // Get all to append
    // Re-read all to ensure we have full list for ID gen
    let allMessages = [];
    if (fs.existsSync(messagesPath)) {
        allMessages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    }

    const newId = allMessages.length > 0 ? Math.max(...allMessages.map(m => parseInt(m.id) || 0)) + 1 : 1;
    const newMessage = { ...data, id: newId };

    allMessages.push(newMessage);
    try {
        fs.writeFileSync(messagesPath, JSON.stringify(allMessages, null, 2));
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
                return { id: doc.id, ...doc.data() };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                const patients = readLocalData();
                return patients.find(p => p.email === email);
            }
        } else {
            const patients = readLocalData();
            return patients.find(p => p.email === email);
        }
    } catch (error) {
        console.error('Error in getPatientByEmail:', error);
        throw error;
    }
};

const getPatientById = async (id) => {
    try {
        if (db) {
            try {
                const doc = await db.collection('patients').doc(String(id)).get();
                if (!doc.exists) return null;
                return { id: doc.id, ...doc.data() };
            } catch (fsError) {
                console.error('Firestore Error (Fallback to Local):', fsError.message);
                const patients = readLocalData();
                return patients.find(p => String(p.id) === String(id));
            }
        } else {
            const patients = readLocalData();
            return patients.find(p => String(p.id) === String(id));
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

module.exports = {
    getPatients,
    getPatientById,
    getPatientByEmail,
    createPatient,
    updatePatient,
    deletePatient,
    migrateToFirestore,
    getVitals,
    addVital,
    getAppointments,
    createAppointment,
    updateAppointmentStatus,
    getMessages,
    createMessage,
    getPrescriptions,
    createPrescription,
    getPayments,
    createPayment
};
