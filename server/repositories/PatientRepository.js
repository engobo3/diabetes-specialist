const BaseRepository = require('./BaseRepository');
const { PatientSchema } = require('../schemas/patient.schema');
const { db } = require('../config/firebaseConfig');

class PatientRepository extends BaseRepository {
    constructor() {
        super('patients', 'patients.json');
        this.doctorRepo = new (require('./DoctorRepository'))();
    }

    // Build canonical doctorIds array from both doctorId and doctorIds fields
    _resolveDoctorIds(patient) {
        if (!patient) return [];
        const ids = new Set();
        if (patient.doctorIds && Array.isArray(patient.doctorIds)) {
            patient.doctorIds.forEach(id => ids.add(String(id)));
        }
        if (patient.doctorId) {
            ids.add(String(patient.doctorId));
        }
        return [...ids];
    }

    async findAllWithDetails() {
        const patients = await this.findAll();
        return Promise.all(patients.map(p => this.attachDoctors(p)));
    }

    async findByIdWithDetails(id) {
        const patient = await this.findById(id);
        return this.attachDoctors(patient);
    }

    async findByEmail(email) {
        const patients = await this.findAll();
        const normalizedEmail = email.toLowerCase().trim();
        const found = patients.find(p => p.email && p.email.toLowerCase().trim() === normalizedEmail);
        return this.attachDoctors(found);
    }

    // Normalize phone: strip spaces, dashes, +, and convert leading 0 to 243 (DRC)
    _normalizePhone(phone) {
        if (!phone) return '';
        let cleaned = phone.replace(/[\s\-().]/g, '').replace(/^\+/, '');
        // Normalize DRC: 0xx → 243xx
        if (cleaned.startsWith('0') && cleaned.length >= 9) {
            cleaned = '243' + cleaned.slice(1);
        }
        return cleaned;
    }

    async findByPhone(phone) {
        const patients = await this.findAll();
        const normalizedPhone = this._normalizePhone(phone);
        const found = patients.find(p => p.phone && this._normalizePhone(p.phone) === normalizedPhone);
        return this.attachDoctors(found);
    }

    // Find patients linked to a specific doctor (uses array-contains on doctorIds + legacy doctorId fallback)
    async findByDoctorId(doctorId) {
        try {
            if (db) {
                const seen = new Set();
                const results = [];

                // Query 1: doctorIds array-contains
                try {
                    const snap1 = await db.collection(this.collectionName)
                        .where('doctorIds', 'array-contains', String(doctorId))
                        .get();
                    snap1.docs.forEach(doc => {
                        seen.add(doc.id);
                        results.push({ id: doc.id, ...doc.data() });
                    });
                } catch (e) {
                    console.warn('array-contains query failed, trying legacy:', e.message);
                }

                // Query 2: legacy doctorId field (for un-migrated patients)
                try {
                    const snap2 = await db.collection(this.collectionName)
                        .where('doctorId', '==', String(doctorId))
                        .get();
                    snap2.docs.forEach(doc => {
                        if (!seen.has(doc.id)) {
                            seen.add(doc.id);
                            results.push({ id: doc.id, ...doc.data() });
                        }
                    });
                    // Also try numeric ID for legacy data
                    const numId = parseInt(doctorId);
                    if (!isNaN(numId)) {
                        const snap3 = await db.collection(this.collectionName)
                            .where('doctorId', '==', numId)
                            .get();
                        snap3.docs.forEach(doc => {
                            if (!seen.has(doc.id)) {
                                seen.add(doc.id);
                                results.push({ id: doc.id, ...doc.data() });
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Legacy doctorId query failed:', e.message);
                }

                return Promise.all(results.map(p => this.attachDoctors(p)));
            } else {
                // Local fallback
                const patients = await this.findAll();
                const filtered = patients.filter(p => {
                    const ids = this._resolveDoctorIds(p);
                    return ids.includes(String(doctorId));
                });
                return Promise.all(filtered.map(p => this.attachDoctors(p)));
            }
        } catch (error) {
            console.error('findByDoctorId error:', error);
            throw error;
        }
    }

    async attachDoctors(patient) {
        if (!patient) return patient;

        const doctorIds = this._resolveDoctorIds(patient);
        if (doctorIds.length === 0) return patient;

        try {
            const doctorPromises = doctorIds.map(id => this.doctorRepo.findById(id).catch(() => null));
            const doctorResults = await Promise.all(doctorPromises);
            const doctors = doctorResults
                .filter(d => d !== null)
                .map(d => ({
                    id: d.id,
                    name: d.name,
                    photo: d.photo || d.image || null,
                    specialty: d.specialty
                }));

            const primary = doctors[0];
            return {
                ...patient,
                doctors,
                // Backward compat: first doctor as primary
                doctorName: primary ? primary.name : patient.doctorName,
                doctorPhoto: primary ? primary.photo : patient.doctorPhoto,
                doctorSpecialty: primary ? primary.specialty : patient.doctorSpecialty,
            };
        } catch (e) {
            console.warn(`Error attaching doctors for patient ${patient.id}:`, e);
        }
        return patient;
    }

    // Override create: auto-populate doctorIds from doctorId
    async create(data) {
        // Ensure doctorIds is populated
        if (!data.doctorIds && data.doctorId) {
            data.doctorIds = [String(data.doctorId)];
        } else if (data.doctorIds && !data.doctorId) {
            data.doctorId = data.doctorIds[0];
        }
        const validated = PatientSchema.parse(data);
        return super.create(validated);
    }

    async update(id, data) {
        // Sync doctorId <-> doctorIds on update
        if (data.doctorIds && !data.doctorId) {
            data.doctorId = data.doctorIds[0];
        } else if (data.doctorId && !data.doctorIds) {
            // If only doctorId is being set, merge into existing doctorIds
            const existing = await this.findById(id);
            if (existing) {
                const ids = new Set((existing.doctorIds || []).map(String));
                ids.add(String(data.doctorId));
                data.doctorIds = [...ids];
            }
        }
        const validated = PatientSchema.partial().parse(data);
        return super.update(id, validated);
    }
}

module.exports = PatientRepository;
