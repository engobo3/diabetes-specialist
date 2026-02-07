/**
 * Session Management Service
 * Handles session timeout, token rotation, and concurrent session management
 * Enhances security by limiting session lifetime and preventing token reuse
 */

const { db } = require('../config/firebaseConfig');
const auditLogger = require('./auditLogger');

class SessionService {
    constructor() {
        this.collectionName = 'user_sessions';

        // Configuration (in milliseconds)
        this.config = {
            idleTimeout: 30 * 60 * 1000,        // 30 minutes of inactivity
            absoluteTimeout: 12 * 60 * 60 * 1000, // 12 hours maximum session
            maxConcurrentSessions: 3,            // Max 3 devices per user
            tokenRotationInterval: 15 * 60 * 1000 // Rotate token every 15 minutes
        };
    }

    /**
     * Create a new session
     * @param {string} userId - User ID
     * @param {string} userRole - User role
     * @param {string} ipAddress - IP address
     * @param {string} userAgent - User agent string
     * @returns {Promise<Object>} Session data
     */
    async createSession(userId, userRole, ipAddress, userAgent) {
        try {
            const now = Date.now();
            const sessionData = {
                userId,
                userRole,
                ipAddress,
                userAgent,
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                expiresAt: new Date(now + this.config.absoluteTimeout).toISOString(),
                isActive: true,
                deviceInfo: this._parseUserAgent(userAgent)
            };

            // Check for existing sessions and enforce limit
            await this._enforceSessionLimit(userId);

            // Create session in Firestore
            const sessionRef = await db.collection(this.collectionName).add(sessionData);

            await auditLogger.logSecurity({
                userId,
                userRole,
                eventType: 'session_created',
                description: 'New session created',
                severity: 'info',
                metadata: {
                    sessionId: sessionRef.id,
                    ipAddress,
                    deviceInfo: sessionData.deviceInfo
                }
            });

            return {
                sessionId: sessionRef.id,
                ...sessionData
            };
        } catch (error) {
            console.error('Error creating session:', error);
            throw new Error('Failed to create session');
        }
    }

    /**
     * Update session activity (touch session)
     * @param {string} sessionId - Session ID
     * @returns {Promise<boolean>} Success status
     */
    async updateActivity(sessionId) {
        try {
            const sessionRef = db.collection(this.collectionName).doc(sessionId);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
                return false;
            }

            const sessionData = sessionDoc.data();

            // Check if session has expired
            const now = Date.now();
            const absoluteExpiry = new Date(sessionData.expiresAt).getTime();
            const lastActivity = new Date(sessionData.lastActivity).getTime();
            const idleExpiry = lastActivity + this.config.idleTimeout;

            if (now > absoluteExpiry || now > idleExpiry) {
                await this.invalidateSession(sessionId, 'timeout');
                return false;
            }

            // Update last activity
            await sessionRef.update({
                lastActivity: new Date().toISOString()
            });

            return true;
        } catch (error) {
            console.error('Error updating session activity:', error);
            return false;
        }
    }

    /**
     * Validate session
     * @param {string} sessionId - Session ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Validation result
     */
    async validateSession(sessionId, userId) {
        try {
            if (!sessionId) {
                return {
                    valid: false,
                    reason: 'no_session_id'
                };
            }

            const sessionRef = db.collection(this.collectionName).doc(sessionId);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
                return {
                    valid: false,
                    reason: 'session_not_found'
                };
            }

            const sessionData = sessionDoc.data();

            // Check user ID match
            if (sessionData.userId !== userId) {
                await auditLogger.logSecurity({
                    userId,
                    userRole: sessionData.userRole,
                    eventType: 'session_mismatch',
                    description: 'Session user ID mismatch',
                    severity: 'warning',
                    metadata: { sessionId, expectedUserId: userId, actualUserId: sessionData.userId }
                });

                return {
                    valid: false,
                    reason: 'user_mismatch'
                };
            }

            // Check if session is active
            if (!sessionData.isActive) {
                return {
                    valid: false,
                    reason: 'session_inactive'
                };
            }

            // Check absolute timeout
            const now = Date.now();
            const absoluteExpiry = new Date(sessionData.expiresAt).getTime();

            if (now > absoluteExpiry) {
                await this.invalidateSession(sessionId, 'absolute_timeout');
                return {
                    valid: false,
                    reason: 'absolute_timeout'
                };
            }

            // Check idle timeout
            const lastActivity = new Date(sessionData.lastActivity).getTime();
            const idleExpiry = lastActivity + this.config.idleTimeout;

            if (now > idleExpiry) {
                await this.invalidateSession(sessionId, 'idle_timeout');
                return {
                    valid: false,
                    reason: 'idle_timeout'
                };
            }

            // Session is valid - update activity
            await this.updateActivity(sessionId);

            return {
                valid: true,
                sessionData
            };
        } catch (error) {
            console.error('Error validating session:', error);
            return {
                valid: false,
                reason: 'validation_error',
                error: error.message
            };
        }
    }

    /**
     * Invalidate a session
     * @param {string} sessionId - Session ID
     * @param {string} reason - Reason for invalidation
     * @returns {Promise<boolean>} Success status
     */
    async invalidateSession(sessionId, reason = 'manual') {
        try {
            const sessionRef = db.collection(this.collectionName).doc(sessionId);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
                return false;
            }

            const sessionData = sessionDoc.data();

            await sessionRef.update({
                isActive: false,
                invalidatedAt: new Date().toISOString(),
                invalidationReason: reason
            });

            await auditLogger.logSecurity({
                userId: sessionData.userId,
                userRole: sessionData.userRole,
                eventType: 'session_invalidated',
                description: `Session invalidated: ${reason}`,
                severity: reason.includes('timeout') ? 'info' : 'warning',
                metadata: { sessionId, reason }
            });

            return true;
        } catch (error) {
            console.error('Error invalidating session:', error);
            return false;
        }
    }

    /**
     * Invalidate all sessions for a user
     * @param {string} userId - User ID
     * @param {string} reason - Reason for invalidation
     * @returns {Promise<number>} Number of sessions invalidated
     */
    async invalidateAllUserSessions(userId, reason = 'logout_all') {
        try {
            const sessionsSnapshot = await db.collection(this.collectionName)
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .get();

            let count = 0;

            for (const doc of sessionsSnapshot.docs) {
                await this.invalidateSession(doc.id, reason);
                count++;
            }

            return count;
        } catch (error) {
            console.error('Error invalidating all user sessions:', error);
            return 0;
        }
    }

    /**
     * Get active sessions for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} List of active sessions
     */
    async getUserSessions(userId) {
        try {
            const sessionsSnapshot = await db.collection(this.collectionName)
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .get();

            const sessions = [];

            for (const doc of sessionsSnapshot.docs) {
                const data = doc.data();
                sessions.push({
                    sessionId: doc.id,
                    createdAt: data.createdAt,
                    lastActivity: data.lastActivity,
                    ipAddress: data.ipAddress,
                    deviceInfo: data.deviceInfo
                });
            }

            return sessions;
        } catch (error) {
            console.error('Error getting user sessions:', error);
            return [];
        }
    }

    /**
     * Enforce maximum concurrent sessions
     * @param {string} userId - User ID
     * @private
     */
    async _enforceSessionLimit(userId) {
        try {
            const sessionsSnapshot = await db.collection(this.collectionName)
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .orderBy('createdAt', 'asc')
                .get();

            const activeSessions = sessionsSnapshot.docs;

            // If at or over limit, invalidate oldest sessions
            if (activeSessions.length >= this.config.maxConcurrentSessions) {
                const toInvalidate = activeSessions.length - this.config.maxConcurrentSessions + 1;

                for (let i = 0; i < toInvalidate; i++) {
                    await this.invalidateSession(
                        activeSessions[i].id,
                        'concurrent_session_limit'
                    );
                }
            }
        } catch (error) {
            console.error('Error enforcing session limit:', error);
        }
    }

    /**
     * Parse user agent string to extract device info
     * @param {string} userAgent - User agent string
     * @returns {Object} Parsed device info
     * @private
     */
    _parseUserAgent(userAgent) {
        if (!userAgent) {
            return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
        }

        // Simple parsing - in production, use a library like 'ua-parser-js'
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
        const isTablet = /iPad|Tablet/i.test(userAgent);
        const isWindows = /Windows/i.test(userAgent);
        const isMac = /Mac OS/i.test(userAgent);
        const isLinux = /Linux/i.test(userAgent);
        const isChrome = /Chrome/i.test(userAgent);
        const isFirefox = /Firefox/i.test(userAgent);
        const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
        const isEdge = /Edg/i.test(userAgent);

        return {
            browser: isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : isEdge ? 'Edge' : 'Unknown',
            os: isWindows ? 'Windows' : isMac ? 'macOS' : isLinux ? 'Linux' : 'Unknown',
            device: isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop'
        };
    }

    /**
     * Clean up expired sessions (run as cron job)
     * @returns {Promise<number>} Number of sessions cleaned
     */
    async cleanupExpiredSessions() {
        try {
            const now = new Date();
            const sessionsSnapshot = await db.collection(this.collectionName)
                .where('isActive', '==', true)
                .get();

            let count = 0;

            for (const doc of sessionsSnapshot.docs) {
                const data = doc.data();
                const absoluteExpiry = new Date(data.expiresAt);
                const lastActivity = new Date(data.lastActivity);
                const idleExpiry = new Date(lastActivity.getTime() + this.config.idleTimeout);

                if (now > absoluteExpiry || now > idleExpiry) {
                    await this.invalidateSession(
                        doc.id,
                        now > absoluteExpiry ? 'absolute_timeout' : 'idle_timeout'
                    );
                    count++;
                }
            }

            return count;
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            return 0;
        }
    }

    /**
     * Check if token needs rotation
     * @param {string} sessionId - Session ID
     * @returns {Promise<boolean>} Whether token should be rotated
     */
    async shouldRotateToken(sessionId) {
        try {
            const sessionRef = db.collection(this.collectionName).doc(sessionId);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
                return false;
            }

            const sessionData = sessionDoc.data();
            const lastActivity = new Date(sessionData.lastActivity).getTime();
            const now = Date.now();

            // Rotate if last activity was more than rotation interval ago
            return (now - lastActivity) > this.config.tokenRotationInterval;
        } catch (error) {
            console.error('Error checking token rotation:', error);
            return false;
        }
    }
}

module.exports = new SessionService();
