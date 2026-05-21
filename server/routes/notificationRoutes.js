const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { IdParamSchema } = require('../schemas/common.schema');
const { RegisterFcmTokenSchema } = require('../schemas/auth.schema');
const {
    getNotifications, getUnreadCount, markAsRead, markAllAsRead, registerToken
} = require('../controllers/notificationController');

// All notification routes are scoped to req.user.uid — controllers must not accept
// userId from the body/query. Any authenticated role can use them.
router.use(verifyToken);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read',
    validateParams(IdParamSchema),
    markAsRead
);
router.post('/register-token',
    validateBody(RegisterFcmTokenSchema),
    registerToken
);

module.exports = router;
