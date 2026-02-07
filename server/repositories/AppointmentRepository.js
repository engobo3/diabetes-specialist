const BaseRepository = require('./BaseRepository');
const { AppointmentSchema } = require('../schemas/appointment.schema');

class AppointmentRepository extends BaseRepository {
    constructor() {
        super('appointments', 'appointments.json');
    }

    async findByDoctorId(doctorId) {
        if (!doctorId) return this.findAll();

        // Optimization for Firestore
        // Note: We need to access db here. BaseRepository doesn't expose it directly as property but imports it.
        // We can import it again or change BaseRepository to expose it. Importing is fine.
        const { db } = require('../config/firebaseConfig');

        try {
            if (db) {
                const snapshot = await db.collection(this.collectionName)
                    .where('doctorId', '==', parseInt(doctorId) || doctorId) // flexible check matching legacy
                    .get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else {
                const all = this._readLocal();
                return all.filter(a => String(a.doctorId) === String(doctorId));
            }
        } catch (e) {
            console.error(`AppointmentRepository findByDoctorId error:`, e);
            // Fallback to local
            const all = this._readLocal();
            return all.filter(a => String(a.doctorId) === String(doctorId));
        }
    }

    async create(data) {
        const validated = AppointmentSchema.parse(data);
        return super.create(validated);
    }

    async update(id, data) {
        const validated = AppointmentSchema.partial().parse(data);
        return super.update(id, validated);
    }
}

module.exports = AppointmentRepository;
