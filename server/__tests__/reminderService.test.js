/**
 * Unit tests for reminderService. Mocks the Postgres pool (query +
 * withTransaction) and notificationService. Synthetic data only.
 */

const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockWithTransaction = jest.fn(async (fn) => fn({ query: mockClientQuery }));
jest.mock('../db/client', () => ({
    query: (...a) => mockQuery(...a),
    withTransaction: (...a) => mockWithTransaction(...a)
}));

const mockCreateNotification = jest.fn();
jest.mock('../services/notificationService', () => ({
    createNotification: (...a) => mockCreateNotification(...a)
}));

const svc = require('../services/reminderService');

const NOW = new Date('2026-06-15T10:00:00Z');   // 11:00 in Kinshasa (+1)

beforeEach(() => {
    mockQuery.mockReset();
    mockClientQuery.mockReset();
    mockWithTransaction.mockClear();
    mockWithTransaction.mockImplementation(async (fn) => fn({ query: mockClientQuery }));
    mockCreateNotification.mockReset().mockResolvedValue({ id: 'n1' });
});

// Route the generic query mock: SELECT schedules vs INSERT reminders.
function routeQueries({ schedules = [], insertRowCount = 1 } = {}) {
    mockQuery.mockImplementation(async (sql) => {
        if (/FROM medication_schedules ms/i.test(sql)) {
            return { rowCount: schedules.length, rows: schedules };
        }
        if (/INSERT INTO medication_reminders/i.test(sql)) {
            return insertRowCount > 0
                ? { rowCount: 1, rows: [{ id: 'rem-x' }] }
                : { rowCount: 0, rows: [] };
        }
        return { rowCount: 0, rows: [] };
    });
}

const KIN_SCHEDULE = {
    id: 'ms-1', patient_id: 'pp-1',
    times: ['08:00', '20:00'],
    start_date: '2026-06-01', end_date: null,
    tz: 'Africa/Kinshasa', enabled: true
};

describe('generateUpcoming', () => {
    test('generates future instants only, across the horizon', async () => {
        routeQueries({ schedules: [KIN_SCHEDULE] });
        const r = await svc.generateUpcoming({ horizonDays: 2, now: NOW });
        // Day 0 (2026-06-15): 08:00 local = 07:00Z (past, skipped); 20:00 = 19:00Z (future).
        // Day 1 (2026-06-16): both future. → 3 inserts.
        expect(r).toMatchObject({ schedules: 1, inserted: 3, duplicate: 0, badTimes: 0 });

        const inserts = mockQuery.mock.calls.filter(c => /INSERT INTO medication_reminders/i.test(c[0]));
        expect(inserts).toHaveLength(3);
        // First insert: 2026-06-15 20:00 Kinshasa → 19:00Z, local string + tz recorded.
        expect(inserts[0][1][2].toISOString()).toBe('2026-06-15T19:00:00.000Z');
        expect(inserts[0][1][3]).toBe('20:00');
        expect(inserts[0][1][4]).toBe('Africa/Kinshasa');
    });

    test('idempotent: ON CONFLICT skips count as duplicate', async () => {
        routeQueries({ schedules: [KIN_SCHEDULE], insertRowCount: 0 });
        const r = await svc.generateUpcoming({ horizonDays: 2, now: NOW });
        expect(r).toMatchObject({ inserted: 0, duplicate: 3 });
    });

    test('skips disabled schedules entirely', async () => {
        routeQueries({ schedules: [{ ...KIN_SCHEDULE, enabled: false }] });
        const r = await svc.generateUpcoming({ horizonDays: 2, now: NOW });
        expect(r).toMatchObject({ schedules: 0, inserted: 0 });
    });

    test('respects end_date (window beyond schedule end → nothing)', async () => {
        routeQueries({ schedules: [{ ...KIN_SCHEDULE, end_date: '2026-06-10' }] });
        const r = await svc.generateUpcoming({ horizonDays: 2, now: NOW });
        expect(r.inserted).toBe(0);
    });

    test('respects start_date (schedule starts after window → nothing)', async () => {
        routeQueries({ schedules: [{ ...KIN_SCHEDULE, start_date: '2026-07-01' }] });
        const r = await svc.generateUpcoming({ horizonDays: 2, now: NOW });
        expect(r.inserted).toBe(0);
    });

    test('counts malformed times without inserting them', async () => {
        routeQueries({ schedules: [{ ...KIN_SCHEDULE, times: ['25:99', 'soon', '20:00'] }] });
        const r = await svc.generateUpcoming({ horizonDays: 1, now: NOW });
        expect(r.badTimes).toBe(2);        // bad entries counted on the one in-window day
        expect(r.inserted).toBe(1);        // only the valid 20:00
    });

    test('honors per-patient timezone', async () => {
        routeQueries({ schedules: [{ ...KIN_SCHEDULE, times: ['08:00'], tz: 'Europe/Paris' }] });
        await svc.generateUpcoming({ horizonDays: 2, now: NOW });
        const inserts = mockQuery.mock.calls.filter(c => /INSERT INTO medication_reminders/i.test(c[0]));
        // 2026-06-16 08:00 Paris (UTC+2) → 06:00Z
        expect(inserts[0][1][2].toISOString()).toBe('2026-06-16T06:00:00.000Z');
    });

    test('no-ops when PG unconfigured', async () => {
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0, _skipped: true });
        const r = await svc.generateUpcoming({ now: NOW });
        expect(r).toEqual({ skipped: true });
    });
});

describe('dispatchDue', () => {
    test('claims, marks sent in-txn, delivers after, and reports counts', async () => {
        const claimedRows = [
            { id: 'r1', patient_id: 'pp-1', scheduled_local: '08:00', medication: 'Metformine', dosage: '500mg', firebase_uid: 'fb-1' },
            { id: 'r2', patient_id: 'pp-2', scheduled_local: '08:00', medication: 'Insuline', dosage: null, firebase_uid: 'fb-2' }
        ];
        mockClientQuery.mockImplementation(async (sql) => {
            if (/FOR UPDATE OF r SKIP LOCKED/i.test(sql)) return { rows: claimedRows, rowCount: 2 };
            return { rows: [], rowCount: 2 };  // the UPDATE ... ANY($1)
        });
        const r = await svc.dispatchDue({});
        expect(r).toEqual({ claimed: 2, delivered: 2, failed: 0 });

        // SKIP LOCKED query ran inside the txn, UPDATE marked both ids sent.
        const update = mockClientQuery.mock.calls.find(c => /SET status = 'sent'/i.test(c[0]));
        expect(update[1][0]).toEqual(['r1', 'r2']);
        // Notifications delivered with the right recipients + reminder ids.
        expect(mockCreateNotification).toHaveBeenCalledTimes(2);
        expect(mockCreateNotification.mock.calls[0][0]).toMatchObject({
            userId: 'fb-1', type: 'medication_reminder', data: { reminderId: 'r1' }
        });
    });

    test('delivery failure records last_error but row stays sent (at-most-once)', async () => {
        mockClientQuery.mockImplementation(async (sql) => {
            if (/FOR UPDATE OF r SKIP LOCKED/i.test(sql)) {
                return { rows: [{ id: 'r1', firebase_uid: 'fb-1', medication: 'X', scheduled_local: '08:00' }], rowCount: 1 };
            }
            return { rows: [], rowCount: 1 };
        });
        mockCreateNotification.mockRejectedValueOnce(new Error('FCM down'));
        mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });   // last_error UPDATE

        const r = await svc.dispatchDue({});
        expect(r).toEqual({ claimed: 1, delivered: 0, failed: 1 });
        const errUpdate = mockQuery.mock.calls.find(c => /SET last_error/i.test(c[0]));
        expect(errUpdate[1]).toEqual(['r1', 'FCM down']);
    });

    test('no-ops when PG unconfigured', async () => {
        mockWithTransaction.mockResolvedValueOnce({ _skipped: true });
        const r = await svc.dispatchDue({});
        expect(r).toEqual({ skipped: true });
        expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    test('claim failure returns error without throwing', async () => {
        mockWithTransaction.mockRejectedValueOnce(new Error('deadlock'));
        await expect(svc.dispatchDue({})).resolves.toEqual({ error: true });
    });
});

describe('sweepStale', () => {
    test('marks stale pending rows missed', async () => {
        mockQuery.mockResolvedValue({ rowCount: 3, rows: [{}, {}, {}] });
        const r = await svc.sweepStale({});
        expect(r).toEqual({ missed: 3 });
        expect(mockQuery.mock.calls[0][0]).toMatch(/SET status = 'missed'/);
    });
});

describe('snooze', () => {
    test('marks original snoozed and spawns a linked child', async () => {
        mockClientQuery.mockImplementation(async (sql) => {
            if (/FOR UPDATE$/m.test(sql.trim()) || /FOR UPDATE/.test(sql) && /SELECT/.test(sql)) {
                return { rows: [{ id: 'r1', medication_schedule_id: 'ms-1', patient_id: 'pp-1', scheduled_local: '08:00', timezone: 'Africa/Kinshasa' }], rowCount: 1 };
            }
            if (/INSERT INTO medication_reminders/.test(sql)) {
                return { rows: [{ id: 'child-1', scheduled_at_utc: '2026-06-15T10:15:00Z' }], rowCount: 1 };
            }
            return { rows: [], rowCount: 1 };
        });
        const child = await svc.snooze('r1', 15, 'pp-1');
        expect(child).toMatchObject({ id: 'child-1' });

        const ins = mockClientQuery.mock.calls.find(c => /INSERT INTO medication_reminders/.test(c[0]));
        // (schedule, patient, minutes, local, tz, parent)
        expect(ins[1]).toEqual(['ms-1', 'pp-1', 15, '08:00', 'Africa/Kinshasa', 'r1']);
        const upd = mockClientQuery.mock.calls.find(c => /SET status = 'snoozed'/.test(c[0]));
        expect(upd[1]).toEqual(['r1']);
    });

    test('returns null for not-found / not-owned reminders', async () => {
        mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        expect(await svc.snooze('ghost', 15, 'pp-1')).toBeNull();
    });
});

describe('acknowledge', () => {
    test('marks taken with ownership enforced in SQL', async () => {
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'r1', status: 'taken' }] });
        const r = await svc.acknowledge('r1', 'taken', 'pp-1');
        expect(r).toMatchObject({ status: 'taken' });
        expect(mockQuery.mock.calls[0][1]).toEqual(['r1', 'pp-1', 'taken']);
    });

    test('returns null when no row matched (wrong owner or terminal status)', async () => {
        mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
        expect(await svc.acknowledge('r1', 'taken', 'pp-other')).toBeNull();
    });

    test('rejects invalid status without touching the DB', async () => {
        expect(await svc.acknowledge('r1', 'devoured', 'pp-1')).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('cancelForSchedule + generateForSchedule', () => {
    test('cancel returns the count of future pending rows cancelled', async () => {
        mockQuery.mockResolvedValue({ rowCount: 4, rows: [{}, {}, {}, {}] });
        expect(await svc.cancelForSchedule('ms-1')).toBe(4);
        expect(mockQuery.mock.calls[0][0]).toMatch(/SET status = 'cancelled'/);
    });

    test('generateForSchedule regenerates for one schedule', async () => {
        mockQuery.mockImplementation(async (sql) => {
            if (/FROM medication_schedules ms/i.test(sql)) {
                return { rowCount: 1, rows: [{ ...KIN_SCHEDULE, times: ['20:00'] }] };
            }
            if (/INSERT INTO medication_reminders/i.test(sql)) {
                return { rowCount: 1, rows: [{ id: 'rem-1' }] };
            }
            return { rowCount: 0, rows: [] };
        });
        const r = await svc.generateForSchedule('ms-1', { horizonDays: 1, now: NOW });
        expect(r.inserted).toBe(1);
    });
});
