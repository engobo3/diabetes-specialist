const { z } = require('zod');

const PatientSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1, "Name is required"),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    age: z.coerce.number().min(0).optional(),
    type: z.enum(['Type 1', 'Type 2', 'Gestational', 'Pre-diabetes', 'Other']).optional(),
    status: z.string().optional(),
    lastVisit: z.string().optional(), // ISO Date string
    doctorId: z.union([z.string(), z.number()]).optional(),
    uid: z.string().optional(), // Firebase Auth UID

    // Caregiver relationships
    caregivers: z.array(z.object({
        email: z.string().email(),
        relationship: z.enum(['parent', 'guardian', 'spouse', 'adult_child', 'sibling', 'caregiver']).optional(),
        addedAt: z.string().optional(), // ISO Date string
        addedBy: z.string().optional(), // 'patient' | 'doctor' | doctorId
        permissions: z.object({
            viewVitals: z.boolean().default(true),
            viewAppointments: z.boolean().default(true),
            viewPrescriptions: z.boolean().default(true),
            requestAppointments: z.boolean().default(false),
            addVitals: z.boolean().default(false),
            viewDocuments: z.boolean().default(true),
            viewPayments: z.boolean().default(false)
        }).optional(),
        status: z.enum(['active', 'suspended']).default('active').optional()
    })).optional(),

    // Derived/Attached fields (optional, used in responses)
    doctorName: z.string().optional(),
    doctorPhoto: z.string().nullable().optional(),
    doctorSpecialty: z.string().optional(),

    // Sub-collections or embedded arrays might be handled separately, 
    // but for simple validation of the main object:
    documents: z.array(z.any()).optional(),
});

module.exports = { PatientSchema };
