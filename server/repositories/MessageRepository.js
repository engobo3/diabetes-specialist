const BaseRepository = require('./BaseRepository');
const { MessageSchema } = require('../schemas/message.schema');
const { db } = require('../config/firebaseConfig');

class MessageRepository extends BaseRepository {
    constructor() {
        super('messages', 'messages.json');
    }

    /**
     * Get messages for a contact (all messages involving this contact)
     * Used for general contact view
     */
    async getMessagesForContact(contactId) {
        if (!contactId) return this.findAll();

        try {
            if (db) {
                try {
                    // Logic from old database.js: Check if contactId is a patient UID
                    let targetIds = [String(contactId)];
                    try {
                        const patientDoc = await db.collection('patients').doc(String(contactId)).get();
                        if (patientDoc.exists && patientDoc.data().uid) {
                            targetIds.push(patientDoc.data().uid);
                        }
                    } catch (e) { /* ignore lookup error */ }

                    const snapshot = await db.collection(this.collectionName).orderBy('timestamp', 'asc').get();
                    let messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    return messages.filter(m =>
                        targetIds.includes(String(m.senderId)) || targetIds.includes(String(m.receiverId))
                    );
                } catch (fsError) {
                    console.error('Firestore Error in getMessagesForContact (Fallback to Local):', fsError.message);
                    return this._getLocalMessagesForContact(contactId);
                }
            } else {
                return this._getLocalMessagesForContact(contactId);
            }
        } catch (error) {
            console.error('MessageRepository getMessagesForContact error:', error);
            throw error;
        }
    }

    /**
     * Get conversation between two specific participants
     * This ensures bidirectional filtering
     */
    async getConversation(userId, contactId) {
        if (!userId || !contactId) return [];

        const userIdStr = String(userId);
        const contactIdStr = String(contactId);

        try {
            if (db) {
                try {
                    // Get all messages from both directions
                    const snapshot = await db.collection(this.collectionName)
                        .orderBy('timestamp', 'asc')
                        .get();
                    
                    let messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Filter to only include messages between these two participants
                    return messages.filter(m => {
                        const senderId = String(m.senderId);
                        const receiverId = String(m.receiverId);
                        // Message is part of conversation if it's from either party to the other
                        return (senderId === userIdStr && receiverId === contactIdStr) ||
                               (senderId === contactIdStr && receiverId === userIdStr);
                    });
                } catch (fsError) {
                    console.error('Firestore Error in getConversation (Fallback to Local):', fsError.message);
                    return this._getLocalConversation(userIdStr, contactIdStr);
                }
            } else {
                return this._getLocalConversation(userIdStr, contactIdStr);
            }
        } catch (error) {
            console.error('MessageRepository getConversation error:', error);
            throw error;
        }
    }

    _getLocalMessagesForContact(contactId) {
        const messages = this._readLocal();
        return messages.filter(m =>
            String(m.senderId) === String(contactId) || String(m.receiverId) === String(contactId)
        );
    }

    _getLocalConversation(userId, contactId) {
        const messages = this._readLocal();
        return messages.filter(m => {
            const senderId = String(m.senderId);
            const receiverId = String(m.receiverId);
            return (senderId === userId && receiverId === contactId) ||
                   (senderId === contactId && receiverId === userId);
        });
    }

    async create(data) {
        const validated = MessageSchema.parse(data);
        return super.create(validated);
    }
}

module.exports = MessageRepository;
