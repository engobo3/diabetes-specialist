const MedicalRecordRepository = require('../repositories/MedicalRecordRepository');
const { logError } = require('../utils/safeLogger');
const repo = new MedicalRecordRepository();

const getPatientMedicalRecords = async (req, res) => {
    try {
        const { patientId } = req.params;
        const records = await repo.findByPatientId(patientId);
        res.json(records);
    } catch (error) {
        logError('getMedicalRecords', error, { requestId: req.requestId, patientId: req.params.patientId });
        res.status(500).json({ message: 'Error fetching medical records' });
    }
};

const addMedicalRecord = async (req, res) => {
    try {
        // Body has already been validated by the route's validateBody middleware,
        // but we keep this guard for defense in depth.
        const { patientId, type, title, content, date, metadata } = req.body;

        if (!patientId || !type || !title || !content) {
            return res.status(400).json({ message: 'Missing required fields: patientId, type, title, content' });
        }

        // Ownership: only doctors and admins are allowed to add records (enforced
        // at the route level). The doctorId on the record is the authenticated
        // user — never trust a client-supplied doctorId.
        const newRecord = await repo.create({
            patientId,
            type,
            title,
            content,
            date: date || new Date().toISOString().split('T')[0],
            metadata: metadata || {},
            doctorId: req.user?.uid || null,
            doctorName: req.body.doctorName || 'Dr. Specialist',
            createdAt: new Date().toISOString(),
        });

        res.status(201).json(newRecord);
    } catch (error) {
        logError('addMedicalRecord', error, { requestId: req.requestId });
        if (error.name === 'ZodError') {
            return res.status(400).json({ message: 'Validation error' });
        }
        res.status(500).json({ message: 'Error creating medical record' });
    }
};

// Ownership check happens here because the record's patientId is only known
// after the read. Returns 403 if the caller is neither the patient (self),
// a doctor/admin, nor a caregiver with viewVitals permission.
const getMedicalRecordById = async (req, res) => {
    try {
        const record = await repo.findById(req.params.id);
        if (!record) {
            return res.status(404).json({ message: 'Medical record not found' });
        }

        const role = req.user?.role;
        const allowed =
            role === 'doctor' || role === 'admin' ||
            (role === 'patient' && req.user?.patientId != null &&
             String(req.user.patientId) === String(record.patientId));

        if (!allowed) {
            // Caregivers may still have access — but enforcing that here would
            // require a patient lookup. Block by default; if caregiver access
            // becomes needed, add a separate /caregiver/medical-records route.
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(record);
    } catch (error) {
        logError('getMedicalRecord', error, { requestId: req.requestId, recordId: req.params.id });
        res.status(500).json({ message: 'Error fetching medical record' });
    }
};

module.exports = {
    getPatientMedicalRecords,
    addMedicalRecord,
    getMedicalRecordById
};
