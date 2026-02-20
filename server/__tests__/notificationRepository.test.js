const path = require('path');
const fs = require('fs');

// Force local-file fallback by mocking db as null
jest.mock('../config/firebaseConfig', () => ({ db: null }));

const NotificationRepository = require('../repositories/NotificationRepository');

describe('NotificationRepository (local fallback)', () => {
    let repo;
    const dataDir = path.join(__dirname, '..', 'data');
    const dataFile = path.join(dataDir, 'notifications.json');

    // Seed data for tests
    const seedNotifications = [
        { id: 1, userId: 'user_A', type: 'appointment_new', title: 'RDV 1', body: 'Body 1', read: false, createdAt: '2026-03-10T08:00:00Z' },
        { id: 2, userId: 'user_A', type: 'vital_reminder', title: 'Rappel', body: 'Body 2', read: true, createdAt: '2026-03-10T07:00:00Z' },
        { id: 3, userId: 'user_A', type: 'system', title: 'Info', body: 'Body 3', read: false, createdAt: '2026-03-10T09:00:00Z' },
        { id: 4, userId: 'user_B', type: 'appointment_confirmed', title: 'RDV OK', body: 'Body 4', read: false, createdAt: '2026-03-10T06:00:00Z' },
        { id: 5, userId: 'user_A', type: 'appointment_rejected', title: 'RDV Refusé', body: 'Body 5', read: false, createdAt: '2026-03-09T12:00:00Z' },
    ];

    beforeEach(() => {
        repo = new NotificationRepository();
        // Ensure data directory exists and write seed data
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(dataFile, JSON.stringify(seedNotifications, null, 2));
    });

    afterAll(() => {
        // Cleanup test data
        if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    });

    describe('findByUserId', () => {
        it('returns notifications for the given userId sorted by createdAt desc', async () => {
            const results = await repo.findByUserId('user_A');

            expect(results.length).toBe(4); // 4 for user_A
            // Verify descending order
            for (let i = 0; i < results.length - 1; i++) {
                expect(new Date(results[i].createdAt) >= new Date(results[i + 1].createdAt)).toBe(true);
            }
        });

        it('respects the limit parameter', async () => {
            const results = await repo.findByUserId('user_A', { limit: 2 });
            expect(results.length).toBe(2);
        });

        it('filters to unread only when unreadOnly=true', async () => {
            const results = await repo.findByUserId('user_A', { unreadOnly: true });

            // user_A has 3 unread (id 1, 3, 5) and 1 read (id 2)
            expect(results.length).toBe(3);
            results.forEach(n => expect(n.read).toBe(false));
        });

        it('returns empty array for unknown userId', async () => {
            const results = await repo.findByUserId('nonexistent');
            expect(results).toEqual([]);
        });
    });

    describe('countUnread', () => {
        it('returns correct count of unread notifications', async () => {
            const count = await repo.countUnread('user_A');
            expect(count).toBe(3); // ids 1, 3, 5
        });

        it('returns 0 for user with no unread', async () => {
            // user_B has 1 unread (id 4)
            // Change it to read for this test
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            data.find(n => n.id === 4).read = true;
            fs.writeFileSync(dataFile, JSON.stringify(data));

            const count = await repo.countUnread('user_B');
            expect(count).toBe(0);
        });

        it('returns 0 for unknown user', async () => {
            const count = await repo.countUnread('nonexistent');
            expect(count).toBe(0);
        });
    });

    describe('markAsRead', () => {
        it('marks a notification as read', async () => {
            const result = await repo.markAsRead(1);
            expect(result).toBeDefined();

            // Verify in file
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            const n = data.find(x => x.id === 1);
            expect(n.read).toBe(true);
        });
    });

    describe('markAllAsRead', () => {
        it('marks all unread notifications for a user as read', async () => {
            const result = await repo.markAllAsRead('user_A');
            expect(result.updated).toBe(3); // 3 were unread

            // Verify in file
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            const userNotifs = data.filter(n => n.userId === 'user_A');
            userNotifs.forEach(n => expect(n.read).toBe(true));
        });

        it('returns { updated: 0 } when no unread notifications exist', async () => {
            // First mark all as read
            await repo.markAllAsRead('user_A');
            // Then try again
            const result = await repo.markAllAsRead('user_A');
            expect(result.updated).toBe(0);
        });

        it('does not affect other users notifications', async () => {
            await repo.markAllAsRead('user_A');

            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            const userB = data.find(n => n.userId === 'user_B');
            expect(userB.read).toBe(false); // Unchanged
        });
    });

    describe('createNotification', () => {
        it('creates a notification with read=false and createdAt', async () => {
            const result = await repo.createNotification({
                userId: 'user_C',
                type: 'system',
                title: 'New notification',
                body: 'Test body'
            });

            expect(result).toBeDefined();
            expect(result.read).toBe(false);
            expect(result.createdAt).toBeDefined();
            expect(result.userId).toBe('user_C');
        });

        it('throws Zod validation error for invalid data', async () => {
            await expect(repo.createNotification({
                userId: '', // empty userId
                type: 'invalid_type',
                title: '',
                body: ''
            })).rejects.toThrow();
        });
    });
});
