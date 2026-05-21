const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { MessageIdParamSchema } = require('../schemas/common.schema');
const { MessageBodySchema } = require('../schemas/auth.schema');
const { getConversationMessages, sendMessage, markMessageAsRead } = require('../controllers/messageController');

router.use(verifyToken);

router.get('/', getConversationMessages);

router.post('/',
    validateBody(MessageBodySchema),
    sendMessage
);

router.put('/:messageId/read',
    validateParams(MessageIdParamSchema),
    markMessageAsRead
);

module.exports = router;
