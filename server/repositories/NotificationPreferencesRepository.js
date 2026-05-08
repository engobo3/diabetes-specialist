const BaseRepository = require('./BaseRepository');
const { NotificationPreferencesSchema } = require('../schemas/notificationPreferences.schema');
const { db } = require('../config/firebaseConfig');

class NotificationPreferencesRepository extends BaseRepository {
    constructor() {
        super('notification_preferences', 'notification_preferences.json');
    }

    _defaults(patientId) {
        return {
            patientId: String(patientId),
            vitalReminderEnabled: true,
            morningReminderTime: '07:00',
            eveningReminderEnabled: false,
            eveningReminderTime: '19:00',
            medicationReminderEnabled: true,
            escalationEnabled: true,
            escalationDays: 3,
        };
    }

    async findByPatientId(patientId) {
        try {
            if (db) {
                try {
                    const doc = await db.collection(this.collectionName)
                        .doc(String(patientId)).get();
                    if (!doc.exists) return this._defaults(patientId);
                    return { id: doc.id, ...doc.data() };
                } catch (fsError) {
                    console.error('Firestore Error in findByPatientId [notification_preferences]:', fsError.message);
                    const all = this._readLocal();
                    return all.find(p => String(p.patientId) === String(patientId))
                        || this._defaults(patientId);
                }
            } else {
                const all = this._readLocal();
                return all.find(p => String(p.patientId) === String(patientId))
                    || this._defaults(patientId);
            }
        } catch (error) {
            console.error('NotificationPreferencesRepository findByPatientId error:', error);
            return this._defaults(patientId);
        }
    }

    async upsert(patientId, data) {
        const validated = NotificationPreferencesSchema.parse({
            ...data,
            patientId: String(patientId),
            updatedAt: new Date().toISOString()
        });

        try {
            if (db) {
                try {
                    await db.collection(this.collectionName)
                        .doc(String(patientId)).set(validated, { merge: true });
                    return { id: String(patientId), ...validated };
                } catch (fsError) {
                    console.error('Firestore Error in upsert [notification_preferences]:', fsError.message);
                    return this._upsertLocal(patientId, validated);
                }
            } else {
                return this._upsertLocal(patientId, validated);
            }
        } catch (error) {
            console.error('NotificationPreferencesRepository upsert error:', error);
            throw error;
        }
    }

    _upsertLocal(patientId, data) {
        const items = this._readLocal();
        const index = items.findIndex(p => String(p.patientId) === String(patientId));
        if (index >= 0) {
            items[index] = { ...items[index], ...data };
            this._writeLocal(items);
            return items[index];
        } else {
            const newItem = { id: String(patientId), ...data };
            items.push(newItem);
            this._writeLocal(items);
            return newItem;
        }
    }

    async findAllWithEveningEnabled() {
        try {
            if (db) {
                try {
                    const snap = await db.collection(this.collectionName)
                        .where('eveningReminderEnabled', '==', true).get();
                    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fsError) {
                    console.error('Firestore Error in findAllWithEveningEnabled:', fsError.message);
                    return this._readLocal().filter(p => p.eveningReminderEnabled);
                }
            } else {
                return this._readLocal().filter(p => p.eveningReminderEnabled);
            }
        } catch (error) {
            console.error('NotificationPreferencesRepository findAllWithEveningEnabled error:', error);
            return [];
        }
    }
}

module.exports = NotificationPreferencesRepository;
