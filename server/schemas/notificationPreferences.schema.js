const { z } = require('zod');

const NotificationPreferencesSchema = z.object({
    patientId: z.string().min(1),
    vitalReminderEnabled: z.boolean().default(true),
    morningReminderTime: z.string().default('07:00'),
    eveningReminderEnabled: z.boolean().default(false),
    eveningReminderTime: z.string().default('19:00'),
    medicationReminderEnabled: z.boolean().default(true),
    escalationEnabled: z.boolean().default(true),
    escalationDays: z.number().min(1).max(14).default(3),
    updatedAt: z.string().optional(),
});

module.exports = { NotificationPreferencesSchema };
