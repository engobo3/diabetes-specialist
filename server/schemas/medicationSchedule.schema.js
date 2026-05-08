const { z } = require('zod');

const MedicationScheduleSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    patientId: z.union([z.string(), z.number()]),
    medication: z.string().min(1, "Le nom du medicament est requis"),
    dosage: z.string().min(1, "Le dosage est requis"),
    times: z.array(z.string()).min(1, "Au moins une heure est requise"), // ["08:00", "20:00"]
    frequency: z.enum(['daily', 'twice_daily', 'three_times', 'weekly', 'custom']).default('daily'),
    startDate: z.string().min(1, "La date de debut est requise"),
    endDate: z.string().optional(),
    active: z.boolean().default(true),
    notes: z.string().optional(),
    createdBy: z.string().optional(), // doctorId who prescribed
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

module.exports = { MedicationScheduleSchema };
