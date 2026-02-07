const PatientRepository = require('../repositories/PatientRepository');
const DoctorRepository = require('../repositories/DoctorRepository');
const AppointmentRepository = require('../repositories/AppointmentRepository');
const MessageRepository = require('../repositories/MessageRepository');
const PrescriptionRepository = require('../repositories/PrescriptionRepository');
const VitalRepository = require('../repositories/VitalRepository');
const PaymentRepository = require('../repositories/PaymentRepository');
const PatientDocumentRepository = require('../repositories/PatientDocumentRepository');

const patientRepo = new PatientRepository();
const doctorRepo = new DoctorRepository();
const appointmentRepo = new AppointmentRepository();
const messageRepo = new MessageRepository();
const prescriptionRepo = new PrescriptionRepository();
const vitalRepo = new VitalRepository();
const paymentRepo = new PaymentRepository();
const docRepo = new PatientDocumentRepository();

// --- Database Operations ---

const getPatients = async () => {
    return patientRepo.findAllWithDetails();
};

const getPatientByEmail = async (email) => {
    return patientRepo.findByEmail(email);
};

const getPatientByPhone = async (phone) => {
    return patientRepo.findByPhone(phone);
};

const getPatientById = async (id) => {
    return patientRepo.findByIdWithDetails(id);
};

const createPatient = async (patientData) => {
    return patientRepo.create(patientData);
};

const updatePatient = async (id, patientData) => {
    return patientRepo.update(id, patientData);
};

const deletePatient = async (id) => {
    return patientRepo.delete(id);
};

// --- Doctor Operations --- (if needed exposed)

// --- Appointment Operations ---

const getAppointments = async (doctorId) => {
    return appointmentRepo.findByDoctorId(doctorId);
};

const createAppointment = async (appointmentData) => {
    return appointmentRepo.create(appointmentData);
};

const updateAppointment = async (id, updateData) => {
    return appointmentRepo.update(id, updateData);
};

// --- Messaging Operations ---

const getMessages = async (contactId) => {
    return messageRepo.getMessagesForContact(contactId);
};

const getConversation = async (userId, contactId) => {
    return messageRepo.getConversation(userId, contactId);
};

const saveMessage = async (messageData) => {
    return messageRepo.create(messageData);
};

// --- Prescription Operations ---

const getPrescriptions = async (patientId) => {
    return prescriptionRepo.findByPatientId(patientId);
};

const createPrescription = async (prescriptionData) => {
    return prescriptionRepo.create(prescriptionData);
};

// --- Vitals Operations ---

const getVitals = async (patientId) => {
    return vitalRepo.getByPatientId(patientId);
};

const addVital = async (patientId, vitalData) => {
    return vitalRepo.add(patientId, vitalData);
};

// --- Payment Operations ---

const getPayments = async (patientId) => {
    return paymentRepo.getByPatientId(patientId);
};

const createPayment = async (paymentData) => {
    return paymentRepo.create(paymentData);
};

// --- Document Operations ---

const getPatientDocuments = async (patientId) => {
    return docRepo.getByPatientId(patientId);
};

const addPatientDocument = async (patientId, docData) => {
    return docRepo.add(patientId, docData);
};

// --- Migration Tool ---
const migrateToFirestore = async () => {
    console.log('Migration function called. Logic moved to individual repositories or deprecated.');
    // Logic could be:
    // const patients = await patientRepo._readLocal();
    // for (const p of patients) await patientRepo.create(p); -- but ensure we set specific IDs if needed
    // Keeping empty or basic for now as focused on schema redesign.
};

module.exports = {
    getPatients,
    getAppointments,
    createAppointment,
    updateAppointment,
    getMessages,
    getConversation,
    saveMessage,
    getPrescriptions,
    createPrescription,
    getPatientByEmail,
    getPatientByPhone,
    getPatientById,
    createPatient,
    deletePatient,
    updatePatient,
    migrateToFirestore,
    getVitals,
    addVital,
    getPayments,
    createPayment,
    getPatientDocuments,
    addPatientDocument
};
