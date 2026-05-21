/**
 * Zod Validation Middleware
 *
 * Generic factories that run a Zod schema against req.body / req.params / req.query.
 * On failure: 400 with structured details + audit-log entry.
 * On success: the parsed (and coerced) value replaces the original.
 *
 * Why this matters for medical software: schemas are the contract between client and
 * server. Without enforcement, the contract is documentation only — bad data still
 * reaches Firestore. This wraps every endpoint that opts in.
 */

const auditLogger = require('../services/auditLogger');

function formatZodIssues(error) {
    if (!error || !Array.isArray(error.issues)) return [];
    return error.issues.map(issue => ({
        path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
        message: issue.message,
        code: issue.code
    }));
}

function logValidationFailure(req, source, issues) {
    auditLogger.logSecurity({
        userId: req.user?.uid || 'anonymous',
        userRole: req.user?.role || 'unknown',
        eventType: 'validation_failed',
        description: `${source} validation failed for ${req.method} ${req.originalUrl || req.path}`,
        severity: 'info',
        metadata: {
            path: req.path,
            method: req.method,
            source,
            issueCount: issues.length,
            issues: issues.slice(0, 10)
        }
    }).catch(err => console.error('Audit logging failed:', err.message));
}

function makeValidator(source) {
    return (schema) => {
        return (req, res, next) => {
            const target = req[source];
            const result = schema.safeParse(target);

            if (!result.success) {
                const issues = formatZodIssues(result.error);
                logValidationFailure(req, source, issues);
                return res.status(400).json({
                    error: 'Validation Failed',
                    message: `Request ${source} is invalid`,
                    details: issues
                });
            }

            // req.query is read-only on Express 5 — copy properties instead of reassigning
            if (source === 'query') {
                for (const key of Object.keys(target)) delete target[key];
                Object.assign(target, result.data);
            } else {
                req[source] = result.data;
            }

            next();
        };
    };
}

const validateBody = makeValidator('body');
const validateParams = makeValidator('params');
const validateQuery = makeValidator('query');

module.exports = {
    validateBody,
    validateParams,
    validateQuery
};
