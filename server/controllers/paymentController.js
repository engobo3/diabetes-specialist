/**
 * Payment Controller
 * Handles payment operations for Congolese market
 * Supports: Mobile Money (M-Pesa, Airtel, Orange, Africell), Cards, Cash
 */

const flexpayService = require('../services/flexpayService');
const auditLogger = require('../services/auditLogger');
const { safeErrorMessage } = require('../utils/safeError');

/**
 * Initiate mobile money payment
 * POST /api/payments/mobile-money
 */
exports.initiateMobileMoneyPayment = async (req, res) => {
    try {
        const { uid, email } = req.user;
        const { amount, phoneNumber, provider, description, currency } = req.body;

        // Validate inputs
        if (!amount || !phoneNumber || !provider) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: amount, phoneNumber, provider'
            });
        }

        const result = await flexpayService.initiateMobileMoneyPayment({
            amount,
            currency: currency || 'CDF',
            phoneNumber,
            provider,
            description,
            userId: uid,
            userEmail: email
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Mobile money payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment initiation failed',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Initiate card payment
 * POST /api/payments/card
 */
exports.initiateCardPayment = async (req, res) => {
    try {
        const { uid, email } = req.user;
        const {
            amount,
            cardNumber,
            cardExpiry,
            cardCvv,
            cardHolderName,
            description,
            currency
        } = req.body;

        // Validate inputs
        if (!amount || !cardNumber || !cardExpiry || !cardCvv) {
            return res.status(400).json({
                success: false,
                error: 'Missing required card details'
            });
        }

        const result = await flexpayService.initiateCardPayment({
            amount,
            currency: currency || 'CDF',
            cardNumber,
            cardExpiry,
            cardCvv,
            cardHolderName,
            description,
            userId: uid,
            userEmail: email
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Card payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Card payment failed',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Initiate cash payment
 * POST /api/payments/cash
 */
exports.initiateCashPayment = async (req, res) => {
    try {
        const { uid, email } = req.user;
        const { amount, description, locationDetails, currency, patientId, doctorId } = req.body;

        if (!amount) {
            return res.status(400).json({
                success: false,
                error: 'Amount is required'
            });
        }

        const result = await flexpayService.initiateCashPayment({
            amount,
            currency: currency || 'CDF',
            description,
            locationDetails,
            userId: uid,
            userEmail: email,
            patientId: patientId || uid,
            doctorId: doctorId || null
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Cash payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Cash payment recording failed',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Check payment status
 * GET /api/payments/:transactionId/status
 */
exports.checkPaymentStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const status = await flexpayService.checkPaymentStatus(transactionId);

        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check payment status',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Get user transactions
 * GET /api/payments/transactions
 */
exports.getUserTransactions = async (req, res) => {
    try {
        const { uid } = req.user;
        const { limit, status } = req.query;

        const transactions = await flexpayService.getUserTransactions(uid, {
            limit: limit ? parseInt(limit) : 50,
            status
        });

        res.status(200).json({
            success: true,
            data: {
                transactions,
                count: transactions.length
            }
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Confirm cash payment (Admin only)
 * POST /api/payments/:transactionId/confirm
 */
exports.confirmCashPayment = async (req, res) => {
    try {
        const { uid, email, role } = req.user;
        const { transactionId } = req.params;
        const { notes } = req.body;

        // Only admins can confirm cash payments
        if (role !== 'admin' && role !== 'doctor') {
            await auditLogger.logSecurity({
                userId: email,
                userRole: role,
                eventType: 'unauthorized_payment_confirmation',
                description: 'Non-admin attempted to confirm cash payment',
                severity: 'warning',
                metadata: { transactionId }
            });

            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin or doctor role required.'
            });
        }

        const result = await flexpayService.confirmCashPayment(transactionId, {
            confirmedBy: email,
            notes
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Cash confirmation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to confirm payment',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Process refund (Admin only)
 * POST /api/payments/:transactionId/refund
 */
exports.processRefund = async (req, res) => {
    try {
        const { uid, email, role } = req.user;
        const { transactionId } = req.params;
        const { reason } = req.body;

        // Only admins can process refunds
        if (role !== 'admin') {
            await auditLogger.logSecurity({
                userId: email,
                userRole: role,
                eventType: 'unauthorized_refund_attempt',
                description: 'Non-admin attempted to process refund',
                severity: 'warning',
                metadata: { transactionId }
            });

            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.'
            });
        }

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Refund reason is required'
            });
        }

        const result = await flexpayService.processRefund(transactionId, {
            reason,
            refundedBy: email
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process refund',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Handle FlexPay webhook
 * POST /api/payments/webhook
 */
exports.handleWebhook = async (req, res) => {
    try {
        const webhookData = req.body;

        console.log('FlexPay webhook received:', webhookData);

        // Extract transaction details
        const {
            reference, // Our transaction ID
            status,
            amount,
            currency,
            provider
        } = webhookData;

        if (!reference) {
            return res.status(400).json({
                success: false,
                error: 'Missing transaction reference'
            });
        }

        // Update transaction status
        const transaction = await flexpayService.checkPaymentStatus(reference);

        // Log webhook
        await auditLogger.logDataModification({
            userId: 'system',
            userRole: 'system',
            resourceType: 'payment',
            resourceId: reference,
            action: 'webhook_received',
            changes: { status, provider },
            success: true,
            metadata: webhookData
        });

        // Send success response to FlexPay
        res.status(200).json({
            success: true,
            message: 'Webhook processed'
        });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Get patient transactions
 * GET /api/payments/patient/:patientId
 */
exports.getPatientTransactions = async (req, res) => {
    try {
        const { patientId } = req.params;

        const transactions = await flexpayService.getPatientTransactions(patientId);

        res.status(200).json({
            success: true,
            data: {
                transactions,
                count: transactions.length
            }
        });
    } catch (error) {
        console.error('Get patient transactions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch patient transactions',
            message: safeErrorMessage(error)
        });
    }
};

/**
 * Get payment providers list
 * GET /api/payments/providers
 */
exports.getProviders = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                mobileMoneyProviders: [
                    { id: 'mpesa', name: 'M-Pesa (Vodacom)', icon: '📱' },
                    { id: 'airtel', name: 'Airtel Money', icon: '📱' },
                    { id: 'orange', name: 'Orange Money', icon: '🍊' },
                    { id: 'africell', name: 'Africell Money', icon: '📱' }
                ],
                cardProviders: [
                    { id: 'visa', name: 'Visa', icon: '💳' },
                    { id: 'mastercard', name: 'Mastercard', icon: '💳' }
                ],
                other: [
                    { id: 'cash', name: 'Cash (In-person)', icon: '💵' }
                ]
            }
        });
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch providers',
            message: safeErrorMessage(error)
        });
    }
};
