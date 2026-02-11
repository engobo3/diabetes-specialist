const { z } = require('zod');

// Vitals can be diverse, but we'll schema the common ones
const VitalSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    patientId: z.union([z.string(), z.number()]).optional(), // Might be inferred from parent collection
    date: z.string(), // ISO Date
    type: z.string(), // 'Glucose', 'Blood Pressure', 'Weight', 'Heart Rate'
    category: z.string().optional(), // Same as type, used for filtering vitals
    value: z.string().or(z.number()).optional(), // Optional for Blood Pressure (uses systolic/diastolic instead)
    glucose: z.number().optional(), // Numeric glucose value for chart rendering
    unit: z.string().optional(),
    notes: z.string().optional(),
    subtype: z.string().optional(), // e.g. 'Fasting', 'Post-meal' for glucose
    systolic: z.number().optional(), // For blood pressure
    diastolic: z.number().optional(), // For blood pressure
});

module.exports = { VitalSchema };
