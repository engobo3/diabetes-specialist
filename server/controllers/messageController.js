const { getMessages, getConversation, saveMessage } = require('../services/database');

/**
 * Get all messages for a contact
 * Query: ?contactId=<id>
 */
const getConversationMessages = async (req, res) => {
    try {
        const { contactId } = req.query;
        
        if (!contactId) {
            return res.status(400).json({ 
                error: 'Missing contactId parameter',
                message: 'contactId is required to fetch messages' 
            });
        }

        // Get current user from authenticated request
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: 'User authentication required' 
            });
        }

        // Use new conversation method for proper bidirectional filtering
        const messages = await getConversation(userId, contactId);
        
        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ 
            error: 'Failed to fetch messages',
            message: error.message 
        });
    }
};

/**
 * Send a message from one user to another
 * Body: { senderId, receiverId, text, senderName }
 */
const sendMessage = async (req, res) => {
    try {
        const { senderId, receiverId, text, senderName } = req.body;

        // Validate required fields
        if (!senderId) {
            return res.status(400).json({ 
                error: 'Missing senderId',
                message: 'senderId is required' 
            });
        }
        if (!receiverId) {
            return res.status(400).json({ 
                error: 'Missing receiverId',
                message: 'receiverId is required' 
            });
        }
        if (!text || text.trim() === '') {
            return res.status(400).json({ 
                error: 'Missing message text',
                message: 'Message content cannot be empty' 
            });
        }

        // Prevent self-messages
        if (String(senderId) === String(receiverId)) {
            return res.status(400).json({ 
                error: 'Invalid message',
                message: 'Cannot send message to yourself' 
            });
        }

        const newMessage = await saveMessage({
            senderId,
            receiverId,
            text: text.trim(),
            senderName: senderName || 'Anonymous',
            timestamp: new Date().toISOString(),
            read: false
        });

        res.status(201).json({
            success: true,
            data: newMessage
        });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ 
            error: 'Failed to send message',
            message: error.message 
        });
    }
};

/**
 * Mark a message as read
 * PUT /:messageId/read
 */
const markMessageAsRead = async (req, res) => {
    try {
        const { messageId } = req.params;
        
        if (!messageId) {
            return res.status(400).json({ 
                error: 'Missing messageId',
                message: 'messageId is required' 
            });
        }

        // This would need to be implemented in the repo/db service
        // For now, just acknowledge
        res.status(200).json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        console.error("Error marking message as read:", error);
        res.status(500).json({ 
            error: 'Failed to mark message as read',
            message: error.message 
        });
    }
};

module.exports = {
    getConversationMessages,
    sendMessage,
    markMessageAsRead
};
