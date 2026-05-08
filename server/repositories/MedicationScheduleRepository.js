const BaseRepository = require('./BaseRepository');
const { MedicationScheduleSchema } = require('../schemas/medicationSchedule.schema');
const { db } = require('../config/firebaseConfig');

class MedicationScheduleRepository extends BaseRepository {
    constructor() {
        super('medication_schedules', 'medication_schedules.json');
    }

    async findByPatientId(patientId) {
        try {
            if (db) {
                try {
                    const numId = parseInt(patientId);
                    const strId = String(patientId);

                    let snapshot = await db.collection(this.collectionName)
                        .where('patientId', '==', isNaN(numId) ? strId : numId)
                        .get();

                    // Dual ID matching fallback
                    if (snapshot.empty && !isNaN(numId)) {
                        snapshot = await db.collection(this.collectionName)
                            .where('patientId', '==', strId)
                            .get();
                    }

                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fsError) {
                    console.error('Firestore Error in findByPatientId [medication_schedules]:', fsError.message);
                    return this._readLocal().filter(
                        m => String(m.patientId) === String(patientId)
                    );
                }
            } else {
                return this._readLocal().filter(
                    m => String(m.patientId) === String(patientId)
                );
            }
        } catch (error) {
            console.error('MedicationScheduleRepository findByPatientId error:', error);
            throw error;
        }
    }

    async findActiveByPatientId(patientId) {
        const all = await this.findByPatientId(patientId);
        return all.filter(m => m.active !== false);
    }

    async create(data) {
        const validated = MedicationScheduleSchema.parse({
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return super.create(validated);
    }

    async update(id, data) {
        const validated = MedicationScheduleSchema.partial().parse({
            ...data,
            updatedAt: new Date().toISOString()
        });
        return super.update(id, validated);
    }
}

module.exports = MedicationScheduleRepository;
