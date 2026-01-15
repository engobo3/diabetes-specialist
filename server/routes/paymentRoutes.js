const express = require('express');
const router = express.Router();
const dbService = require('../services/database');

// GET /api/payments/:patientId - Get payment history
router.get('/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        const payments = await dbService.getPayments(patientId);
        res.json(payments);
    } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ error: "Failed to fetch payments" });
    }
});

const PaymentGateway = require('../services/paymentGateway');

// POST /api/payments - Record a new payment
router.post('/', async (req, res) => {
    try {
        const { patientId, doctorId, amount, currency, method, status, date, description, item, phoneNumber } = req.body;

        if (!patientId || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 1. Process via Gateway (MOCK or REAL)
        let gatewayResult = { status: 'Completed', transactionId: null };

        // Only process via gateway if it's NOT cash (Cash is immediate)
        if (method !== 'Cash') {
            try {
                // Pass relevant data to the gateway
                gatewayResult = await PaymentGateway.processPayment({
                    amount,
                    currency,
                    method,
                    phoneNumber,
                    description,
                    item
                });
            } catch (gatewayError) {
                console.error("Gateway Error:", gatewayError);
                return res.status(400).json({ error: gatewayError.message });
            }
        }

        // 2. Create Database Record
        const newPayment = {
            patientId: String(patientId),
            amount: Number(amount),
            currency: currency || 'CDF',
            method: method || 'Cash',
            phoneNumber: phoneNumber || null,
            status: gatewayResult.status || 'Completed',
            providerTransactionId: gatewayResult.transactionId || null,
            date: date || new Date().toISOString(),
            description: description || 'Medical Service',
            item: item || 'General Consultation',
            doctorId: doctorId || null,
            doctorShare: doctorId ? Number(amount) * 0.9 : 0,
            platformShare: doctorId ? Number(amount) * 0.1 : Number(amount)
        };

        const createdPayment = await dbService.createPayment(newPayment);

        // Update Doctor Revenue (fire and forget or await)
        if (doctorId && typeof dbService.createPayment === 'function') {
            // We need direct access to Firestore to update the doctor atomically
            // We can import the firestore instance here
            const { db } = require('../config/firebase');
            if (db) {
                try {
                    const doctorRef = db.collection('doctors').doc(String(doctorId));
                    await db.runTransaction(async (t) => {
                        const doc = await t.get(doctorRef);
                        if (doc.exists) {
                            const currentRevenue = doc.data().totalRevenue || 0;
                            t.update(doctorRef, {
                                totalRevenue: currentRevenue + newPayment.doctorShare
                            });
                        }
                    });
                    console.log(`Updated revenue for doctor ${doctorId}: +${newPayment.doctorShare}`);
                } catch (err) {
                    console.error("Failed to update doctor revenue:", err);
                }
            }
        }

        res.status(201).json(createdPayment);

    } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({ error: "Failed to create payment" });
    }
});

module.exports = router;
