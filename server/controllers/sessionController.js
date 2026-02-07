/**
 * Session Controller
 * Handles session creation, validation, and management
 */

const sessionService = require('../services/sessionService');
const auditLogger = require('../services/auditLogger');

/**
 * Create a new session (called after successful login)
 * POST /api/sessions/create
 */
exports.createSession = async (req, res) => {
    try {
        const { uid, email, role } = req.user; // From verifyToken middleware

        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        const session = await sessionService.createSession(uid, role, ipAddress, userAgent);

        res.status(201).json({
            success: true,
            message: 'Session created successfully',
            data: {
                sessionId: session.sessionId,
                expiresAt: session.expiresAt
            }
        });
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create session',
            message: error.message
        });
    }
};

/**
 * Validate current session
 * GET /api/sessions/validate
 */
exports.validateSession = async (req, res) => {
    try {
        const { uid } = req.user;
        const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'No session ID provided'
            });
        }

        const validation = await sessionService.validateSession(sessionId, uid);

        if (!validation.valid) {
            return res.status(401).json({
                success: false,
                valid: false,
                reason: validation.reason,
                requiresLogin: true
            });
        }

        res.status(200).json({
            success: true,
            valid: true,
            sessionData: {
                createdAt: validation.sessionData.createdAt,
                lastActivity: validation.sessionData.lastActivity,
                expiresAt: validation.sessionData.expiresAt
            }
        });
    } catch (error) {
        console.error('Validate session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate session',
            message: error.message
        });
    }
};

/**
 * Refresh session (update activity timestamp)
 * POST /api/sessions/refresh
 */
exports.refreshSession = async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'No session ID provided'
            });
        }

        const success = await sessionService.updateActivity(sessionId);

        if (!success) {
            return res.status(401).json({
                success: false,
                error: 'Session expired or invalid',
                requiresLogin: true
            });
        }

        res.status(200).json({
            success: true,
            message: 'Session refreshed successfully'
        });
    } catch (error) {
        console.error('Refresh session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh session',
            message: error.message
        });
    }
};

/**
 * Logout (invalidate current session)
 * POST /api/sessions/logout
 */
exports.logout = async (req, res) => {
    try {
        const { uid, email, role } = req.user;
        const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'No session ID provided'
            });
        }

        const success = await sessionService.invalidateSession(sessionId, 'logout');

        await auditLogger.logSecurity({
            userId: email,
            userRole: role,
            eventType: 'user_logout',
            description: 'User logged out',
            severity: 'info',
            metadata: { sessionId }
        });

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout',
            message: error.message
        });
    }
};

/**
 * Logout from all devices (invalidate all sessions)
 * POST /api/sessions/logout-all
 */
exports.logoutAll = async (req, res) => {
    try {
        const { uid, email, role } = req.user;

        const count = await sessionService.invalidateAllUserSessions(uid, 'logout_all');

        await auditLogger.logSecurity({
            userId: email,
            userRole: role,
            eventType: 'logout_all_devices',
            description: `User logged out from all devices (${count} sessions)`,
            severity: 'warning',
            metadata: { sessionCount: count }
        });

        res.status(200).json({
            success: true,
            message: `Logged out from ${count} device(s) successfully`,
            sessionsInvalidated: count
        });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout from all devices',
            message: error.message
        });
    }
};

/**
 * Get all active sessions for current user
 * GET /api/sessions/list
 */
exports.listSessions = async (req, res) => {
    try {
        const { uid } = req.user;

        const sessions = await sessionService.getUserSessions(uid);

        res.status(200).json({
            success: true,
            data: {
                sessions,
                count: sessions.length
            }
        });
    } catch (error) {
        console.error('List sessions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list sessions',
            message: error.message
        });
    }
};

/**
 * Invalidate a specific session
 * DELETE /api/sessions/:sessionId
 */
exports.invalidateSession = async (req, res) => {
    try {
        const { uid, email, role } = req.user;
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }

        // Verify session belongs to user
        const validation = await sessionService.validateSession(sessionId, uid);

        if (!validation.valid && validation.reason !== 'session_inactive') {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to invalidate this session'
            });
        }

        const success = await sessionService.invalidateSession(sessionId, 'manual_invalidation');

        await auditLogger.logSecurity({
            userId: email,
            userRole: role,
            eventType: 'session_manually_invalidated',
            description: 'User manually invalidated a session',
            severity: 'info',
            metadata: { sessionId }
        });

        res.status(200).json({
            success: true,
            message: 'Session invalidated successfully'
        });
    } catch (error) {
        console.error('Invalidate session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to invalidate session',
            message: error.message
        });
    }
};

/**
 * Get session configuration
 * GET /api/sessions/config
 */
exports.getConfig = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                idleTimeout: sessionService.config.idleTimeout,
                absoluteTimeout: sessionService.config.absoluteTimeout,
                maxConcurrentSessions: sessionService.config.maxConcurrentSessions,
                tokenRotationInterval: sessionService.config.tokenRotationInterval
            }
        });
    } catch (error) {
        console.error('Get config error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get configuration',
            message: error.message
        });
    }
};
