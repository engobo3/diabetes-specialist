const { z } = require('zod');

const AppointmentSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    patientId: z.union([z.string(), z.number()]),
    doctorId: z.union([z.string(), z.number()]).optional(),
    date: z.string(), // ISO Date string
    time: z.string().optional(),
    reason: z.string().optional(),
    status: z.enum(['Scheduled', 'Completed', 'Cancelled', 'No Show', 'Pending', 'pending', 'confirmed', 'rejected', 'completed']).default('pending'),
    type: z.string().optional(), // 'Checkup', 'Consultation' etc.
    notes: z.string().optional(),

    // Joined data might be present in reads
    patientName: z.string().optional(),
    doctorName: z.string().optional(),
});

module.exports = { AppointmentSchema };
