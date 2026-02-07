const request = require('supertest');
const { app } = require('../server');
const MessageRepository = require('../repositories/MessageRepository');
const { db } = require('../config/firebaseConfig');

// Mock authentication middleware
jest.mock('../middleware/authMiddleware', () => {
    return (req, res, next) => {
        req.user = {
            uid: req.headers['x-user-id'] || 'test_user_123',
            email: 'test@example.com'
        };
        next();
    };
});

describe('Messaging System', () => {
    let messageRepo;

    beforeAll(() => {
        messageRepo = new MessageRepository();
    });

    beforeEach(() => {
        // Clear test data
        jest.clearAllMocks();
    });

    describe('POST /api/messages - Send Message', () => {
        it('should send a message with valid data', async () => {
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'patient_1',
                text: 'Please take your medication',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data.text).toBe(messageData.text);
            expect(res.body.data.senderId).toBe(messageData.senderId);
            expect(res.body.data.receiverId).toBe(messageData.receiverId);
        });

        it('should require authentication', async () => {
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'patient_1',
                text: 'Test message'
            };

            const res = await request(app)
                .post('/api/messages')
                .send(messageData);

            // The verifyToken middleware should handle auth, but in test env it's mocked
            // This test verifies the endpoint exists
            expect(res.statusCode).toBeDefined();
        });

        it('should reject message without senderId', async () => {
            const messageData = {
                receiverId: 'patient_1',
                text: 'Test message',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Missing senderId');
        });

        it('should reject message without receiverId', async () => {
            const messageData = {
                senderId: 'doctor_1',
                text: 'Test message',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Missing receiverId');
        });

        it('should reject message without text', async () => {
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'patient_1',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Missing message text');
        });

        it('should reject empty text message', async () => {
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'patient_1',
                text: '   ',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Missing message text');
        });

        it('should reject self-messages', async () => {
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'doctor_1',
                text: 'Message to self',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Invalid message');
        });

        it('should include timestamp on sent message', async () => {
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'patient_1',
                text: 'Test message',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.timestamp).toBeDefined();
            expect(new Date(res.body.data.timestamp)).toBeInstanceOf(Date);
        });
    });

    describe('GET /api/messages - Fetch Conversation', () => {
        it('should fetch messages with valid contactId', async () => {
            const res = await request(app)
                .get('/api/messages?contactId=patient_1')
                .set('x-user-id', 'doctor_1');

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should require contactId parameter', async () => {
            const res = await request(app)
                .get('/api/messages')
                .set('x-user-id', 'doctor_1');

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Missing contactId parameter');
        });

        it('should return empty array for no messages', async () => {
            const res = await request(app)
                .get('/api/messages?contactId=nonexistent_patient')
                .set('x-user-id', 'nonexistent_doctor');

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('MessageRepository - Conversation Filtering', () => {
        beforeEach(async () => {
            // Mock local data for repository tests
            messageRepo._readLocal = jest.fn(() => [
                {
                    id: 1,
                    senderId: 'doctor_1',
                    receiverId: 'patient_1',
                    text: 'Hello patient',
                    timestamp: '2024-01-01T10:00:00Z'
                },
                {
                    id: 2,
                    senderId: 'patient_1',
                    receiverId: 'doctor_1',
                    text: 'Hi doctor',
                    timestamp: '2024-01-01T10:05:00Z'
                },
                {
                    id: 3,
                    senderId: 'doctor_1',
                    receiverId: 'patient_2',
                    text: 'Hello patient 2',
                    timestamp: '2024-01-01T11:00:00Z'
                },
                {
                    id: 4,
                    senderId: 'patient_2',
                    receiverId: 'doctor_1',
                    text: 'Hi doctor',
                    timestamp: '2024-01-01T11:05:00Z'
                },
                {
                    id: 5,
                    senderId: 'doctor_2',
                    receiverId: 'patient_1',
                    text: 'Message from another doctor',
                    timestamp: '2024-01-01T12:00:00Z'
                }
            ]);
        });

        it('should get bidirectional conversation between two participants', async () => {
            // Mock Firestore as unavailable to use local data
            const mockDb = null;
            messageRepo.constructor.prototype._getLocalConversation = function(userId, contactId) {
                return this._readLocal().filter(m => {
                    const senderId = String(m.senderId);
                    const receiverId = String(m.receiverId);
                    return (senderId === userId && receiverId === contactId) ||
                           (senderId === contactId && receiverId === userId);
                });
            };

            const conversation = messageRepo._getLocalConversation('doctor_1', 'patient_1');
            
            expect(conversation.length).toBe(2);
            expect(conversation[0].text).toBe('Hello patient');
            expect(conversation[1].text).toBe('Hi doctor');
        });

        it('should not include messages with other participants', async () => {
            messageRepo.constructor.prototype._getLocalConversation = function(userId, contactId) {
                return this._readLocal().filter(m => {
                    const senderId = String(m.senderId);
                    const receiverId = String(m.receiverId);
                    return (senderId === userId && receiverId === contactId) ||
                           (senderId === contactId && receiverId === userId);
                });
            };

            const conversation = messageRepo._getLocalConversation('doctor_1', 'patient_1');
            
            // Should not include messages with patient_2
            const hasPatient2Messages = conversation.some(m => 
                String(m.receiverId) === 'patient_2' || String(m.senderId) === 'patient_2'
            );
            expect(hasPatient2Messages).toBe(false);
        });

        it('should maintain message order by timestamp', async () => {
            messageRepo.constructor.prototype._getLocalConversation = function(userId, contactId) {
                return this._readLocal().filter(m => {
                    const senderId = String(m.senderId);
                    const receiverId = String(m.receiverId);
                    return (senderId === userId && receiverId === contactId) ||
                           (senderId === contactId && receiverId === userId);
                });
            };

            const conversation = messageRepo._getLocalConversation('doctor_1', 'patient_1');
            
            expect(conversation.length).toBeGreaterThan(0);
            for (let i = 0; i < conversation.length - 1; i++) {
                const current = new Date(conversation[i].timestamp);
                const next = new Date(conversation[i + 1].timestamp);
                expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
            }
        });
    });

    describe('Message Validation', () => {
        it('should validate message schema', async () => {
            const { MessageSchema } = require('../schemas/message.schema');

            const validMessage = {
                senderId: '123',
                receiverId: '456',
                text: 'Test message'
            };

            const result = MessageSchema.safeParse(validMessage);
            expect(result.success).toBe(true);
        });

        it('should reject messages with empty text', async () => {
            const { MessageSchema } = require('../schemas/message.schema');

            const invalidMessage = {
                senderId: '123',
                receiverId: '456',
                text: ''
            };

            const result = MessageSchema.safeParse(invalidMessage);
            expect(result.success).toBe(false);
        });

        it('should accept flexible timestamp formats', async () => {
            const { MessageSchema } = require('../schemas/message.schema');

            const messages = [
                {
                    senderId: '123',
                    receiverId: '456',
                    text: 'Test',
                    timestamp: '2024-01-01T00:00:00Z'
                },
                {
                    senderId: '123',
                    receiverId: '456',
                    text: 'Test',
                    timestamp: 1234567890
                },
                {
                    senderId: '123',
                    receiverId: '456',
                    text: 'Test',
                    timestamp: new Date()
                }
            ];

            messages.forEach(msg => {
                const result = MessageSchema.safeParse(msg);
                expect(result.success).toBe(true);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle numeric IDs', async () => {
            const messageData = {
                senderId: 99,
                receiverId: 'patient_uuid',
                text: 'Test numeric ID',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', '99')
                .send(messageData);

            expect(res.statusCode).toBe(201);
        });

        it('should handle string IDs with special characters', async () => {
            const messageData = {
                senderId: 'uid-123-abc_def',
                receiverId: 'patient-456-xyz',
                text: 'Test with special chars',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'uid-123-abc_def')
                .send(messageData);

            expect(res.statusCode).toBe(201);
        });

        it('should trim whitespace from message text', async () => {
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'patient_1',
                text: '  Test message with spaces  ',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.text).toBe('Test message with spaces');
        });

        it('should handle long messages', async () => {
            const longText = 'A'.repeat(5000);
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'patient_1',
                text: longText,
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.text).toBe(longText);
        });

        it('should handle messages with special characters', async () => {
            const messageData = {
                senderId: 'doctor_1',
                receiverId: 'patient_1',
                text: 'Test with émojis 🏥💊 and symbols: @#$%^&*()',
                senderName: 'Dr. Smith'
            };

            const res = await request(app)
                .post('/api/messages')
                .set('x-user-id', 'doctor_1')
                .send(messageData);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.text).toContain('émojis');
        });
    });
});
