const { z } = require('zod');

const TimeRangeSchema = z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM requis"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM requis")
});

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

    // Availability schedule (weekly recurring)
    availability: z.record(
        z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
        z.array(TimeRangeSchema)
    ).optional(),
    slotDuration: z.number().min(10).max(120).optional(), // minutes, default 30
});

module.exports = { DoctorSchema };
