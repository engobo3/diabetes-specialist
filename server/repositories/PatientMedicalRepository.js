/**
 * Patient Medical Repository (PHI)
 * Handles protected health information only
 * Separated from PII for enhanced security and access control
 */

const BaseRepository = require('./BaseRepository');
const { PatientMedicalSchema } = require('../schemas/patientMedical.schema');

class PatientMedicalRepository extends BaseRepository {
    constructor() {
        super('patient_medical', 'patient_medical.json');
    }

    /**
     * Create patient medical record
     */
    async create(data) {
        const validated = PatientMedicalSchema.parse(data);
        validated.createdAt = new Date().toISOString();
        validated.updatedAt = new Date().toISOString();
        return super.create(validated);
    }

    /**
     * Update patient medical data
     */
    async update(patientId, data) {
        data.updatedAt = new Date().toISOString();
        return super.update(patientId, data);
    }

    /**
     * Find by patient ID
     */
    async findByPatientId(patientId) {
        const all = await this.findAll();
        return all.find(p => String(p.patientId) === String(patientId));
    }

    /**
     * Find by doctor ID (get all patients for a doctor)
     */
    async findByDoctorId(doctorId) {
        const all = await this.findAll();
        return all.filter(p => String(p.doctorId) === String(doctorId));
    }

    /**
     * Find critical status patients
     */
    async findCriticalPatients(doctorId = null) {
        const all = await this.findAll();
        let critical = all.filter(p => p.status === 'Critical');

        if (doctorId) {
            critical = critical.filter(p => String(p.doctorId) === String(doctorId));
        }

        return critical;
    }

    /**
     * Add clinical note (doctor only)
     */
    async addClinicalNote(patientId, note) {
        const medical = await this.findByPatientId(patientId);
        if (!medical) {
            throw new Error('Patient medical record not found');
        }

        const clinicalNotes = medical.clinicalNotes || [];
        clinicalNotes.push({
            date: new Date().toISOString(),
            ...note
        });

        return this.update(medical.id, { clinicalNotes });
    }

    /**
     * Update treatment plan
     */
    async updateTreatmentPlan(patientId, treatmentPlan) {
        treatmentPlan.lastUpdated = new Date().toISOString();
        return this.update(patientId, { treatmentPlan });
    }

    /**
     * Get patients needing attention
     */
    async getPatientsNeedingAttention(doctorId = null) {
        const all = await this.findAll();
        let needingAttention = all.filter(p =>
            p.status === 'Attention Needed' || p.status === 'Critical'
        );

        if (doctorId) {
            needingAttention = needingAttention.filter(p =>
                String(p.doctorId) === String(doctorId)
            );
        }

        return needingAttention;
    }

    /**
     * Find patients with caregivers (for caregiver management)
     */
    async findPatientsWithCaregiver(caregiverEmail) {
        const all = await this.findAll();
        return all.filter(p =>
            p.caregivers && p.caregivers.some(cg =>
                cg.email.toLowerCase() === caregiverEmail.toLowerCase() &&
                cg.status === 'active'
            )
        );
    }
}

module.exports = PatientMedicalRepository;
