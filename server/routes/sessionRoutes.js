/**
 * Session Management Routes
 */

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const verifyToken = require('../middleware/authMiddleware');

/**
 * @route   POST /api/sessions/create
 * @desc    Create a new session after login
 * @access  Private (requires Firebase auth token)
 */
router.post('/create', verifyToken, sessionController.createSession);

/**
 * @route   GET /api/sessions/validate
 * @desc    Validate current session
 * @access  Private
 */
router.get('/validate', verifyToken, sessionController.validateSession);

/**
 * @route   POST /api/sessions/refresh
 * @desc    Refresh session (update activity timestamp)
 * @access  Private
 */
router.post('/refresh', verifyToken, sessionController.refreshSession);

/**
 * @route   POST /api/sessions/logout
 * @desc    Logout from current session
 * @access  Private
 */
router.post('/logout', verifyToken, sessionController.logout);

/**
 * @route   POST /api/sessions/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', verifyToken, sessionController.logoutAll);

/**
 * @route   GET /api/sessions/list
 * @desc    Get all active sessions for current user
 * @access  Private
 */
router.get('/list', verifyToken, sessionController.listSessions);

/**
 * @route   DELETE /api/sessions/:sessionId
 * @desc    Invalidate a specific session
 * @access  Private
 */
router.delete('/:sessionId', verifyToken, sessionController.invalidateSession);

/**
 * @route   GET /api/sessions/config
 * @desc    Get session configuration (timeouts, limits)
 * @access  Private
 */
router.get('/config', verifyToken, sessionController.getConfig);

module.exports = router;
