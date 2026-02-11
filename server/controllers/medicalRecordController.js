const MedicalRecordRepository = require('../repositories/MedicalRecordRepository');
const repo = new MedicalRecordRepository();

const getPatientMedicalRecords = async (req, res) => {
    try {
        const { patientId } = req.params;
        const records = await repo.findByPatientId(patientId);
        res.json(records);
    } catch (error) {
        console.error('Error fetching medical records:', error);
        res.status(500).json({ message: 'Error fetching medical records' });
    }
};

const addMedicalRecord = async (req, res) => {
    try {
        const { patientId, type, title, content, date, metadata } = req.body;

        if (!patientId || !type || !title || !content) {
            return res.status(400).json({ message: 'Missing required fields: patientId, type, title, content' });
        }

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
        console.error('Error creating medical record:', error);
        if (error.name === 'ZodError') {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        res.status(500).json({ message: 'Error creating medical record' });
    }
};

const getMedicalRecordById = async (req, res) => {
    try {
        const record = await repo.findById(req.params.id);
        if (!record) {
            return res.status(404).json({ message: 'Medical record not found' });
        }
        res.json(record);
    } catch (error) {
        console.error('Error fetching medical record:', error);
        res.status(500).json({ message: 'Error fetching medical record' });
    }
};

module.exports = {
    getPatientMedicalRecords,
    addMedicalRecord,
    getMedicalRecordById
};
