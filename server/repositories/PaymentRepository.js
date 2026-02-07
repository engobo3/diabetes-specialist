const BaseRepository = require('./BaseRepository');
const { PaymentSchema } = require('../schemas/payment.schema');
const { db } = require('../config/firebaseConfig');

class PaymentRepository extends BaseRepository {
    constructor() {
        super('payments', 'payments.json');
    }

    async getByPatientId(patientId) {
        try {
            if (db) {
                try {
                    const snapshot = await db.collection(this.collectionName)
                        .where('patientId', '==', String(patientId))
                        .orderBy('date', 'desc')
                        .get();
                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fsError) {
                    console.error('Firestore Error in getByPatientId (Fallback to Local):', fsError.message);
                    return this._getLocalByPatientId(patientId);
                }
            } else {
                return this._getLocalByPatientId(patientId);
            }
        } catch (error) {
            console.error('PaymentRepository getByPatientId error:', error);
            throw error;
        }
    }

    _getLocalByPatientId(patientId) {
        const all = this._readLocal();
        return all
            .filter(p => String(p.patientId) === String(patientId))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async create(data) {
        const validated = PaymentSchema.parse(data);
        return super.create(validated);
    }
}

module.exports = PaymentRepository;
