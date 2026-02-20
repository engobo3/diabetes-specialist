const NotificationRepository = require('../repositories/NotificationRepository');
const { sendPushToUser } = require('./pushNotificationService');

const notificationRepo = new NotificationRepository();

/**
 * Create an in-app notification AND send a push notification for a user.
 * @param {Object} params
 * @param {string} params.userId - Firebase UID of the recipient
 * @param {string} params.type - Notification type enum
 * @param {string} params.title - Short title
 * @param {string} params.body - Notification body text
 * @param {Object} [params.data] - Optional metadata (appointmentId, patientId, etc.)
 */
const createNotification = async ({ userId, type, title, body, data }) => {
    try {
        // Create in-app notification
        const result = await notificationRepo.createNotification({ userId, type, title, body, data });

        // Also send push notification (fire-and-forget)
        sendPushToUser(userId, { title, body, data: data || {} }).catch(() => {});

        return result;
    } catch (error) {
        // Log but don't throw — notifications are non-critical and should not block main flows
        console.error('notificationService.createNotification error:', error);
        return null;
    }
};

module.exports = { createNotification };
