/**
 * Security Dashboard Controller
 * Provides endpoints for security monitoring and metrics
 */

const securityDashboardService = require('../services/securityDashboardService');
const auditLogger = require('../services/auditLogger');

/**
 * Get overall security metrics
 * GET /api/security/dashboard/metrics
 */
exports.getMetrics = async (req, res) => {
    try {
        const { uid, role } = req.user;
        const { timeWindow = 24 } = req.query;

        // Only admins can access dashboard
        if (role !== 'admin') {
            await auditLogger.logSecurity({
                userId: uid,
                userRole: role,
                eventType: 'unauthorized_dashboard_access',
                description: 'Non-admin user attempted to access security dashboard',
                severity: 'warning'
            });

            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        const metrics = await securityDashboardService.getSecurityMetrics(parseInt(timeWindow));

        await auditLogger.logDataAccess({
            userId: uid,
            userRole: role,
            resourceType: 'security_dashboard',
            resourceId: 'metrics',
            action: 'read',
            success: true
        });

        res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch security metrics',
            message: error.message
        });
    }
};

/**
 * Get failed login attempts
 * GET /api/security/dashboard/failed-logins
 */
exports.getFailedLogins = async (req, res) => {
    try {
        const { uid, role } = req.user;
        const { limit = 50 } = req.query;

        if (role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        const attempts = await securityDashboardService.getFailedLoginAttempts(parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                attempts,
                count: attempts.length
            }
        });
    } catch (error) {
        console.error('Failed logins error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch login attempts',
            message: error.message
        });
    }
};

/**
 * Get rate limit violations
 * GET /api/security/dashboard/rate-limits
 */
exports.getRateLimitViolations = async (req, res) => {
    try {
        const { uid, role } = req.user;
        const { limit = 50 } = req.query;

        if (role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        const violations = await securityDashboardService.getRateLimitViolations(parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                violations,
                count: violations.length
            }
        });
    } catch (error) {
        console.error('Rate limit violations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rate limit violations',
            message: error.message
        });
    }
};

/**
 * Get active sessions overview
 * GET /api/security/dashboard/sessions
 */
exports.getActiveSessions = async (req, res) => {
    try {
        const { uid, role } = req.user;

        if (role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        const overview = await securityDashboardService.getActiveSessionsOverview();

        res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        console.error('Active sessions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active sessions',
            message: error.message
        });
    }
};

/**
 * Get 2FA adoption metrics
 * GET /api/security/dashboard/2fa-adoption
 */
exports.get2FAAdoption = async (req, res) => {
    try {
        const { uid, role } = req.user;

        if (role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        const metrics = await securityDashboardService.get2FAAdoptionMetrics();

        res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('2FA adoption error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch 2FA metrics',
            message: error.message
        });
    }
};

/**
 * Get suspicious activities
 * GET /api/security/dashboard/suspicious-activity
 */
exports.getSuspiciousActivities = async (req, res) => {
    try {
        const { uid, role } = req.user;
        const { limit = 20 } = req.query;

        if (role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        const activities = await securityDashboardService.getSuspiciousActivities(parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                activities,
                count: activities.length
            }
        });
    } catch (error) {
        console.error('Suspicious activities error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch suspicious activities',
            message: error.message
        });
    }
};

/**
 * Get data access patterns
 * GET /api/security/dashboard/access-patterns
 */
exports.getAccessPatterns = async (req, res) => {
    try {
        const { uid, role } = req.user;
        const { timeWindow = 24 } = req.query;

        if (role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        const patterns = await securityDashboardService.getDataAccessPatterns(parseInt(timeWindow));

        res.status(200).json({
            success: true,
            data: patterns
        });
    } catch (error) {
        console.error('Access patterns error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch access patterns',
            message: error.message
        });
    }
};

/**
 * Get security health score
 * GET /api/security/dashboard/health-score
 */
exports.getHealthScore = async (req, res) => {
    try {
        const { uid, role } = req.user;

        if (role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        const healthScore = await securityDashboardService.getSecurityHealthScore();

        res.status(200).json({
            success: true,
            data: healthScore
        });
    } catch (error) {
        console.error('Health score error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate health score',
            message: error.message
        });
    }
};

/**
 * Get complete dashboard overview (all metrics in one call)
 * GET /api/security/dashboard/overview
 */
exports.getDashboardOverview = async (req, res) => {
    try {
        const { uid, role } = req.user;

        if (role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        // Fetch all metrics in parallel
        const [
            metrics,
            healthScore,
            activeSessions,
            twoFAAdoption,
            suspiciousActivities
        ] = await Promise.all([
            securityDashboardService.getSecurityMetrics(24),
            securityDashboardService.getSecurityHealthScore(),
            securityDashboardService.getActiveSessionsOverview(),
            securityDashboardService.get2FAAdoptionMetrics(),
            securityDashboardService.getSuspiciousActivities(10)
        ]);

        await auditLogger.logDataAccess({
            userId: uid,
            userRole: role,
            resourceType: 'security_dashboard',
            resourceId: 'overview',
            action: 'read',
            success: true
        });

        res.status(200).json({
            success: true,
            data: {
                healthScore,
                metrics,
                activeSessions,
                twoFAAdoption,
                suspiciousActivities,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard overview',
            message: error.message
        });
    }
};
