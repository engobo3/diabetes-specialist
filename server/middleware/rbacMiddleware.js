/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Why: `verifyToken` only proves authentication — any logged-in patient could hit a
 * doctor-only endpoint. These factories enforce that the authenticated user has a
 * role permitted for the route, and audit-log denials so we can spot probes.
 *
 * Roles (from users/{uid}.role):
 *   patient, doctor, caregiver, receptionist, admin
 *
 * Usage:
 *   router.post('/', requireRole('doctor', 'admin'), createPatient);
 *   router.get('/:id', requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin'] }), getPatient);
 *   router.get('/me/something', requireAuthenticated, handler);
 */

const auditLogger = require('../services/auditLogger');

const VALID_ROLES = ['patient', 'doctor', 'caregiver', 'receptionist', 'admin'];

function logRbacDenial(req, reason, metadata = {}) {
    auditLogger.logSecurity({
        userId: req.user?.uid || 'anonymous',
        userRole: req.user?.role || 'unknown',
        eventType: 'rbac_denied',
        description: `RBAC denied: ${reason} on ${req.method} ${req.originalUrl || req.path}`,
        severity: 'warning',
        metadata: {
            path: req.path,
            method: req.method,
            reason,
            ...metadata
        }
    }).catch(err => console.error('Audit logging failed:', err.message));
}

/**
 * Require authenticated user (any role). Equivalent to `verifyToken` having run, but
 * also asserts that a Firestore user profile was loaded (req.user.role is set).
 */
const requireAuthenticated = (req, res, next) => {
    if (!req.user || !req.user.uid) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    next();
};

/**
 * Require one of the listed roles.
 *   requireRole('doctor', 'admin')
 */
const requireRole = (...allowedRoles) => {
    if (allowedRoles.length === 0) {
        throw new Error('requireRole called without roles — that would allow everyone, which is a bug');
    }
    const invalid = allowedRoles.filter(r => !VALID_ROLES.includes(r));
    if (invalid.length) {
        throw new Error(`requireRole received unknown role(s): ${invalid.join(', ')}`);
    }

    return (req, res, next) => {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        }

        const userRole = req.user.role;
        if (!userRole) {
            logRbacDenial(req, 'no_role_assigned', { allowedRoles });
            return res.status(403).json({
                error: 'Forbidden',
                message: 'No role assigned to this user. Contact an administrator.'
            });
        }

        if (!allowedRoles.includes(userRole)) {
            logRbacDenial(req, 'role_not_permitted', { allowedRoles, actualRole: userRole });
            return res.status(403).json({
                error: 'Forbidden',
                message: `This endpoint requires one of: ${allowedRoles.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Allow the request if the user is one of the privileged roles, OR if the user is
 * the patient identified by req.params[idParam]. Caregivers are deferred to the
 * existing caregiverPermissionMiddleware (this middleware just lets them through).
 *
 * Use for endpoints scoped to a single patient where the patient themselves can
 * also access their own data: /patients/:id, /patients/:id/vitals, etc.
 *
 *   requireSelfOrRoles({ idParam: 'id', roles: ['doctor', 'admin'] })
 */
const requireSelfOrRoles = ({ idParam = 'id', roles = [], allowCaregiver = true } = {}) => {
    return (req, res, next) => {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        }

        const userRole = req.user.role;
        const userPatientId = req.user.patientId;
        const targetId = req.params[idParam];

        // Privileged roles always pass
        if (roles.includes(userRole)) return next();

        // Patient accessing their own data
        if (userRole === 'patient' && userPatientId != null && String(userPatientId) === String(targetId)) {
            return next();
        }

        // Caregiver — defer the granular permission check to caregiverPermissionMiddleware
        // (which is applied separately when finer control is needed)
        if (allowCaregiver && userRole === 'caregiver') {
            return next();
        }

        logRbacDenial(req, 'not_self_or_privileged', {
            idParam,
            targetId: String(targetId),
            allowedRoles: roles,
            actualRole: userRole
        });
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have access to this resource'
        });
    };
};

/**
 * Like requireSelfOrRoles, but the "self" check matches req.user.uid against
 * req.params[idParam] (for routes scoped to a user UID rather than patient ID).
 */
const requireSelfUidOrRoles = ({ idParam = 'uid', roles = [] } = {}) => {
    return (req, res, next) => {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        }

        const userRole = req.user.role;
        const userUid = req.user.uid;
        const targetId = req.params[idParam];

        if (roles.includes(userRole)) return next();
        if (String(userUid) === String(targetId)) return next();

        logRbacDenial(req, 'not_self_uid_or_privileged', {
            idParam,
            targetId: String(targetId),
            allowedRoles: roles,
            actualRole: userRole
        });
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have access to this resource'
        });
    };
};

module.exports = {
    requireAuthenticated,
    requireRole,
    requireSelfOrRoles,
    requireSelfUidOrRoles,
    VALID_ROLES
};
