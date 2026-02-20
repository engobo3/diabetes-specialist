/**
 * Safe error message utility
 * Prevents leaking internal details (Firestore paths, stack traces) to clients.
 * In dev/test, original messages pass through for debugging.
 */

const SAFE_MESSAGES = [
    'Invalid amount',
    'Phone number is required for mobile money',
    'FlexPay not initialized',
    'FlexPay not initialized. Check API token configuration.',
    'Transaction not found',
    'Only cash payments can be manually confirmed',
    'Payment already confirmed',
    'Only completed transactions can be refunded',
    'Transaction already refunded',
    'Refund processing failed',
    'Missing transaction reference',
    'Email query parameter required',
    'Invitation not found',
    'Error creating invitation',
    'Error fetching invitations',
    'Error fetching caregivers',
    'Unauthorized',
    'Unauthorized: Can only invite caregivers for your own account',
    'Unauthorized: Only patients and doctors can send invitations',
    'Unauthorized: Only doctors can approve invitations',
    'Doctor ID required',
];

function safeErrorMessage(error, fallback = 'An unexpected error occurred') {
    const msg = error?.message || String(error);

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        return msg;
    }

    if (SAFE_MESSAGES.includes(msg)) {
        return msg;
    }

    return fallback;
}

module.exports = { safeErrorMessage };
