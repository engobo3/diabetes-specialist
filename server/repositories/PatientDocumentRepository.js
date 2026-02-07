const BaseRepository = require('./BaseRepository');
const { db } = require('../config/firebaseConfig');
const { z } = require('zod');

// Schema is flexible for now as it wasn't strictly defined
const DocumentSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    date: z.string(), // ISO
    type: z.string().optional(),
    url: z.string().optional(),
    // Add other fields as needed
});

class PatientDocumentRepository extends BaseRepository {
    constructor() {
        // Local strategy for simple documents was just `patient.documents` array in `patients.json`?
        // Creating a new 'documents.json' or stick to embedding?
        // `database.js` says: `getPatientDocuments` reads `patients.json` -> find patient -> return p.documents || []
        // So it is EMBEDDED in local mode.
        // But assumed subcollection in Firestore.
        super('dummy', 'patients.json');
    }

    async getByPatientId(patientId) {
        try {
            if (db) {
                try {
                    const snapshot = await db.collection('patients')
                        .doc(String(patientId))
                        .collection('documents')
                        .orderBy('date', 'desc')
                        .get();
                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fsError) {
                    console.error('Firestore Error in getByPatientId (Fallback to Local):', fsError.message);
                    return this._getLocalEmbedded(patientId);
                }
            } else {
                return this._getLocalEmbedded(patientId);
            }
        } catch (error) {
            console.error('PatientDocumentRepository getByPatientId error:', error);
            return [];
        }
    }

    async add(patientId, data) {
        const validated = DocumentSchema.parse(data);
        try {
            if (db) {
                try {
                    const docRef = await db.collection('patients')
                        .doc(String(patientId))
                        .collection('documents')
                        .add(validated);
                    return { id: docRef.id, ...validated };
                } catch (fsError) {
                    console.error('Firestore Error in add (Fallback to Local):', fsError.message);
                    return this._addLocalEmbedded(patientId, validated);
                }
            } else {
                return this._addLocalEmbedded(patientId, validated);
            }
        } catch (error) {
            console.error('PatientDocumentRepository add error:', error);
            throw error;
        }
    }

    _getLocalEmbedded(patientId) {
        const patients = this._readLocal();
        const p = patients.find(p => String(p.id) === String(patientId));
        return p?.documents || [];
    }

    _addLocalEmbedded(patientId, docData) {
        let patients = this._readLocal();
        const index = patients.findIndex(p => String(p.id) === String(patientId));

        if (index === -1) throw new Error("Patient not found locally");

        if (!patients[index].documents) {
            patients[index].documents = [];
        }

        // Generate pseudo ID
        const newId = Date.now().toString();
        const newDoc = { ...docData, id: newId };

        patients[index].documents.push(newDoc);
        this._writeLocal(patients); // BaseRepository handles writing to 'patients.json'

        return newDoc;
    }
}

module.exports = PatientDocumentRepository;
