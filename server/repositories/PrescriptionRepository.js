const BaseRepository = require('./BaseRepository');
const { PrescriptionSchema } = require('../schemas/prescription.schema');
const { db } = require('../config/firebaseConfig');

class PrescriptionRepository extends BaseRepository {
    constructor() {
        super('prescriptions', 'prescriptions.json');
    }

    async findByPatientId(patientId) {
        try {
            if (db) {
                try {
                    const snapshot = await db.collection(this.collectionName)
                        .where('patientId', '==', parseInt(patientId))
                        .get();
                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fsError) {
                    console.error('Firestore Error in findByPatientId (Fallback to Local):', fsError.message);
                    return this._getLocalByPatientId(patientId);
                }
            } else {
                return this._getLocalByPatientId(patientId);
            }
        } catch (error) {
            console.error('PrescriptionRepository findByPatientId error:', error);
            throw error;
        }
    }

    _getLocalByPatientId(patientId) {
        const all = this._readLocal();
        return all.filter(p => String(p.patientId) === String(patientId));
    }

    async create(data) {
        const validated = PrescriptionSchema.parse(data);
        return super.create(validated);
    }
}

module.exports = PrescriptionRepository;
