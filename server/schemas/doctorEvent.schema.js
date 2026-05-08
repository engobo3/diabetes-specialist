const { z } = require('zod');

const DoctorEventSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    doctorId: z.union([z.string(), z.number()]),
    title: z.string().min(1, "Title is required"),
    category: z.enum([
        'break', 'lunch', 'meeting', 'admin', 'personal',
        'vacation', 'conference', 'sick', 'other'
    ]),
    date: z.string(),        // YYYY-MM-DD
    startTime: z.string(),   // HH:MM
    endTime: z.string(),     // HH:MM
    allDay: z.boolean().default(false),
    notes: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

module.exports = { DoctorEventSchema };
