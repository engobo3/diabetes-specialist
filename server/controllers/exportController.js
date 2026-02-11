const { buildDossierPDF } = require('../services/pdfDossierService');
const db = require('../services/database');

const exportPatientPDF = async (req, res) => {
    try {
        const { patientId } = req.params;

        // Fetch patient (with attached doctors)
        const patient = await db.getPatientById(patientId);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Auth check: requesting user must be the patient themselves or one of their doctors
        const uid = req.user?.uid;
        const isPatient = patient.email === req.user?.email;
        const isDoctor = (patient.doctorIds || []).some(
            dId => String(dId) === String(uid)
        );

        if (!isPatient && !isDoctor) {
            return res.status(403).json({ message: 'Access denied: not authorized to view this patient dossier' });
        }

        // Fetch all data in parallel
        const [vitals, prescriptions, medicalRecords, appointments, documents] = await Promise.all([
            db.getVitals(patientId),
            db.getPrescriptions(patientId),
            fetchMedicalRecords(patientId),
            fetchAppointments(patientId),
            db.getPatientDocuments(patientId),
        ]);

        // Build and stream PDF
        const pdfDoc = buildDossierPDF({
            patient,
            vitals: vitals || [],
            prescriptions: prescriptions || [],
            medicalRecords: medicalRecords || [],
            appointments: appointments || [],
            documents: documents || [],
        });

        const safeName = (patient.name || 'patient').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Dossier_Medical_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        pdfDoc.pipe(res);
    } catch (error) {
        console.error('Error generating patient PDF:', error);
        res.status(500).json({ message: 'Error generating PDF dossier' });
    }
};

// Helper: fetch medical records using the repository directly
async function fetchMedicalRecords(patientId) {
    const MedicalRecordRepository = require('../repositories/MedicalRecordRepository');
    const repo = new MedicalRecordRepository();
    return repo.findByPatientId(patientId);
}

// Helper: fetch appointments for a patient
async function fetchAppointments(patientId) {
    const AppointmentRepository = require('../repositories/AppointmentRepository');
    const repo = new AppointmentRepository();
    const all = await repo.findAll();
    return (all || []).filter(a => String(a.patientId) === String(patientId));
}

module.exports = { exportPatientPDF };
