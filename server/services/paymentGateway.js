const axios = require('axios');

class PaymentGateway {
    constructor() {
        this.provider = process.env.PAYMENT_PROVIDER || 'MOCK'; // 'MOCK', 'FLEXPAY', 'MAXICASH'
        console.log(`Payment Gateway initialized with provider: ${this.provider}`);
    }

    async processPayment(paymentData) {
        switch (this.provider.toUpperCase()) {
            case 'FLEXPAY':
                return this._processFlexPay(paymentData);
            case 'MAXICASH':
                return this._processMaxiCash(paymentData);
            case 'MOCK':
            default:
                return this._processMock(paymentData);
        }
    }

    // --- MOCK PROVIDER (Simulation) ---
    async _processMock(data) {
        console.log("Mock Gateway: Processing payment...", data);

        // Simulate network delay
        if (data.method !== 'Cash') {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Simulate USSD Push behavior
        if (['M-Pesa', 'Orange Money', 'Airtel Money'].includes(data.method) && !data.phoneNumber) {
            throw new Error("Phone number required for Mobile Money");
        }

        return {
            success: true,
            transactionId: `MOCK-${Date.now()}`,
            status: 'Completed',
            providerMessage: 'Mock payment successful'
        };
    }

    // --- FLEXPAY PROVIDER (Real Implementation Stub) ---
    async _processFlexPay(data) {
        console.log("FlexPay Gateway: Initiating...", data);

        if (!process.env.FLEXPAY_TOKEN || !process.env.FLEXPAY_MERCHANT) {
            throw new Error("Missing FlexPay credentials in environment variables");
        }

        try {
            // NOTE: This is the standard FlexPay API structure. 
            // In a real scenario, you would uncomment this axios call.

            /*
            const response = await axios.post('https://api.flexpay.cd/v1/pay', {
                items: [{ name: data.item, price: data.amount, currency: data.currency }],
                merchant: process.env.FLEXPAY_MERCHANT,
                users: process.env.FLEXPAY_MERCHANT, // Sometimes used for callback reference
                phone: data.phoneNumber,
                description: data.description
            }, {
                headers: { 'Authorization': `Bearer ${process.env.FLEXPAY_TOKEN}` }
            });
            return {
                success: response.data.success,
                transactionId: response.data.transactionCode,
                status: response.data.status, // e.g., 'UNK' (Unknown/Pending) until callback
                providerMessage: response.data.message
            };
            */

            // For now, if someone accidentally switches to FlexPay without keys, we error out safely or mock if forced.
            throw new Error("FlexPay integration is ready but requires active API Credentials.");

        } catch (error) {
            console.error("FlexPay Error:", error.message);
            throw new Error(`Payment Gateway Error: ${error.message}`);
        }
    }

    // --- MAXICASH PROVIDER (Placeholder) ---
    async _processMaxiCash(data) {
        throw new Error("MaxiCash integration not yet configured.");
    }
}

module.exports = new PaymentGateway();
