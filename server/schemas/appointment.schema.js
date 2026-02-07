const { z } = require('zod');

const AppointmentSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    patientId: z.union([z.string(), z.number()]),
    doctorId: z.union([z.string(), z.number()]),
    date: z.string(), // ISO Date string
    status: z.enum(['Scheduled', 'Completed', 'Cancelled', 'No Show', 'Pending']).default('Scheduled'),
    type: z.string().optional(), // 'Checkup', 'Consultation' etc.
    notes: z.string().optional(),

    // Joined data might be present in reads
    patientName: z.string().optional(),
    doctorName: z.string().optional(),
});

module.exports = { AppointmentSchema };
