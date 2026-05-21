/**
 * Shared schemas for route params, query strings, and other cross-cutting concerns.
 */

const { z } = require('zod');

// Firestore IDs are strings, but some legacy data has numeric IDs. Accept both,
// but require non-empty after coercion to string.
const idString = z.union([z.string(), z.number()])
    .transform(v => String(v))
    .refine(v => v.length > 0 && v.length <= 128, 'Invalid ID format')
    .refine(v => /^[\w@.\-:]+$/.test(v), 'ID contains invalid characters');

// Single :id param — used by most routes
const IdParamSchema = z.object({
    id: idString
});

// :patientId
const PatientIdParamSchema = z.object({
    patientId: idString
});

// :doctorId
const DoctorIdParamSchema = z.object({
    doctorId: idString
});

// :id + :vitalId (patient vital subroute)
const PatientVitalParamSchema = z.object({
    id: idString,
    vitalId: idString
});

// :id + :doctorId (patient/doctor link)
const PatientDoctorParamSchema = z.object({
    id: idString,
    doctorId: idString
});

// :patientId + :caregiverEmail (caregiver routes)
const PatientCaregiverParamSchema = z.object({
    patientId: idString,
    caregiverEmail: z.string().email('Valid caregiver email required')
});

// :messageId
const MessageIdParamSchema = z.object({
    messageId: idString
});

// :transactionId
const TransactionIdParamSchema = z.object({
    transactionId: idString
});

// :sessionId
const SessionIdParamSchema = z.object({
    sessionId: idString
});

// :token (caregiver invitation tokens — opaque strings, allow more chars)
const TokenParamSchema = z.object({
    token: z.string().min(10).max(256).regex(/^[\w\-.]+$/, 'Invalid token format')
});

// :id (invitation route)
const InvitationIdParamSchema = z.object({
    id: idString
});

// :key (specialty config)
const SpecialtyKeyParamSchema = z.object({
    key: z.string().min(1).max(64).regex(/^[\w-]+$/)
});

// :raw (specialty resolve — free-form, but bounded)
const SpecialtyRawParamSchema = z.object({
    raw: z.string().min(1).max(128)
});

// Pagination query
const PaginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    cursor: z.string().max(256).optional()
});

module.exports = {
    idString,
    IdParamSchema,
    PatientIdParamSchema,
    DoctorIdParamSchema,
    PatientVitalParamSchema,
    PatientDoctorParamSchema,
    PatientCaregiverParamSchema,
    MessageIdParamSchema,
    TransactionIdParamSchema,
    SessionIdParamSchema,
    TokenParamSchema,
    InvitationIdParamSchema,
    SpecialtyKeyParamSchema,
    SpecialtyRawParamSchema,
    PaginationQuerySchema
};
