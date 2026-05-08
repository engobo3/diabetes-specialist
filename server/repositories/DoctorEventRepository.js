const BaseRepository = require('./BaseRepository');
const { DoctorEventSchema } = require('../schemas/doctorEvent.schema');
const { db } = require('../config/firebaseConfig');

class DoctorEventRepository extends BaseRepository {
    constructor() {
        super('doctor_events', 'doctor_events.json');
    }

    async findByDoctorId(doctorId) {
        try {
            if (db) {
                try {
                    const numId = parseInt(doctorId);
                    const strId = String(doctorId);

                    let snapshot = await db.collection(this.collectionName)
                        .where('doctorId', '==', isNaN(numId) ? strId : numId)
                        .get();

                    if (snapshot.empty && !isNaN(numId)) {
                        snapshot = await db.collection(this.collectionName)
                            .where('doctorId', '==', strId)
                            .get();
                    }

                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fsError) {
                    console.error('Firestore Error in findByDoctorId (Fallback to Local):', fsError.message);
                    return this._getLocalByDoctorId(doctorId);
                }
            } else {
                return this._getLocalByDoctorId(doctorId);
            }
        } catch (error) {
            console.error('DoctorEventRepository findByDoctorId error:', error);
            throw error;
        }
    }

    async findByDoctorAndDate(doctorId, date) {
        const all = await this.findByDoctorId(doctorId);
        return all.filter(e => e.date === date);
    }

    _getLocalByDoctorId(doctorId) {
        const all = this._readLocal();
        return all.filter(e => String(e.doctorId) === String(doctorId));
    }

    async create(data) {
        const validated = DoctorEventSchema.parse(data);
        return super.create(validated);
    }

    async update(id, data) {
        const validated = DoctorEventSchema.partial().parse(data);
        return super.update(id, validated);
    }
}

module.exports = DoctorEventRepository;
