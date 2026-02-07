/**
 * Security Middleware
 * Implements security best practices including HTTPS enforcement,
 * security headers, and request validation
 * Integrates with email notification system for security alerts
 */

const emailService = require('../services/emailNotificationService');
const auditLogger = require('../services/auditLogger');

/**
 * Enforce HTTPS in production
 * Redirects HTTP requests to HTTPS
 */
const enforceHTTPS = (req, res, next) => {
    // Skip in development/test environments
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        return next();
    }

    // Check if request is secure
    const isSecure = req.secure || 
                     req.headers['x-forwarded-proto'] === 'https' ||
                     req.connection.encrypted;

    if (!isSecure) {
        return res.status(403).json({
            error: 'HTTPS Required',
            message: 'This API requires a secure HTTPS connection'
        });
    }

    next();
};

/**
 * Add security headers
 * Implements OWASP recommended security headers
 */
const securityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Strict Transport Security (HSTS) - enforce HTTPS for 1 year
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy (formerly Feature Policy)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
};

/**
 * Rate limiting helper
 * Tracks request counts per IP
 */
const requestCounts = new Map();

const rateLimit = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        maxRequests = 100,
        message = 'Too many requests, please try again later'
    } = options;

    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        // Get or initialize counter for this IP
        let requestInfo = requestCounts.get(ip) || { count: 0, resetTime: now + windowMs };
        
        // Reset if window has expired
        if (now > requestInfo.resetTime) {
            requestInfo = { count: 0, resetTime: now + windowMs };
        }
        
        requestInfo.count++;
        requestCounts.set(ip, requestInfo);
        
        // Check if limit exceeded
        if (requestInfo.count > maxRequests) {
            // Log security event
            auditLogger.logSecurity({
                userId: req.user?.uid || 'anonymous',
                userRole: req.user?.role || 'unknown',
                eventType: 'rate_limit_exceeded',
                description: `Rate limit exceeded from IP ${ip}`,
                severity: 'warning',
                metadata: {
                    ip,
                    requestCount: requestInfo.count,
                    maxRequests,
                    path: req.path
                }
            }).catch(err => console.error('Audit logging failed:', err));

            // Send email for excessive requests (potential attack)
            if (requestInfo.count > maxRequests * 2) {
                emailService.notifySuspiciousActivity({
                    userId: req.user?.uid || ip,
                    activity: 'excessive_rate_limit',
                    metadata: { ip, requestCount: requestInfo.count, path: req.path },
                    timestamp: new Date().toISOString()
                }).catch(err => console.error('Email notification failed:', err));
            }

            return res.status(429).json({
                error: 'Rate Limit Exceeded',
                message,
                retryAfter: Math.ceil((requestInfo.resetTime - now) / 1000)
            });
        }
        
        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requestInfo.count));
        res.setHeader('X-RateLimit-Reset', new Date(requestInfo.resetTime).toISOString());
        
        next();
    };
};

/**
 * Input sanitization
 * Removes potentially dangerous characters from user input
 */
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove potential XSS vectors - improved regex
            return obj
                .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags and content
                .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '') // Remove iframe tags
                .replace(/javascript:/gi, '') // Remove javascript: protocol
                .replace(/on\w+\s*=/gi, '') // Remove inline event handlers
                .replace(/<embed[^>]*>/gi, '') // Remove embed tags
                .replace(/<object[^>]*>.*?<\/object>/gis, ''); // Remove object tags
        }

        if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
            const sanitized = {};
            for (const key in obj) {
                sanitized[key] = sanitize(obj[key]);
            }
            return sanitized;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => sanitize(item));
        }

        return obj;
    };

    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    if (req.params) {
        req.params = sanitize(req.params);
    }

    next();
};

/**
 * Validate Content-Type for POST/PUT/PATCH
 */
const validateContentType = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'Content-Type must be application/json'
            });
        }
    }
    
    next();
};

module.exports = {
    enforceHTTPS,
    securityHeaders,
    rateLimit,
    sanitizeInput,
    validateContentType
};
