/**
 * Security Dashboard Routes
 * Admin-only endpoints for security monitoring
 */

const express = require('express');
const router = express.Router();
const securityDashboardController = require('../controllers/securityDashboardController');
const verifyToken = require('../middleware/authMiddleware');
const { enforceAdminTwoFactor } = require('../middleware/require2FA');

// All dashboard routes require authentication and admin role
// Apply 2FA enforcement for admin users
router.use(verifyToken, enforceAdminTwoFactor);

/**
 * @route   GET /api/security/dashboard/overview
 * @desc    Get complete dashboard overview (all metrics)
 * @access  Admin only
 */
router.get('/overview', securityDashboardController.getDashboardOverview);

/**
 * @route   GET /api/security/dashboard/metrics
 * @desc    Get overall security metrics
 * @query   timeWindow - Hours to look back (default 24)
 * @access  Admin only
 */
router.get('/metrics', securityDashboardController.getMetrics);

/**
 * @route   GET /api/security/dashboard/health-score
 * @desc    Get security health score and recommendations
 * @access  Admin only
 */
router.get('/health-score', securityDashboardController.getHealthScore);

/**
 * @route   GET /api/security/dashboard/failed-logins
 * @desc    Get failed login attempts
 * @query   limit - Max records (default 50)
 * @access  Admin only
 */
router.get('/failed-logins', securityDashboardController.getFailedLogins);

/**
 * @route   GET /api/security/dashboard/rate-limits
 * @desc    Get rate limit violations
 * @query   limit - Max records (default 50)
 * @access  Admin only
 */
router.get('/rate-limits', securityDashboardController.getRateLimitViolations);

/**
 * @route   GET /api/security/dashboard/sessions
 * @desc    Get active sessions overview
 * @access  Admin only
 */
router.get('/sessions', securityDashboardController.getActiveSessions);

/**
 * @route   GET /api/security/dashboard/2fa-adoption
 * @desc    Get 2FA adoption metrics
 * @access  Admin only
 */
router.get('/2fa-adoption', securityDashboardController.get2FAAdoption);

/**
 * @route   GET /api/security/dashboard/suspicious-activity
 * @desc    Get suspicious activities
 * @query   limit - Max records (default 20)
 * @access  Admin only
 */
router.get('/suspicious-activity', securityDashboardController.getSuspiciousActivities);

/**
 * @route   GET /api/security/dashboard/access-patterns
 * @desc    Get data access patterns
 * @query   timeWindow - Hours to analyze (default 24)
 * @access  Admin only
 */
router.get('/access-patterns', securityDashboardController.getAccessPatterns);

module.exports = router;
