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

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle FlexPay webhook callbacks
 * @access  Public (called by FlexPay) — must be ABOVE router.use(verifyToken)
 */
router.post('/webhook', (req, res, next) => {
    const secret = process.env.FLEXPAY_WEBHOOK_SECRET;
    if (!secret) {
        console.warn('FLEXPAY_WEBHOOK_SECRET not set — webhook accepted without verification');
        return next();
    }
    const provided = req.headers['x-webhook-secret'] || req.query.secret;
    if (provided !== secret) {
        return res.status(403).json({ error: 'Invalid webhook secret' });
    }
    next();
}, paymentController.handleWebhook);

// Apply authentication to all remaining payment routes
router.use(verifyToken);

// Apply stricter rate limiting for payment endpoints (100 requests per 15 minutes)
router.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));

/**
 * @route   GET /api/payments/providers
 * @desc    Get list of available payment providers
 * @access  Private
 */
router.get('/providers', paymentController.getProviders);

/**
 * @route   POST /api/payments/mobile-money
 * @desc    Initiate mobile money payment (M-Pesa, Airtel, Orange, Africell)
 * @access  Private
 * @body    { amount, phoneNumber, provider, description, currency }
 */
router.post('/mobile-money', paymentController.initiateMobileMoneyPayment);

/**
 * @route   POST /api/payments/card
 * @desc    Initiate card payment (Visa, Mastercard)
 * @access  Private
 * @body    { amount, cardNumber, cardExpiry, cardCvv, cardHolderName, description, currency }
 */
router.post('/card', paymentController.initiateCardPayment);

/**
 * @route   POST /api/payments/cash
 * @desc    Initiate cash payment (manual confirmation required)
 * @access  Private
 * @body    { amount, description, locationDetails, currency }
 */
router.post('/cash', paymentController.initiateCashPayment);

/**
 * @route   GET /api/payments/transactions
 * @desc    Get user's payment transactions
 * @access  Private
 * @query   limit - Max number of transactions (default 50)
 * @query   status - Filter by status (pending, completed, failed, etc.)
 */
router.get('/transactions', paymentController.getUserTransactions);

/**
 * @route   GET /api/payments/patient/:patientId
 * @desc    Get payment transactions for a specific patient
 * @access  Private
 */
router.get('/patient/:patientId', paymentController.getPatientTransactions);

/**
 * @route   GET /api/payments/:transactionId/status
 * @desc    Check payment status
 * @access  Private
 */
router.get('/:transactionId/status', paymentController.checkPaymentStatus);

/**
 * @route   POST /api/payments/:transactionId/confirm
 * @desc    Confirm cash payment (Admin/Doctor only)
 * @access  Private (Admin/Doctor)
 * @body    { notes }
 */
router.post('/:transactionId/confirm', paymentController.confirmCashPayment);

/**
 * @route   POST /api/payments/:transactionId/refund
 * @desc    Process refund (Admin only)
 * @access  Private (Admin)
 * @body    { reason }
 */
router.post('/:transactionId/refund', paymentController.processRefund);

module.exports = router;
