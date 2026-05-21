/**
 * Payment Routes
 * Handles all payment operations for Congolese market
 * Supports: Mobile Money, Cards, Cash via FlexPay
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const verifyToken = require('../middleware/authMiddleware');
const { rateLimit } = require('../middleware/securityMiddleware');
const { requireRole, requireSelfOrRoles } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams } = require('../middleware/validationMiddleware');
const {
    PatientIdParamSchema,
    TransactionIdParamSchema
} = require('../schemas/common.schema');
const {
    PaymentMobileMoneySchema,
    PaymentCardSchema,
    PaymentCashSchema,
    PaymentConfirmSchema,
    PaymentRefundSchema
} = require('../schemas/auth.schema');

/**
 * Webhook from FlexPay (public, secret-protected via x-webhook-secret header)
 * Must be ABOVE router.use(verifyToken).
 */
router.post('/webhook', (req, res, next) => {
    const secret = process.env.FLEXPAY_WEBHOOK_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            console.error('FLEXPAY_WEBHOOK_SECRET not set in production — rejecting webhook');
            return res.status(500).json({ error: 'Webhook not configured' });
        }
        console.warn('FLEXPAY_WEBHOOK_SECRET not set — webhook accepted without verification (dev only)');
        return next();
    }
    const provided = req.headers['x-webhook-secret'] || req.query.secret;
    if (provided !== secret) {
        return res.status(403).json({ error: 'Invalid webhook secret' });
    }
    next();
}, paymentController.handleWebhook);

// Auth + stricter rate limit for everything below
router.use(verifyToken);
router.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));

router.get('/providers', paymentController.getProviders);

router.post('/mobile-money',
    validateBody(PaymentMobileMoneySchema),
    paymentController.initiateMobileMoneyPayment
);

router.post('/card',
    validateBody(PaymentCardSchema),
    paymentController.initiateCardPayment
);

router.post('/cash',
    validateBody(PaymentCashSchema),
    paymentController.initiateCashPayment
);

router.get('/transactions', paymentController.getUserTransactions);

router.get('/patient/:patientId',
    validateParams(PatientIdParamSchema),
    requireSelfOrRoles({ idParam: 'patientId', roles: ['doctor', 'admin', 'receptionist'] }),
    paymentController.getPatientTransactions
);

router.get('/:transactionId/status',
    validateParams(TransactionIdParamSchema),
    paymentController.checkPaymentStatus
);

router.post('/:transactionId/confirm',
    validateParams(TransactionIdParamSchema),
    requireRole('doctor', 'admin', 'receptionist'),
    validateBody(PaymentConfirmSchema),
    paymentController.confirmCashPayment
);

router.post('/:transactionId/refund',
    validateParams(TransactionIdParamSchema),
    requireRole('admin'),
    validateBody(PaymentRefundSchema),
    paymentController.processRefund
);

module.exports = router;
