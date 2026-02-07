/**
 * Security Dashboard Service
 * Aggregates security metrics and provides monitoring data
 * Centralizes security information for admin oversight
 */

const { db } = require('../config/firebaseConfig');
const sessionService = require('./sessionService');

class SecurityDashboardService {
    constructor() {
        this.auditLogsCollection = 'audit_logs';
        this.sessionsCollection = 'user_sessions';
        this.usersCollection = 'users';
    }

    /**
     * Get overall security metrics
     * @param {number} timeWindowHours - Time window for metrics (default 24 hours)
     * @returns {Promise<Object>} Security metrics summary
     */
    async getSecurityMetrics(timeWindowHours = 24) {
        try {
            const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

            // Fetch recent audit logs
            const auditLogsSnapshot = await db.collection(this.auditLogsCollection)
                .where('timestamp', '>=', cutoffTime.toISOString())
                .get();

            const auditLogs = auditLogsSnapshot.docs.map(doc => doc.data());

            // Calculate metrics
            const metrics = {
                timeWindow: `${timeWindowHours} hours`,
                failedLogins: this._countEvents(auditLogs, 'authentication_failed'),
                suspiciousActivity: this._countEvents(auditLogs, 'unauthorized_access'),
                rateLimitViolations: this._countEvents(auditLogs, 'rate_limit_exceeded'),
                twoFactorEvents: {
                    setupsInitiated: this._countEvents(auditLogs, '2fa_setup_initiated'),
                    enabled: this._countEvents(auditLogs, '2fa_enabled'),
                    failed: this._countEvents(auditLogs, '2fa_failed'),
                    verified: this._countEvents(auditLogs, '2fa_verified')
                },
                sessionEvents: {
                    created: this._countEvents(auditLogs, 'session_created'),
                    expired: this._countEvents(auditLogs, 'session_timeout'),
                    invalidated: this._countEvents(auditLogs, 'session_invalidated')
                },
                dataAccess: {
                    total: this._countEventType(auditLogs, 'DATA_ACCESS'),
                    byRole: this._groupByRole(auditLogs, 'DATA_ACCESS')
                },
                securityAlerts: this._getSecurityAlerts(auditLogs),
                totalEvents: auditLogs.length
            };

            return metrics;
        } catch (error) {
            console.error('Error getting security metrics:', error);
            return {
                error: 'Failed to fetch security metrics',
                message: error.message
            };
        }
    }

    /**
     * Get failed authentication attempts
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Failed login attempts
     */
    async getFailedLoginAttempts(limit = 50) {
        try {
            const logsSnapshot = await db.collection(this.auditLogsCollection)
                .where('eventType', '==', 'authentication_failed')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            return logsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    timestamp: data.timestamp,
                    userId: data.userId,
                    ipAddress: data.metadata?.ipAddress,
                    reason: data.metadata?.reason,
                    severity: data.severity
                };
            });
        } catch (error) {
            console.error('Error getting failed logins:', error);
            return [];
        }
    }

    /**
     * Get rate limit violations
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Rate limit violations
     */
    async getRateLimitViolations(limit = 50) {
        try {
            const logsSnapshot = await db.collection(this.auditLogsCollection)
                .where('eventType', '==', 'rate_limit_exceeded')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            return logsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    timestamp: data.timestamp,
                    userId: data.userId || 'anonymous',
                    ipAddress: data.metadata?.ip,
                    requestCount: data.metadata?.requestCount,
                    path: data.metadata?.path
                };
            });
        } catch (error) {
            console.error('Error getting rate limit violations:', error);
            return [];
        }
    }

    /**
     * Get active sessions overview
     * @returns {Promise<Object>} Active sessions summary
     */
    async getActiveSessionsOverview() {
        try {
            const sessionsSnapshot = await db.collection(this.sessionsCollection)
                .where('isActive', '==', true)
                .get();

            const sessions = sessionsSnapshot.docs.map(doc => doc.data());

            // Group by user role
            const byRole = {};
            const byDevice = {};
            const byBrowser = {};

            sessions.forEach(session => {
                // By role
                byRole[session.userRole] = (byRole[session.userRole] || 0) + 1;

                // By device type
                const deviceType = session.deviceInfo?.device || 'Unknown';
                byDevice[deviceType] = (byDevice[deviceType] || 0) + 1;

                // By browser
                const browser = session.deviceInfo?.browser || 'Unknown';
                byBrowser[browser] = (byBrowser[browser] || 0) + 1;
            });

            return {
                totalActive: sessions.length,
                byRole,
                byDevice,
                byBrowser,
                recentSessions: sessions
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 10)
                    .map(s => ({
                        userId: s.userId,
                        userRole: s.userRole,
                        createdAt: s.createdAt,
                        lastActivity: s.lastActivity,
                        ipAddress: s.ipAddress,
                        deviceInfo: s.deviceInfo
                    }))
            };
        } catch (error) {
            console.error('Error getting active sessions:', error);
            return {
                totalActive: 0,
                byRole: {},
                byDevice: {},
                byBrowser: {},
                recentSessions: []
            };
        }
    }

    /**
     * Get 2FA adoption metrics
     * @returns {Promise<Object>} 2FA statistics
     */
    async get2FAAdoptionMetrics() {
        try {
            const usersSnapshot = await db.collection(this.usersCollection).get();
            const users = usersSnapshot.docs.map(doc => doc.data());

            const total = users.length;
            const enabled = users.filter(u => u.twoFactorAuth?.enabled).length;
            const byRole = {};

            users.forEach(user => {
                const role = user.role || 'unknown';
                if (!byRole[role]) {
                    byRole[role] = { total: 0, enabled: 0 };
                }
                byRole[role].total++;
                if (user.twoFactorAuth?.enabled) {
                    byRole[role].enabled++;
                }
            });

            return {
                total,
                enabled,
                disabled: total - enabled,
                adoptionRate: total > 0 ? ((enabled / total) * 100).toFixed(1) : 0,
                byRole: Object.entries(byRole).map(([role, stats]) => ({
                    role,
                    total: stats.total,
                    enabled: stats.enabled,
                    adoptionRate: ((stats.enabled / stats.total) * 100).toFixed(1)
                }))
            };
        } catch (error) {
            console.error('Error getting 2FA metrics:', error);
            return {
                total: 0,
                enabled: 0,
                disabled: 0,
                adoptionRate: 0,
                byRole: []
            };
        }
    }

    /**
     * Get suspicious activity alerts
     * @param {number} limit - Maximum number of alerts
     * @returns {Promise<Array>} Suspicious activities
     */
    async getSuspiciousActivities(limit = 20) {
        try {
            const logsSnapshot = await db.collection(this.auditLogsCollection)
                .where('severity', 'in', ['warning', 'critical'])
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            return logsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    timestamp: data.timestamp,
                    userId: data.userId,
                    userRole: data.userRole,
                    eventType: data.eventType,
                    description: data.description,
                    severity: data.severity,
                    metadata: data.metadata
                };
            });
        } catch (error) {
            console.error('Error getting suspicious activities:', error);
            return [];
        }
    }

    /**
     * Get data access patterns
     * @param {number} timeWindowHours - Time window for analysis
     * @returns {Promise<Object>} Access patterns
     */
    async getDataAccessPatterns(timeWindowHours = 24) {
        try {
            const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

            const logsSnapshot = await db.collection(this.auditLogsCollection)
                .where('eventType', '==', 'DATA_ACCESS')
                .where('timestamp', '>=', cutoffTime.toISOString())
                .get();

            const logs = logsSnapshot.docs.map(doc => doc.data());

            const byResource = {};
            const byUser = {};
            const byHour = Array(24).fill(0);

            logs.forEach(log => {
                // By resource type
                const resourceType = log.resourceType || 'unknown';
                byResource[resourceType] = (byResource[resourceType] || 0) + 1;

                // By user
                const userId = log.userId || 'unknown';
                byUser[userId] = (byUser[userId] || 0) + 1;

                // By hour
                const hour = new Date(log.timestamp).getHours();
                byHour[hour]++;
            });

            // Find top users
            const topUsers = Object.entries(byUser)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([userId, count]) => ({ userId, accessCount: count }));

            return {
                totalAccess: logs.length,
                byResource,
                byHour,
                topUsers,
                averagePerHour: (logs.length / timeWindowHours).toFixed(1)
            };
        } catch (error) {
            console.error('Error getting access patterns:', error);
            return {
                totalAccess: 0,
                byResource: {},
                byHour: Array(24).fill(0),
                topUsers: [],
                averagePerHour: 0
            };
        }
    }

    /**
     * Get security health score
     * @returns {Promise<Object>} Health score and recommendations
     */
    async getSecurityHealthScore() {
        try {
            const metrics = await this.getSecurityMetrics(24);
            const twoFAMetrics = await this.get2FAAdoptionMetrics();

            let score = 100;
            const issues = [];
            const recommendations = [];

            // Deduct points for security issues
            if (metrics.failedLogins > 50) {
                score -= 15;
                issues.push('High number of failed login attempts');
                recommendations.push('Review authentication logs and consider implementing account lockout');
            }

            if (metrics.rateLimitViolations > 20) {
                score -= 10;
                issues.push('Multiple rate limit violations detected');
                recommendations.push('Consider lowering rate limits or investigating suspicious IPs');
            }

            if (twoFAMetrics.adoptionRate < 50) {
                score -= 20;
                issues.push('Low 2FA adoption rate');
                recommendations.push('Encourage users to enable 2FA, make it mandatory for sensitive roles');
            }

            if (metrics.suspiciousActivity > 10) {
                score -= 15;
                issues.push('Suspicious activity detected');
                recommendations.push('Review security alerts and investigate unauthorized access attempts');
            }

            // Bonus points for good practices
            if (twoFAMetrics.adoptionRate > 80) {
                score += 5;
            }

            return {
                score: Math.max(0, Math.min(100, score)),
                rating: this._getScoreRating(score),
                issues,
                recommendations,
                metrics: {
                    failedLogins: metrics.failedLogins,
                    rateLimitViolations: metrics.rateLimitViolations,
                    twoFAAdoptionRate: twoFAMetrics.adoptionRate,
                    suspiciousActivity: metrics.suspiciousActivity
                }
            };
        } catch (error) {
            console.error('Error calculating health score:', error);
            return {
                score: 0,
                rating: 'Unknown',
                issues: ['Unable to calculate health score'],
                recommendations: [],
                error: error.message
            };
        }
    }

    // Helper methods

    _countEvents(logs, eventType) {
        return logs.filter(log => log.eventType === eventType).length;
    }

    _countEventType(logs, eventType) {
        return logs.filter(log => log.eventType === eventType).length;
    }

    _groupByRole(logs, eventType) {
        const filtered = logs.filter(log => log.eventType === eventType);
        const grouped = {};

        filtered.forEach(log => {
            const role = log.userRole || 'unknown';
            grouped[role] = (grouped[role] || 0) + 1;
        });

        return grouped;
    }

    _getSecurityAlerts(logs) {
        const alertTypes = [
            'unauthorized_access',
            'authentication_failed',
            '2fa_failed',
            'rate_limit_exceeded',
            'session_mismatch'
        ];

        return logs
            .filter(log => alertTypes.includes(log.eventType))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10)
            .map(log => ({
                timestamp: log.timestamp,
                eventType: log.eventType,
                userId: log.userId,
                severity: log.severity,
                description: log.description
            }));
    }

    _getScoreRating(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Good';
        if (score >= 60) return 'Fair';
        if (score >= 40) return 'Poor';
        return 'Critical';
    }
}

module.exports = new SecurityDashboardService();
