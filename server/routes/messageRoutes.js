const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getConversationMessages, sendMessage, markMessageAsRead } = require('../controllers/messageController');

// Apply authentication to all routes
router.use(verifyToken);

// Get messages in a conversation
router.get('/', getConversationMessages);

// Send a new message
router.post('/', sendMessage);

// Mark message as read (optional enhancement)
router.put('/:messageId/read', markMessageAsRead);

module.exports = router;
