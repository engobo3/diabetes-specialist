const { z } = require('zod');

const NotificationSchema = z.object({
    userId: z.string().min(1, "userId is required"),
    type: z.enum([
        'appointment_confirmed',
        'appointment_rejected',
        'appointment_new',
        'appointment_reminder',
        'vital_reminder',
        'new_patient_data',
        'system'
    ]),
    title: z.string().min(1),
    body: z.string().min(1),
    read: z.boolean().default(false),
    data: z.record(z.any()).optional(), // flexible metadata
    createdAt: z.string().optional() // ISO date string, set server-side
});

module.exports = { NotificationSchema };
