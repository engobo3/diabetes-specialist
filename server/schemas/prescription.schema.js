const { z } = require('zod');

const PrescriptionSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    patientId: z.union([z.string(), z.number()]),
    doctorName: z.string(), // Often stored directly
    medication: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(['Active', 'Completed', 'Discontinued']).default('Active'),
    notes: z.string().optional(),
});

module.exports = { PrescriptionSchema };
