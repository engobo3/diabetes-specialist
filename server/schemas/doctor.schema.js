const { z } = require('zod');

const DoctorSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1, "Name is required"),
    specialty: z.string().min(1, "Specialty is required"),
    bio: z.string().optional(),
    image: z.string().url().optional().or(z.literal('')), // Validate URL if present

    // Contact info might be nested
    contact: z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional()
    }).optional(),

    education: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),

    city: z.string().min(1, "City is required"),
    role: z.string().optional(), // 'doctor', 'admin'
});

module.exports = { DoctorSchema };
