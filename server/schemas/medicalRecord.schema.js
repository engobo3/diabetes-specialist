const { z } = require('zod');

const MedicalRecordSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    patientId: z.union([z.string(), z.number()]),
    doctorId: z.union([z.string(), z.number()]).optional(),
    doctorName: z.string().optional(),
    type: z.enum(['diagnosis', 'lab_result', 'procedure', 'clinical_note', 'referral']),
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    date: z.string(),
    metadata: z.record(z.any()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

module.exports = { MedicalRecordSchema };
