const BaseRepository = require('./BaseRepository');
const { NotificationSchema } = require('../schemas/notification.schema');
const { db } = require('../config/firebaseConfig');

class NotificationRepository extends BaseRepository {
    constructor() {
        super('notifications', 'notifications.json');
    }

    async findByUserId(userId, { limit = 30, unreadOnly = false } = {}) {
        try {
            if (db) {
                let query = db.collection(this.collectionName)
                    .where('userId', '==', userId);

                if (unreadOnly) {
                    query = query.where('read', '==', false);
                }

                query = query.orderBy('createdAt', 'desc').limit(limit);
                const snapshot = await query.get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else {
                const all = this._readLocal();
                let filtered = all.filter(n => n.userId === userId);
                if (unreadOnly) filtered = filtered.filter(n => !n.read);
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                return filtered.slice(0, limit);
            }
        } catch (error) {
            console.error('NotificationRepository findByUserId error:', error);
            throw error;
        }
    }

    async countUnread(userId) {
        try {
            if (db) {
                const snapshot = await db.collection(this.collectionName)
                    .where('userId', '==', userId)
                    .where('read', '==', false)
                    .count()
                    .get();
                return snapshot.data().count;
            } else {
                const all = this._readLocal();
                return all.filter(n => n.userId === userId && !n.read).length;
            }
        } catch (error) {
            console.error('NotificationRepository countUnread error:', error);
            throw error;
        }
    }

    async markAsRead(id) {
        return this.update(id, { read: true });
    }

    async markAllAsRead(userId) {
        try {
            if (db) {
                const snapshot = await db.collection(this.collectionName)
                    .where('userId', '==', userId)
                    .where('read', '==', false)
                    .get();

                if (snapshot.empty) return { updated: 0 };

                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.update(doc.ref, { read: true });
                });
                await batch.commit();
                return { updated: snapshot.size };
            } else {
                const all = this._readLocal();
                let count = 0;
                all.forEach(n => {
                    if (n.userId === userId && !n.read) {
                        n.read = true;
                        count++;
                    }
                });
                this._writeLocal(all);
                return { updated: count };
            }
        } catch (error) {
            console.error('NotificationRepository markAllAsRead error:', error);
            throw error;
        }
    }

    async createNotification(data) {
        const validated = NotificationSchema.parse({
            ...data,
            read: false,
            createdAt: new Date().toISOString()
        });
        return this.create(validated);
    }
}

module.exports = NotificationRepository;
