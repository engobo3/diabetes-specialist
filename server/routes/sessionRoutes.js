/**
 * Session Management Routes
 */

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const verifyToken = require('../middleware/authMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const { SessionIdParamSchema } = require('../schemas/common.schema');
const { SessionCreateSchema } = require('../schemas/auth.schema');

// All session routes are scoped to req.user.uid — controllers must derive userId
// from the token, never from the body.
router.use(verifyToken);

router.post('/create',
    validateBody(SessionCreateSchema),
    sessionController.createSession
);

router.get('/validate', sessionController.validateSession);
router.post('/refresh', sessionController.refreshSession);
router.post('/logout', sessionController.logout);
router.post('/logout-all', sessionController.logoutAll);
router.get('/list', sessionController.listSessions);

router.delete('/:sessionId',
    validateParams(SessionIdParamSchema),
    sessionController.invalidateSession
);

router.get('/config', sessionController.getConfig);

module.exports = router;
