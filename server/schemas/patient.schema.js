const { z } = require('zod');

const PatientSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1, "Name is required"),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    age: z.coerce.number().min(0).optional(),
    type: z.enum(['Type 1', 'Type 2', 'Gestational', 'Prediabetes', 'Other']).optional(),
    status: z.string().optional(),
    lastVisit: z.string().optional(), // ISO Date string
    doctorId: z.union([z.string(), z.number()]).optional(),
    doctorIds: z.array(z.union([z.string(), z.number()])).optional(),
    uid: z.string().optional(), // Firebase Auth UID

    // Clinical context — optional free-form fields used in chart and AI summaries
    notes: z.string().max(8000).optional(),
    gender: z.enum(['male', 'female', 'other', 'unknown', 'Male', 'Female', 'Other', '']).optional(),
    dateOfBirth: z.string().optional(),
    bloodType: z.string().max(8).optional(),
    height: z.union([z.string(), z.number()]).optional(),
    weight: z.union([z.string(), z.number()]).optional(),
    address: z.string().max(512).optional(),
    city: z.string().max(128).optional(),
    conditions: z.array(z.string().max(256)).max(50).optional(),
    allergies: z.array(z.string().max(256)).max(50).optional(),
    emergencyContact: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        relationship: z.string().optional()
    }).optional(),
    insurance: z.object({
        provider: z.string().optional(),
        policyNumber: z.string().optional()
    }).optional(),

    // Activation code system
    activationCode: z.string().length(6).nullable().optional(),
    activationCodeExpiry: z.string().nullable().optional(),
    activated: z.boolean().default(false).optional(),

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
    doctors: z.array(z.object({
        id: z.union([z.string(), z.number()]),
        name: z.string(),
        photo: z.string().nullable().optional(),
        specialty: z.string().optional(),
    })).optional(),

    // Sub-collections or embedded arrays might be handled separately, 
    // but for simple validation of the main object:
    documents: z.array(z.any()).optional(),
});

module.exports = { PatientSchema };
