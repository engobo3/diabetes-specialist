const BaseRepository = require('./BaseRepository');
const { PatientSchema } = require('../schemas/patient.schema');
const DoctorRepository = require('./DoctorRepository'); // Circular? Need to handle carefully. 
// Actually, let's just use BaseRepository logic or duplicate simple read logic if needed to avoid full circular dependency issues 
// or define DoctorRepository first. 
// Ideally, Repository just handles data. Service handles joins. 
// BUT, the goal is to refactor `database.js` which did everything.
// Let's implement basic CRUD here and let the Logic/Service layer handle the "Attach Doctor" part?
// `database.js` had `attachDoctorInfo`.
// I will implement `attachDoctor` helper here for now to keep parity.

class PatientRepository extends BaseRepository {
    constructor() {
        super('patients', 'patients.json');
        this.doctorRepo = new (require('./DoctorRepository'))();
    }

    async findAllWithDetails() {
        const patients = await this.findAll();
        // Parallelize doctor attachment
        return Promise.all(patients.map(p => this.attachDoctor(p)));
    }

    async findByIdWithDetails(id) {
        const patient = await this.findById(id);
        return this.attachDoctor(patient);
    }

    async findByEmail(email) {
        const patients = await this.findAll(); // Inefficient for Firestore if not indexed/queried properly, 
        // but BaseRepository.findAll handles the switch. 
        // Optimization: Override with specific query if db exists.

        // TODO: Implement `findByField` in BaseRepository or specific override here.
        // For now, consistent with `database.js` fallback logic:
        const found = patients.find(p => p.email === email);
        return this.attachDoctor(found);
    }

    async findByPhone(phone) {
        const patients = await this.findAll();
        const found = patients.find(p => p.phone === phone);
        return this.attachDoctor(found);
    }

    async attachDoctor(patient) {
        if (!patient || !patient.doctorId) return patient;

        try {
            const doctor = await this.doctorRepo.findById(patient.doctorId);
            if (doctor) {
                return {
                    ...patient,
                    doctorName: doctor.name,
                    doctorPhoto: doctor.photo || doctor.image || null,
                    doctorSpecialty: doctor.specialty
                };
            }
        } catch (e) {
            console.warn(`Error attaching doctor for patient ${patient.id}:`, e);
        }
        return patient;
    }

    // Override create to validate
    async create(data) {
        const validated = PatientSchema.parse(data);
        return super.create(validated);
    }

    async update(id, data) {
        // Partial validation for update? 
        // Zod defaults are strict. For partial updates, we might need PatientSchema.partial().parse(data).
        const validated = PatientSchema.partial().parse(data);
        return super.update(id, validated);
    }
}

module.exports = PatientRepository;
