const BaseRepository = require('./BaseRepository');
const { VitalSchema } = require('../schemas/vital.schema');
const { db } = require('../config/firebaseConfig');

class VitalRepository extends BaseRepository {
    constructor() {
        super('vitals', 'vitals.json'); // 'vitals' collection name unused for Firestore if using subcollection
    }

    async getByPatientId(patientId) {
        try {
            if (db) {
                try {
                    const snapshot = await db.collection('patients')
                        .doc(String(patientId))
                        .collection('vitals')
                        .orderBy('date', 'desc')
                        .get();

                    const readings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    return { patientId: parseInt(patientId), readings };
                } catch (fsError) {
                    console.error('Firestore Error in getByPatientId (Fallback to Local):', fsError.message);
                    return this._getLocalByPatientId(patientId);
                }
            } else {
                return this._getLocalByPatientId(patientId);
            }
        } catch (error) {
            console.error('VitalRepository getByPatientId error:', error);
            throw error;
        }
    }

    async add(patientId, data) {
        // Validate payload. date should be present.
        const validated = VitalSchema.partial({ patientId: true }).parse(data);
        // We allow patientId to be missing in payload if passed as arg, but schema might require it?
        // Our schema says patientId optional.

        try {
            if (db) {
                try {
                    const docRef = await db.collection('patients')
                        .doc(String(patientId))
                        .collection('vitals')
                        .add(validated);

                    return { ...validated, id: docRef.id };
                } catch (fsError) {
                    console.error('Firestore Error in add (Fallback to Local):', fsError.message);
                    return this._addLocal(patientId, validated);
                }
            } else {
                return this._addLocal(patientId, validated);
            }
        } catch (error) {
            console.error('VitalRepository add error:', error);
            throw error;
        }
    }

    async delete(patientId, vitalId) {
        try {
            if (db) {
                try {
                    const docRef = db.collection('patients')
                        .doc(String(patientId))
                        .collection('vitals')
                        .doc(String(vitalId));

                    const doc = await docRef.get();
                    if (!doc.exists) {
                        return null;
                    }

                    await docRef.delete();
                    return { id: vitalId, deleted: true };
                } catch (fsError) {
                    console.error('Firestore Error in delete (Fallback to Local):', fsError.message);
                    return this._deleteLocal(patientId, vitalId);
                }
            } else {
                return this._deleteLocal(patientId, vitalId);
            }
        } catch (error) {
            console.error('VitalRepository delete error:', error);
            throw error;
        }
    }

    _getLocalByPatientId(patientId) {
        const allVitals = this._readLocal();
        const patientVitals = allVitals.find(v => v.patientId === parseInt(patientId));
        if (!patientVitals) {
            return { patientId: parseInt(patientId), readings: [] };
        }
        return patientVitals;
    }

    _addLocal(patientId, vitalData) {
        let allVitals = this._readLocal();

        // Find existing record for patient
        let patientVitals = allVitals.find(v => v.patientId === parseInt(patientId));
        if (!patientVitals) {
            patientVitals = { patientId: parseInt(patientId), readings: [] };
            allVitals.push(patientVitals);
        }

        // Add reading
        patientVitals.readings.push(vitalData);
        // Sort DESC
        patientVitals.readings.sort((a, b) => new Date(b.date) - new Date(a.date));

        this._writeLocal(allVitals);
        return vitalData;
    }
    _deleteLocal(patientId, vitalId) {
        let allVitals = this._readLocal();
        const patientVitals = allVitals.find(v => v.patientId === parseInt(patientId));
        if (!patientVitals) return null;

        const index = patientVitals.readings.findIndex((r, i) => (r.id || String(i)) === String(vitalId));
        if (index === -1) return null;

        patientVitals.readings.splice(index, 1);
        this._writeLocal(allVitals);
        return { id: vitalId, deleted: true };
    }
}

module.exports = VitalRepository;
