const { z } = require('zod');

// Vitals can be diverse, but we'll schema the common ones
const VitalSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    patientId: z.union([z.string(), z.number()]).optional(), // Might be inferred from parent collection
    date: z.string(), // ISO Date
    type: z.string(), // 'Blood Sugar', 'Blood Pressure', etc.
    value: z.string().or(z.number()),
    unit: z.string().optional(),
    notes: z.string().optional(),
});

module.exports = { VitalSchema };
