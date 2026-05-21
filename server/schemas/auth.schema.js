/**
 * Schemas for authentication and patient activation flows.
 */

const { z } = require('zod');

// Email-or-phone identifier — activation endpoints accept either.
// We coerce to string and require minimum length, but don't insist on email format,
// because phone numbers don't match the email regex.
const emailOrPhone = z.string().min(3).max(254);

const ActivationVerifySchema = z.object({
    email: emailOrPhone,
    code: z.string().length(6, 'Activation code must be exactly 6 characters').regex(/^\d{6}$/, 'Code must be 6 digits')
});

const ActivationResendSchema = z.object({
    email: emailOrPhone
});

const ActivationCompleteSchema = z.object({
    email: emailOrPhone
});

const PatientDocumentSchema = z.object({
    name: z.string().min(1).max(256),
    url: z.string().url().max(2048),
    type: z.string().min(1).max(64).optional(),
    size: z.number().int().nonnegative().optional(),
    uploadedAt: z.string().optional(),
    notes: z.string().max(2048).optional()
});

const PatientDoctorLinkSchema = z.object({
    doctorId: z.union([z.string(), z.number()]).transform(v => String(v))
});

const AppointmentUpdateSchema = z.object({
    status: z.enum(['confirmed', 'rejected', 'completed', 'pending', 'cancelled']).optional(),
    notes: z.string().max(4096).optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    reason: z.string().max(2048).optional()
}).refine(obj => Object.keys(obj).length > 0, 'Update body must include at least one field');

const MessageBodySchema = z.object({
    // senderId is verified against req.user in the controller — we keep it in the
    // schema as optional to preserve the existing client API, but the controller
    // is the source of truth on whether a client can impersonate another user.
    senderId: z.union([z.string(), z.number()]).optional(),
    senderName: z.string().max(256).optional(),
    receiverId: z.union([z.string(), z.number()]),
    text: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
    timestamp: z.union([z.string(), z.date(), z.number()]).optional(),
    appointmentId: z.union([z.string(), z.number()]).optional(),
    conversationId: z.string().optional()
});

const RegisterFcmTokenSchema = z.object({
    token: z.string().min(10).max(4096),
    platform: z.enum(['web', 'ios', 'android']).optional()
});

const AIChatSchema = z.object({
    message: z.string().min(1).max(8000),
    history: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system', 'model']),
        text: z.string()
    })).max(50).optional(),
    patientContext: z.record(z.any()).optional(),
    role: z.string().optional(),
    lang: z.enum(['fr', 'ln', 'sw', 'tsh', 'kg', 'en']).optional(),
    patientId: z.union([z.string(), z.number()]).optional(),
    doctorId: z.union([z.string(), z.number()]).optional()
});

const AIForecastSchema = z.object({
    history: z.array(z.object({
        date: z.string(),
        value: z.number()
    })).min(3, 'Need at least 3 data points for forecasting'),
    type: z.string().min(1)
});

const AIAnalyzeHealthSchema = z.object({
    patientData: z.record(z.any()),
    vitals: z.record(z.any()),
    prescriptions: z.array(z.any()).optional(),
    timeframe: z.string().optional()
});

const FootRiskPredictSchema = z.object({
    factors: z.record(z.any()).optional(),
    history: z.record(z.any()).optional()
}).passthrough(); // ML inputs vary — keep flexible but bounded by route validation

const FootRiskWoundSchema = z.object({
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().max(8 * 1024 * 1024).optional(),  // 8MB hard cap
    notes: z.string().max(2048).optional()
}).refine(d => d.imageUrl || d.imageBase64, 'Either imageUrl or imageBase64 is required');

const TwoFactorVerifySchema = z.object({
    userId: z.string().min(1),
    token: z.string().min(4).max(16)
});

const TwoFactorTokenOnlySchema = z.object({
    token: z.string().min(4).max(16)
});

const TwoFactorDisableSchema = z.object({
    token: z.string().min(4).max(16),
    password: z.string().min(1).optional()
});

const SessionCreateSchema = z.object({
    deviceInfo: z.object({
        userAgent: z.string().max(512).optional(),
        platform: z.string().max(64).optional(),
        ip: z.string().max(64).optional()
    }).optional()
});

const PaymentMobileMoneySchema = z.object({
    amount: z.number().positive().max(1_000_000),
    phoneNumber: z.string().min(6).max(20),
    provider: z.enum(['mpesa', 'airtel', 'orange', 'africell', 'vodacom']),
    description: z.string().max(512).optional(),
    currency: z.enum(['USD', 'CDF']).optional(),
    patientId: z.union([z.string(), z.number()]).optional()
});

const PaymentCardSchema = z.object({
    amount: z.number().positive().max(1_000_000),
    cardNumber: z.string().min(13).max(19).regex(/^\d+$/),
    cardExpiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Expected MM/YY'),
    cardCvv: z.string().regex(/^\d{3,4}$/),
    cardHolderName: z.string().min(1).max(128),
    description: z.string().max(512).optional(),
    currency: z.enum(['USD', 'CDF']).optional(),
    patientId: z.union([z.string(), z.number()]).optional()
});

const PaymentCashSchema = z.object({
    amount: z.number().positive().max(1_000_000),
    description: z.string().max(512).optional(),
    locationDetails: z.string().max(512).optional(),
    currency: z.enum(['USD', 'CDF']).optional(),
    patientId: z.union([z.string(), z.number()]).optional()
});

const PaymentConfirmSchema = z.object({
    notes: z.string().max(2048).optional()
});

const PaymentRefundSchema = z.object({
    reason: z.string().min(1).max(2048)
});

module.exports = {
    ActivationVerifySchema,
    ActivationResendSchema,
    ActivationCompleteSchema,
    PatientDocumentSchema,
    PatientDoctorLinkSchema,
    AppointmentUpdateSchema,
    MessageBodySchema,
    RegisterFcmTokenSchema,
    AIChatSchema,
    AIForecastSchema,
    AIAnalyzeHealthSchema,
    FootRiskPredictSchema,
    FootRiskWoundSchema,
    TwoFactorVerifySchema,
    TwoFactorTokenOnlySchema,
    TwoFactorDisableSchema,
    SessionCreateSchema,
    PaymentMobileMoneySchema,
    PaymentCardSchema,
    PaymentCashSchema,
    PaymentConfirmSchema,
    PaymentRefundSchema
};
