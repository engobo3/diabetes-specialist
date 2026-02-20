const NotificationRepository = require('../repositories/NotificationRepository');
const { db } = require('../config/firebaseConfig');

const notificationRepo = new NotificationRepository();

const getNotifications = async (req, res) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit) || 30;
        const notifications = await notificationRepo.findByUserId(userId, { limit });
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.uid;
        const count = await notificationRepo.countUnread(userId);
        res.json({ count });
    } catch (error) {
        console.error('Error counting unread notifications:', error);
        res.status(500).json({ message: 'Error counting notifications' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const result = await notificationRepo.markAsRead(req.params.id);
        if (!result) return res.status(404).json({ message: 'Notification not found' });
        res.json(result);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Error updating notification' });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.uid;
        const result = await notificationRepo.markAllAsRead(userId);
        res.json(result);
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ message: 'Error updating notifications' });
    }
};

const registerToken = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required' });

        if (!db) return res.status(503).json({ message: 'Database not available' });

        // Upsert: use token as document ID to avoid duplicates
        await db.collection('fcm_tokens').doc(token).set({
            token,
            userId,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error registering FCM token:', error);
        res.status(500).json({ message: 'Error registering token' });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    registerToken
};
