// --- Mock NotificationRepository ---
const mockCreateNotification = jest.fn();
jest.mock('../repositories/NotificationRepository', () => {
    return jest.fn().mockImplementation(() => ({
        createNotification: mockCreateNotification
    }));
});

// --- Mock pushNotificationService ---
const mockSendPush = jest.fn();
jest.mock('./../../server/services/pushNotificationService', () => ({
    sendPushToUser: mockSendPush
}), { virtual: true });

// Re-mock with correct relative path
jest.mock('../services/pushNotificationService', () => ({
    sendPushToUser: mockSendPush
}));

// Need to clear module cache and re-require after mocks
let createNotification;

beforeAll(() => {
    const service = require('../services/notificationService');
    createNotification = service.createNotification;
});

describe('notificationService.createNotification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateNotification.mockResolvedValue({ id: 'notif_1', read: false });
        mockSendPush.mockResolvedValue({ successCount: 1 });
    });

    it('creates in-app notification via repository', async () => {
        await createNotification({
            userId: 'user_123',
            type: 'appointment_new',
            title: 'Nouveau RDV',
            body: 'Un patient demande un RDV.',
            data: { appointmentId: 'apt_1' }
        });

        expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user_123',
            type: 'appointment_new',
            title: 'Nouveau RDV',
            body: 'Un patient demande un RDV.'
        }));
    });

    it('sends push notification via sendPushToUser', async () => {
        await createNotification({
            userId: 'user_123',
            type: 'vital_reminder',
            title: 'Rappel',
            body: 'Saisir vos mesures.',
            data: { patientId: 'p1' }
        });

        expect(mockSendPush).toHaveBeenCalledWith('user_123', {
            title: 'Rappel',
            body: 'Saisir vos mesures.',
            data: { patientId: 'p1' }
        });
    });

    it('passes empty object when data is undefined', async () => {
        await createNotification({
            userId: 'user_123',
            type: 'system',
            title: 'Info',
            body: 'System notification.'
        });

        expect(mockSendPush).toHaveBeenCalledWith('user_123', {
            title: 'Info',
            body: 'System notification.',
            data: {}
        });
    });

    it('does not throw when push notification fails (fire-and-forget)', async () => {
        mockSendPush.mockRejectedValue(new Error('Push service down'));

        const result = await createNotification({
            userId: 'user_123',
            type: 'system',
            title: 'Test',
            body: 'Test body'
        });

        // Should still return the in-app notification result
        expect(result).toEqual({ id: 'notif_1', read: false });
    });

    it('returns null when repository fails (non-throwing)', async () => {
        mockCreateNotification.mockRejectedValue(new Error('DB error'));

        const result = await createNotification({
            userId: 'user_123',
            type: 'system',
            title: 'Test',
            body: 'Test body'
        });

        expect(result).toBeNull();
    });
});
