/**
 * Field-Level Access Control Middleware
 * Implements granular permissions based on user role
 * Ensures different roles only see data they're authorized for
 */

const auditLogger = require('../services/auditLogger');

/**
 * Define field access rules by role and resource type
 */
const fieldAccessRules = {
    patient: {
        vitals: ['all'], // Patients can see all vital fields for their own records
        prescriptions: ['all'],
        appointments: ['all'],
        payments: ['all'],
        documents: ['all']
    },
    doctor: {
        vitals: ['all'], // Doctors can see all patient fields
        prescriptions: ['all'],
        appointments: ['all'],
        payments: ['all'],
        documents: ['all'],
        patient_profile: ['all']
    },
    caregiver: {
        vitals: ['depends_on_permissions'], // Caregivers have granular permissions
        prescriptions: ['depends_on_permissions'],
        appointments: ['depends_on_permissions'],
        payments: ['depends_on_permissions'],
        documents: ['depends_on_permissions']
    },
    receptionist: {
        patient_profile: ['id', 'name', 'age', 'phone', 'email'], // Basic info only
        appointments: ['all'],
        payments: ['id', 'amount', 'status', 'createdAt'] // No payment method details
    },
    admin: {
        vitals: ['all'],
        prescriptions: ['all'],
        appointments: ['all'],
        payments: ['all'],
        documents: ['all'],
        patient_profile: ['all']
    }
};

/**
 * Fields that should never be exposed (sensitive internal data)
 */
const sensitiveFields = [
    'passwordHash',
    'passwordSalt',
    'apiKeys',
    'internalNotes',
    'socialSecurityNumber'
];

/**
 * Filter object fields based on allowed fields
 */
function filterFields(obj, allowedFields) {
    if (!obj || typeof obj !== 'object') return obj;

    // If 'all' is allowed, return everything except sensitive fields
    if (allowedFields.includes('all')) {
        const filtered = { ...obj };
        sensitiveFields.forEach(field => delete filtered[field]);
        return filtered;
    }

    // Return only allowed fields
    const filtered = {};
    allowedFields.forEach(field => {
        if (obj.hasOwnProperty(field) && !sensitiveFields.includes(field)) {
            filtered[field] = obj[field];
        }
    });

    return filtered;
}

/**
 * Middleware to filter response data based on user role
 * Usage: Apply after data retrieval, before sending response
 */
const filterByRole = (resourceType) => {
    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to filter data
        res.json = function(data) {
            const userRole = req.user?.role || 'guest';
            const userId = req.user?.uid;

            // Get allowed fields for this role and resource
            const rules = fieldAccessRules[userRole] || {};
            let allowedFields = rules[resourceType] || [];

            // Handle caregiver-specific permissions
            if (userRole === 'caregiver' && allowedFields[0] === 'depends_on_permissions') {
                // Caregivers have granular permissions stored in their relationship
                // This would be checked in caregiverPermissionMiddleware
                allowedFields = ['all']; // Default if permissions check passes
            }

            // Filter the data
            let filteredData;
            if (Array.isArray(data)) {
                filteredData = data.map(item => filterFields(item, allowedFields));
            } else if (data && typeof data === 'object') {
                // Check if data has a 'data' property (common API response pattern)
                if (data.data) {
                    filteredData = {
                        ...data,
                        data: Array.isArray(data.data)
                            ? data.data.map(item => filterFields(item, allowedFields))
                            : filterFields(data.data, allowedFields)
                    };
                } else {
                    filteredData = filterFields(data, allowedFields);
                }
            } else {
                filteredData = data;
            }

            // Log data access
            if (data && userId) {
                auditLogger.logDataAccess({
                    userId,
                    userRole,
                    resourceType,
                    resourceId: data.id || 'multiple',
                    action: 'read',
                    success: true,
                    metadata: {
                        fieldsAccessed: allowedFields,
                        recordCount: Array.isArray(data) ? data.length : 1
                    }
                }).catch(err => console.error('Audit logging failed:', err));
            }

            return originalJson(filteredData);
        };

        next();
    };
};

/**
 * Check if user has permission to access specific field
 */
function canAccessField(userRole, resourceType, fieldName) {
    const rules = fieldAccessRules[userRole] || {};
    const allowedFields = rules[resourceType] || [];

    // Check if field is sensitive (never allowed)
    if (sensitiveFields.includes(fieldName)) {
        return false;
    }

    // Check if 'all' is allowed
    if (allowedFields.includes('all')) {
        return true;
    }

    // Check if specific field is allowed
    return allowedFields.includes(fieldName);
}

/**
 * Middleware to check write permissions
 */
const checkWritePermission = (resourceType) => {
    return async (req, res, next) => {
        const userRole = req.user?.role || 'guest';
        const userId = req.user?.uid;

        // Define write permissions
        const writePermissions = {
            patient: ['vitals', 'appointments'], // Patients can add vitals, request appointments
            doctor: ['all'],
            caregiver: ['vitals'], // Caregivers can add vitals if permitted
            receptionist: ['appointments'],
            admin: ['all']
        };

        const allowed = writePermissions[userRole] || [];
        const hasPermission = allowed.includes('all') || allowed.includes(resourceType);

        if (!hasPermission) {
            // Log unauthorized attempt
            await auditLogger.logSecurity({
                userId,
                userRole,
                eventType: 'unauthorized_write_attempt',
                description: `Attempted to write ${resourceType} without permission`,
                severity: 'warning',
                metadata: {
                    resourceType,
                    method: req.method,
                    path: req.path
                }
            });

            return res.status(403).json({
                error: 'Permission Denied',
                message: `Your role does not have write access to ${resourceType}`
            });
        }

        next();
    };
};

module.exports = {
    filterByRole,
    canAccessField,
    checkWritePermission,
    fieldAccessRules
};
