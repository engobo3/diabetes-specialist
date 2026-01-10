const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getConversation, sendMessage } = require('../controllers/messageController');

router.use(verifyToken);

router.get('/', getConversation);
router.post('/', sendMessage);

module.exports = router;
