/**
 * Schemas for the patient-facing reminder endpoints (Phase 5).
 */

const { z } = require('zod');

const AckSchema = z.object({
    status: z.enum(['taken', 'skipped'])
});

const SnoozeSchema = z.object({
    // 5 minutes to 12 hours; default a quarter-hour.
    minutes: z.coerce.number().int().min(5).max(720).default(15)
});

const ReminderListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional()
});

module.exports = { AckSchema, SnoozeSchema, ReminderListQuerySchema };
