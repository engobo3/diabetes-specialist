// --- Mock firebase-admin ---
const mockSendEachForMulticast = jest.fn();
jest.mock('firebase-admin', () => ({
    messaging: jest.fn(() => ({
        sendEachForMulticast: mockSendEachForMulticast
    }))
}));

// --- Mock firebaseConfig (db) ---
const mockCollectionGet = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn();
const mockTokenDocsGet = jest.fn();

const mockDb = {
    collection: jest.fn((name) => {
        if (name === 'fcm_tokens') {
            return {
                where: jest.fn(() => ({
                    get: mockCollectionGet.mockResolvedValue({ empty: true, docs: [] })
                })),
            };
        }
        return { doc: jest.fn(), where: jest.fn() };
    }),
    batch: jest.fn(() => ({
        delete: mockBatchDelete,
        commit: mockBatchCommit.mockResolvedValue(undefined)
    }))
};

jest.mock('../config/firebaseConfig', () => ({
    db: mockDb
}));

const { sendPushToUser } = require('../services/pushNotificationService');

describe('pushNotificationService.sendPushToUser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the where chain mock
        mockDb.collection.mockImplementation((name) => {
            if (name === 'fcm_tokens') {
                return {
                    where: jest.fn(() => ({
                        get: mockCollectionGet
                    })),
                };
            }
            return { doc: jest.fn(), where: jest.fn() };
        });
    });

    it('returns early when no tokens found for user', async () => {
        mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

        const result = await sendPushToUser('user_123', {
            title: 'Test', body: 'Body'
        });

        expect(result).toBeUndefined();
        expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });

    it('calls sendEachForMulticast with correct payload when tokens exist', async () => {
        mockCollectionGet.mockResolvedValue({
            empty: false,
            docs: [
                { data: () => ({ token: 'token_abc' }) },
                { data: () => ({ token: 'token_def' }) }
            ]
        });

        mockSendEachForMulticast.mockResolvedValue({
            failureCount: 0,
            responses: [{ success: true }, { success: true }]
        });

        await sendPushToUser('user_123', {
            title: 'Rappel', body: 'Saisir vos mesures', data: { patientId: 'p1' }
        });

        expect(mockSendEachForMulticast).toHaveBeenCalledWith(expect.objectContaining({
            notification: { title: 'Rappel', body: 'Saisir vos mesures' },
            tokens: ['token_abc', 'token_def']
        }));
    });

    it('stringifies data values in the message', async () => {
        mockCollectionGet.mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ token: 'token_1' }) }]
        });

        mockSendEachForMulticast.mockResolvedValue({
            failureCount: 0,
            responses: [{ success: true }]
        });

        await sendPushToUser('user_123', {
            title: 'Test', body: 'Body', data: { count: 42, flag: true }
        });

        const call = mockSendEachForMulticast.mock.calls[0][0];
        expect(call.data.count).toBe('42');
        expect(call.data.flag).toBe('true');
    });

    it('cleans up tokens with messaging/invalid-registration-token error', async () => {
        mockCollectionGet
            .mockResolvedValueOnce({
                empty: false,
                docs: [
                    { data: () => ({ token: 'good_token' }) },
                    { data: () => ({ token: 'bad_token' }) }
                ]
            })
            .mockResolvedValueOnce({
                // Second call for token cleanup query
                docs: [{ ref: { id: 'bad_token' } }],
                forEach: function(fn) { this.docs.forEach(fn); }
            });

        mockSendEachForMulticast.mockResolvedValue({
            failureCount: 1,
            responses: [
                { success: true },
                { success: false, error: { code: 'messaging/invalid-registration-token' } }
            ]
        });

        // Need to mock the where chain for the cleanup query
        mockDb.collection.mockImplementation((name) => ({
            where: jest.fn(() => ({
                get: mockCollectionGet
            })),
        }));

        await sendPushToUser('user_123', { title: 'Test', body: 'Body' });

        expect(mockBatchDelete).toHaveBeenCalled();
        expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('cleans up tokens with messaging/registration-token-not-registered error', async () => {
        mockCollectionGet
            .mockResolvedValueOnce({
                empty: false,
                docs: [{ data: () => ({ token: 'expired_token' }) }]
            })
            .mockResolvedValueOnce({
                docs: [{ ref: { id: 'expired_token' } }],
                forEach: function(fn) { this.docs.forEach(fn); }
            });

        mockSendEachForMulticast.mockResolvedValue({
            failureCount: 1,
            responses: [
                { success: false, error: { code: 'messaging/registration-token-not-registered' } }
            ]
        });

        mockDb.collection.mockImplementation((name) => ({
            where: jest.fn(() => ({
                get: mockCollectionGet
            })),
        }));

        await sendPushToUser('user_123', { title: 'Test', body: 'Body' });

        expect(mockBatchDelete).toHaveBeenCalled();
    });

    it('does not delete tokens for other error codes', async () => {
        mockCollectionGet.mockResolvedValueOnce({
            empty: false,
            docs: [{ data: () => ({ token: 'token_1' }) }]
        });

        mockSendEachForMulticast.mockResolvedValue({
            failureCount: 1,
            responses: [
                { success: false, error: { code: 'messaging/internal-error' } }
            ]
        });

        await sendPushToUser('user_123', { title: 'Test', body: 'Body' });

        expect(mockBatchDelete).not.toHaveBeenCalled();
    });

    it('returns null on messaging error without throwing', async () => {
        mockCollectionGet.mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ token: 'token_1' }) }]
        });

        mockSendEachForMulticast.mockRejectedValue(new Error('Messaging service unavailable'));

        const result = await sendPushToUser('user_123', { title: 'Test', body: 'Body' });

        expect(result).toBeNull();
    });
});

describe('pushNotificationService with null db', () => {
    it('returns early when db is null', async () => {
        // Temporarily replace db with null
        const firebaseConfig = require('../config/firebaseConfig');
        const originalDb = firebaseConfig.db;
        firebaseConfig.db = null;

        // Re-require module to pick up null db
        jest.resetModules();
        jest.mock('firebase-admin', () => ({
            messaging: jest.fn(() => ({
                sendEachForMulticast: jest.fn()
            }))
        }));
        jest.mock('../config/firebaseConfig', () => ({ db: null }));

        const { sendPushToUser: freshSend } = require('../services/pushNotificationService');
        const result = await freshSend('user_123', { title: 'Test', body: 'Body' });

        expect(result).toBeUndefined();

        // Restore
        firebaseConfig.db = originalDb;
    });
});
