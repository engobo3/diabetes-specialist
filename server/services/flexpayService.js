/**
 * FlexPay Payment Service
 * Handles mobile money, card, and cash payments for Congolese market
 * Supports: M-Pesa, Airtel Money, Orange Money, Africell Money, Bank Cards
 */

const FlexPay = require('flexpay');
const admin = require('firebase-admin');
const { db } = require('../config/firebaseConfig');
const auditLogger = require('./auditLogger');
const emailService = require('./emailNotificationService');

class FlexPayService {
    constructor() {
        this.flexpay = null;
        this.collectionName = 'transactions';
        this.initialized = false;

        // Payment providers
        this.PROVIDERS = {
            MOBILE_MONEY: {
                MPESA: 'mpesa',
                AIRTEL: 'airtel',
                ORANGE: 'orange',
                AFRICELL: 'africell'
            },
            CARDS: 'visa_mastercard',
            CASH: 'cash'
        };

        // Payment status
        this.STATUS = {
            PENDING: 'pending',
            PROCESSING: 'processing',
            COMPLETED: 'completed',
            FAILED: 'failed',
            CANCELLED: 'cancelled',
            REFUNDED: 'refunded'
        };

        this._initialize();
    }

    /**
     * Initialize FlexPay client
     * @private
     */
    _initialize() {
        try {
            const token = process.env.FLEXPAY_API_TOKEN;
            const mode = process.env.FLEXPAY_MODE || 'development'; // 'development' or 'production'

            if (!token) {
                console.warn('FlexPay API token not configured. Payment processing disabled.');
                return;
            }

            this.flexpay = new FlexPay(token, mode);
            this.initialized = true;
            console.log(`FlexPay initialized in ${mode} mode`);
        } catch (error) {
            console.error('FlexPay initialization error:', error);
        }
    }

    /**
     * Initiate mobile money payment
     * @param {Object} paymentData - Payment details
     * @returns {Promise<Object>} Payment result
     */
    async initiateMobileMoneyPayment(paymentData) {
        try {
            const {
                amount,
                currency = 'CDF', // Congolese Franc
                phoneNumber,
                provider, // mpesa, airtel, orange, africell
                description,
                userId,
                userEmail,
                metadata = {}
            } = paymentData;

            // Validate
            if (!this.initialized) {
                throw new Error('FlexPay not initialized. Check API token configuration.');
            }

            if (!amount || amount <= 0) {
                throw new Error('Invalid amount');
            }

            if (!phoneNumber) {
                throw new Error('Phone number is required for mobile money');
            }

            if (!Object.values(this.PROVIDERS.MOBILE_MONEY).includes(provider)) {
                throw new Error(`Invalid provider. Must be one of: ${Object.values(this.PROVIDERS.MOBILE_MONEY).join(', ')}`);
            }

            // Create transaction record
            const transaction = await this._createTransaction({
                amount,
                currency,
                provider,
                paymentMethod: 'mobile_money',
                phoneNumber,
                description,
                userId,
                userEmail,
                status: this.STATUS.PENDING,
                metadata
            });

            // Initiate payment with FlexPay
            const paymentRequest = {
                amount,
                currency,
                phone: phoneNumber,
                provider,
                reference: transaction.id,
                callback_url: `${process.env.API_BASE_URL}/api/payments/webhook${process.env.FLEXPAY_WEBHOOK_SECRET ? '?secret=' + process.env.FLEXPAY_WEBHOOK_SECRET : ''}`,
                description: description || `Payment for GlucoSoin services`
            };

            const result = await this.flexpay.mobileMoney(paymentRequest);

            // Update transaction with FlexPay reference
            await this._updateTransaction(transaction.id, {
                flexpayReference: result.reference || result.orderNumber,
                status: this.STATUS.PROCESSING,
                flexpayResponse: result
            });

            await auditLogger.logDataModification({
                userId,
                userRole: 'patient',
                resourceType: 'payment',
                resourceId: transaction.id,
                action: 'create',
                changes: { status: 'initiated', provider, amount },
                success: true
            });

            return {
                success: true,
                transactionId: transaction.id,
                flexpayReference: result.reference || result.orderNumber,
                status: this.STATUS.PROCESSING,
                message: `Payment initiated via ${provider}. Please confirm on your phone.`,
                data: result
            };
        } catch (error) {
            console.error('Mobile money payment error:', error);

            await auditLogger.logSecurity({
                userId: paymentData.userId,
                userRole: 'patient',
                eventType: 'payment_failed',
                description: `Mobile money payment failed: ${error.message}`,
                severity: 'warning',
                metadata: { provider: paymentData.provider, error: error.message }
            });

            throw error;
        }
    }

    /**
     * Initiate card payment
     * @param {Object} paymentData - Payment details
     * @returns {Promise<Object>} Payment result
     */
    async initiateCardPayment(paymentData) {
        try {
            const {
                amount,
                currency = 'CDF',
                cardNumber,
                cardExpiry,
                cardCvv,
                cardHolderName,
                description,
                userId,
                userEmail,
                metadata = {}
            } = paymentData;

            if (!this.initialized) {
                throw new Error('FlexPay not initialized');
            }

            if (!amount || amount <= 0) {
                throw new Error('Invalid amount');
            }

            // Create transaction record
            const transaction = await this._createTransaction({
                amount,
                currency,
                provider: this.PROVIDERS.CARDS,
                paymentMethod: 'card',
                cardLast4: cardNumber ? cardNumber.slice(-4) : null,
                description,
                userId,
                userEmail,
                status: this.STATUS.PENDING,
                metadata
            });

            // Initiate card payment with FlexPay
            const paymentRequest = {
                amount,
                currency,
                card: {
                    number: cardNumber,
                    expiry: cardExpiry,
                    cvv: cardCvv,
                    holder_name: cardHolderName
                },
                reference: transaction.id,
                callback_url: `${process.env.API_BASE_URL}/api/payments/webhook${process.env.FLEXPAY_WEBHOOK_SECRET ? '?secret=' + process.env.FLEXPAY_WEBHOOK_SECRET : ''}`,
                description: description || `Payment for GlucoSoin services`
            };

            const result = await this.flexpay.card(paymentRequest);

            // Update transaction
            await this._updateTransaction(transaction.id, {
                flexpayReference: result.reference || result.orderNumber,
                status: result.status === 'success' ? this.STATUS.COMPLETED : this.STATUS.PROCESSING,
                flexpayResponse: result
            });

            await auditLogger.logDataModification({
                userId,
                userRole: 'patient',
                resourceType: 'payment',
                resourceId: transaction.id,
                action: 'create',
                changes: { status: 'initiated', provider: 'card', amount },
                success: true
            });

            return {
                success: true,
                transactionId: transaction.id,
                flexpayReference: result.reference || result.orderNumber,
                status: result.status === 'success' ? this.STATUS.COMPLETED : this.STATUS.PROCESSING,
                message: result.status === 'success' ? 'Payment successful' : 'Payment processing',
                data: result
            };
        } catch (error) {
            console.error('Card payment error:', error);

            await auditLogger.logSecurity({
                userId: paymentData.userId,
                userRole: 'patient',
                eventType: 'payment_failed',
                description: `Card payment failed: ${error.message}`,
                severity: 'warning'
            });

            throw error;
        }
    }

    /**
     * Initiate cash payment (manual confirmation)
     * @param {Object} paymentData - Payment details
     * @returns {Promise<Object>} Payment result
     */
    async initiateCashPayment(paymentData) {
        try {
            const {
                amount,
                currency = 'CDF',
                description,
                userId,
                userEmail,
                patientId,
                doctorId,
                locationDetails,
                metadata = {}
            } = paymentData;

            if (!amount || amount <= 0) {
                throw new Error('Invalid amount');
            }

            // Create transaction record for cash payment - auto-completed since cash is in-person
            const transaction = await this._createTransaction({
                amount,
                currency,
                provider: this.PROVIDERS.CASH,
                paymentMethod: 'cash',
                description,
                userId,
                userEmail,
                patientId: patientId || userId,
                doctorId: doctorId || null,
                status: this.STATUS.COMPLETED,
                completedAt: new Date().toISOString(),
                locationDetails,
                metadata
            });

            // Update doctor's totalRevenue (90% goes to doctor)
            if (doctorId) {
                try {
                    const doctorShare = Math.round(amount * 0.9);
                    await db.collection('doctors').doc(String(doctorId)).update({
                        totalRevenue: admin.firestore.FieldValue.increment(doctorShare)
                    });
                } catch (revenueErr) {
                    console.error('Failed to update doctor revenue:', revenueErr);
                }
            }

            await auditLogger.logDataModification({
                userId,
                userRole: 'patient',
                resourceType: 'payment',
                resourceId: transaction.id,
                action: 'create',
                changes: { status: 'completed', method: 'cash', amount },
                success: true
            });

            return {
                success: true,
                transactionId: transaction.id,
                status: this.STATUS.COMPLETED,
                message: 'Paiement en espèces enregistré avec succès.',
                data: {
                    amount,
                    currency,
                    patientId,
                    doctorId
                }
            };
        } catch (error) {
            console.error('Cash payment error:', error);
            throw error;
        }
    }

    /**
     * Check payment status
     * @param {string} transactionId - Transaction ID
     * @returns {Promise<Object>} Payment status
     */
    async checkPaymentStatus(transactionId) {
        try {
            const transaction = await this._getTransaction(transactionId);

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            // If not cash and has FlexPay reference, check with FlexPay
            if (transaction.paymentMethod !== 'cash' && transaction.flexpayReference && this.initialized) {
                try {
                    const status = await this.flexpay.checkStatus(transaction.flexpayReference);

                    // Update local status if changed
                    if (status.status && status.status !== transaction.status) {
                        await this._updateTransaction(transactionId, {
                            status: this._mapFlexPayStatus(status.status),
                            flexpayResponse: status
                        });

                        transaction.status = this._mapFlexPayStatus(status.status);
                    }
                } catch (error) {
                    console.error('FlexPay status check error:', error);
                }
            }

            return {
                transactionId: transaction.id,
                status: transaction.status,
                amount: transaction.amount,
                currency: transaction.currency,
                provider: transaction.provider,
                paymentMethod: transaction.paymentMethod,
                createdAt: transaction.createdAt,
                completedAt: transaction.completedAt,
                flexpayReference: transaction.flexpayReference
            };
        } catch (error) {
            console.error('Status check error:', error);
            throw error;
        }
    }

    /**
     * Confirm cash payment (admin only)
     * @param {string} transactionId - Transaction ID
     * @param {Object} confirmationData - Confirmation details
     * @returns {Promise<Object>} Updated transaction
     */
    async confirmCashPayment(transactionId, confirmationData) {
        try {
            const { confirmedBy, notes } = confirmationData;

            const transaction = await this._getTransaction(transactionId);

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            if (transaction.paymentMethod !== 'cash') {
                throw new Error('Only cash payments can be manually confirmed');
            }

            if (transaction.status === this.STATUS.COMPLETED) {
                throw new Error('Payment already confirmed');
            }

            await this._updateTransaction(transactionId, {
                status: this.STATUS.COMPLETED,
                completedAt: new Date().toISOString(),
                confirmedBy,
                confirmationNotes: notes
            });

            // Notify user
            if (transaction.userEmail) {
                await emailService.sendEmail({
                    to: transaction.userEmail,
                    subject: '✅ Payment Confirmed',
                    text: `
Your cash payment has been confirmed!

Transaction ID: ${transactionId}
Amount: ${transaction.amount} ${transaction.currency}
Status: Completed

Thank you for your payment.
                    `.trim()
                }).catch(err => console.error('Email notification failed:', err));
            }

            await auditLogger.logDataModification({
                userId: confirmedBy,
                userRole: 'admin',
                resourceType: 'payment',
                resourceId: transactionId,
                action: 'confirm',
                changes: { status: 'completed' },
                success: true
            });

            return {
                success: true,
                transactionId,
                status: this.STATUS.COMPLETED,
                message: 'Cash payment confirmed successfully'
            };
        } catch (error) {
            console.error('Cash confirmation error:', error);
            throw error;
        }
    }

    /**
     * Process refund
     * @param {string} transactionId - Transaction ID
     * @param {Object} refundData - Refund details
     * @returns {Promise<Object>} Refund result
     */
    async processRefund(transactionId, refundData) {
        try {
            const { reason, refundedBy } = refundData;

            const transaction = await this._getTransaction(transactionId);

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            if (transaction.status !== this.STATUS.COMPLETED) {
                throw new Error('Only completed transactions can be refunded');
            }

            if (transaction.status === this.STATUS.REFUNDED) {
                throw new Error('Transaction already refunded');
            }

            // Process refund with FlexPay if applicable
            if (transaction.paymentMethod !== 'cash' && transaction.flexpayReference && this.initialized) {
                try {
                    const refundResult = await this.flexpay.refund({
                        reference: transaction.flexpayReference,
                        amount: transaction.amount
                    });

                    await this._updateTransaction(transactionId, {
                        status: this.STATUS.REFUNDED,
                        refundedAt: new Date().toISOString(),
                        refundedBy,
                        refundReason: reason,
                        refundResponse: refundResult
                    });
                } catch (error) {
                    console.error('FlexPay refund error:', error);
                    throw new Error('Refund processing failed');
                }
            } else {
                // Manual refund for cash
                await this._updateTransaction(transactionId, {
                    status: this.STATUS.REFUNDED,
                    refundedAt: new Date().toISOString(),
                    refundedBy,
                    refundReason: reason,
                    requiresManualRefund: true
                });
            }

            // Notify user
            if (transaction.userEmail) {
                await emailService.sendEmail({
                    to: transaction.userEmail,
                    subject: '💰 Refund Processed',
                    text: `
Your payment has been refunded.

Transaction ID: ${transactionId}
Amount: ${transaction.amount} ${transaction.currency}
Reason: ${reason}

${transaction.paymentMethod === 'cash' ? 'Please contact us to arrange cash refund pickup.' : 'The refund will be processed to your original payment method.'}
                    `.trim()
                }).catch(err => console.error('Email notification failed:', err));
            }

            await auditLogger.logDataModification({
                userId: refundedBy,
                userRole: 'admin',
                resourceType: 'payment',
                resourceId: transactionId,
                action: 'refund',
                changes: { status: 'refunded', reason },
                success: true
            });

            return {
                success: true,
                transactionId,
                status: this.STATUS.REFUNDED,
                message: 'Refund processed successfully'
            };
        } catch (error) {
            console.error('Refund error:', error);
            throw error;
        }
    }

    /**
     * Get user transactions
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Transactions
     */
    async getUserTransactions(userId, options = {}) {
        try {
            const { limit = 50, status = null } = options;

            let query = db.collection(this.collectionName)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (status) {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Get transactions error:', error);
            return [];
        }
    }

    /**
     * Get patient transactions
     * @param {string} patientId - Patient ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Transactions
     */
    async getPatientTransactions(patientId, options = {}) {
        try {
            const { limit = 50 } = options;

            const snapshot = await db.collection(this.collectionName)
                .where('patientId', '==', patientId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Get patient transactions error:', error);
            return [];
        }
    }

    // Helper methods

    async _createTransaction(data) {
        // Filter out undefined values (Firestore rejects undefined)
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );
        const transaction = {
            ...cleanData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection(this.collectionName).add(transaction);

        return {
            id: docRef.id,
            ...transaction
        };
    }

    async _getTransaction(transactionId) {
        const doc = await db.collection(this.collectionName).doc(transactionId).get();

        if (!doc.exists) {
            return null;
        }

        return {
            id: doc.id,
            ...doc.data()
        };
    }

    async _updateTransaction(transactionId, updates) {
        await db.collection(this.collectionName).doc(transactionId).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });
    }

    _mapFlexPayStatus(flexpayStatus) {
        const statusMap = {
            'pending': this.STATUS.PENDING,
            'processing': this.STATUS.PROCESSING,
            'success': this.STATUS.COMPLETED,
            'failed': this.STATUS.FAILED,
            'cancelled': this.STATUS.CANCELLED
        };

        return statusMap[flexpayStatus] || this.STATUS.PENDING;
    }
}

module.exports = new FlexPayService();
