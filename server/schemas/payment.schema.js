const { z } = require('zod');

const PaymentSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    patientId: z.union([z.string(), z.number()]),
    amount: z.number().min(0),
    currency: z.string().default('USD'),
    date: z.string(),
    status: z.enum(['Paid', 'Pending', 'Failed']).default('Pending'),
    method: z.string().optional(), // 'Credit Card', 'Cash', etc.
    description: z.string().optional(),
});

module.exports = { PaymentSchema };
