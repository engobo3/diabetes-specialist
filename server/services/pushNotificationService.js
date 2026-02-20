const admin = require('firebase-admin');
const { db } = require('../config/firebaseConfig');

/**
 * Send a push notification to all devices registered by a user.
 * @param {string} userId - Firebase Auth UID
 * @param {Object} message - { title, body, data }
 */
const sendPushToUser = async (userId, { title, body, data = {} }) => {
    try {
        if (!db) return;

        // Get all FCM tokens for this user
        const snapshot = await db.collection('fcm_tokens')
            .where('userId', '==', userId)
            .get();

        if (snapshot.empty) return;

        const tokens = snapshot.docs.map(doc => doc.data().token);
        if (tokens.length === 0) return;

        const message = {
            notification: { title, body },
            data: Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
            tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Clean up invalid tokens
        if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    if (errorCode === 'messaging/invalid-registration-token' ||
                        errorCode === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });

            // Delete invalid tokens
            if (invalidTokens.length > 0) {
                const batch = db.batch();
                const tokenDocs = await db.collection('fcm_tokens')
                    .where('token', 'in', invalidTokens)
                    .get();
                tokenDocs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`Cleaned up ${invalidTokens.length} invalid FCM tokens`);
            }
        }

        return response;
    } catch (error) {
        console.error('pushNotificationService.sendPushToUser error:', error.message);
        return null;
    }
};

module.exports = { sendPushToUser };
