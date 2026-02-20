const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getNotifications, getUnreadCount, markAsRead, markAllAsRead, registerToken } = require('../controllers/notificationController');

// All notification routes require authentication
router.use(verifyToken);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.post('/register-token', registerToken);

module.exports = router;
