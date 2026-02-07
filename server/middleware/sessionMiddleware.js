/**
 * Session Middleware
 * Validates session state and enforces timeout policies
 * Works alongside Firebase Auth token verification
 */

const sessionService = require('../services/sessionService');
const auditLogger = require('../services/auditLogger');

/**
 * Validate session and check for timeout
 * Should be applied after verifyToken middleware
 */
const validateSession = async (req, res, next) => {
    try {
        // Get session ID from header or cookie
        const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

        if (!sessionId) {
            return res.status(401).json({
                success: false,
                error: 'No session found',
                requiresLogin: true
            });
        }

        const { uid } = req.user; // Set by verifyToken middleware

        // Validate session
        const validation = await sessionService.validateSession(sessionId, uid);

        if (!validation.valid) {
            const reason = validation.reason;

            // Log timeout events
            if (reason === 'idle_timeout' || reason === 'absolute_timeout') {
                await auditLogger.logSecurity({
                    userId: uid,
                    userRole: req.user.role || 'unknown',
                    eventType: 'session_timeout',
                    description: `Session timed out: ${reason}`,
                    severity: 'info',
                    metadata: { sessionId, reason }
                });
            }

            return res.status(401).json({
                success: false,
                error: 'Session expired or invalid',
                reason,
                requiresLogin: true
            });
        }

        // Attach session data to request
        req.session = validation.sessionData;
        req.sessionId = sessionId;

        next();
    } catch (error) {
        console.error('Session validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate session',
            message: error.message
        });
    }
};

/**
 * Check if token needs rotation and notify client
 * Non-blocking - just adds header for client to act on
 */
const checkTokenRotation = async (req, res, next) => {
    try {
        const sessionId = req.sessionId || req.headers['x-session-id'];

        if (sessionId) {
            const shouldRotate = await sessionService.shouldRotateToken(sessionId);

            if (shouldRotate) {
                // Add header to inform client to refresh token
                res.setHeader('X-Token-Rotation-Required', 'true');
            }
        }

        next();
    } catch (error) {
        console.error('Token rotation check error:', error);
        // Don't block request on rotation check failure
        next();
    }
};

/**
 * Optional session validation (doesn't fail if no session)
 * Useful for endpoints that work with or without authentication
 */
const optionalSession = async (req, res, next) => {
    try {
        const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

        if (sessionId && req.user) {
            const validation = await sessionService.validateSession(sessionId, req.user.uid);

            if (validation.valid) {
                req.session = validation.sessionData;
                req.sessionId = sessionId;
            }
        }

        next();
    } catch (error) {
        console.error('Optional session validation error:', error);
        // Don't block request on optional session failure
        next();
    }
};

module.exports = {
    validateSession,
    checkTokenRotation,
    optionalSession
};
