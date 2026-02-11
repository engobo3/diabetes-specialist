const BaseRepository = require('./BaseRepository');
const { MedicalRecordSchema } = require('../schemas/medicalRecord.schema');
const { db } = require('../config/firebaseConfig');

class MedicalRecordRepository extends BaseRepository {
    constructor() {
        super('medical_records', 'medical_records.json');
    }

    async findByPatientId(patientId) {
        try {
            if (db) {
                try {
                    const numId = parseInt(patientId);
                    const strId = String(patientId);

                    let snapshot = await db.collection(this.collectionName)
                        .where('patientId', '==', isNaN(numId) ? strId : numId)
                        .orderBy('date', 'desc')
                        .get();

                    if (snapshot.empty && !isNaN(numId)) {
                        snapshot = await db.collection(this.collectionName)
                            .where('patientId', '==', strId)
                            .orderBy('date', 'desc')
                            .get();
                    }

                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fsError) {
                    console.error('Firestore Error in findByPatientId (Fallback to Local):', fsError.message);
                    return this._getLocalByPatientId(patientId);
                }
            } else {
                return this._getLocalByPatientId(patientId);
            }
        } catch (error) {
            console.error('MedicalRecordRepository findByPatientId error:', error);
            throw error;
        }
    }

    _getLocalByPatientId(patientId) {
        const all = this._readLocal();
        return all.filter(r => String(r.patientId) === String(patientId));
    }

    async create(data) {
        const validated = MedicalRecordSchema.parse(data);
        return super.create(validated);
    }
}

module.exports = MedicalRecordRepository;
