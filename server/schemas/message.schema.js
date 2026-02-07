const { z } = require('zod');

const MessageSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    senderId: z.union([z.string(), z.number()]),
    receiverId: z.union([z.string(), z.number()]),
    text: z.string().min(1, "Message content cannot be empty"),
    timestamp: z.union([z.string(), z.date(), z.number()]).optional(), // Flexible timestamp
    read: z.boolean().optional().default(false),

    // Sender/Receiver might be joined
    senderName: z.string().optional(),
    receiverName: z.string().optional(),
});

module.exports = { MessageSchema };
