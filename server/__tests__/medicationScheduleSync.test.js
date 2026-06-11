/**
 * Unit tests for medicationScheduleSyncService (Phase 5 dual-write).
 * Mocks pool, patientResolver, reminderService. Synthetic data only.
 */

const mockQuery = jest.fn();
jest.mock('../db/client', () => ({ query: (...a) => mockQuery(...a) }));

const mockToProfileId = jest.fn();
jest.mock('../services/patientResolver', () => ({ toProfileId: (...a) => mockToProfileId(...a) }));

const mockCancel = jest.fn();
const mockGenerate = jest.fn();
jest.mock('../services/reminderService', () => ({
    cancelForSchedule: (...a) => mockCancel(...a),
    generateForSchedule: (...a) => mockGenerate(...a)
}));

const { deterministicUuid } = require('../utils/deterministicUuid');
const sync = require('../services/medicationScheduleSyncService');

const FS_DATA = {
    patientId: 'fs-pat-1',
    medication: 'Metformine',
    dosage: '500mg',
    times: ['08:00', '20:00'],
    frequency: 'twice_daily',
    startDate: '2026-06-01',
    active: true
};

beforeEach(() => {
    mockQuery.mockReset();
    mockToProfileId.mockReset();
    mockCancel.mockReset().mockResolvedValue(0);
    mockGenerate.mockReset().mockResolvedValue({ inserted: 0 });
});

describe('upsertFromFirestore', () => {
    test('upserts with the SAME deterministic client_uuid as the loader, then cancels + regenerates', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'pgms-1' }] });

        const pgId = await sync.upsertFromFirestore('fs-sched-1', FS_DATA);

        expect(pgId).toBe('pgms-1');
        const params = mockQuery.mock.calls[0][1];
        expect(params[0]).toBe('pp-1');
        expect(params[1]).toBe('Metformine');
        // Cross-path idempotency: identical to load_clinical_content's derivation.
        expect(params[8]).toBe(deterministicUuid('medication_schedules', 'fs-sched-1'));
        // Reminder refresh: cancel then regenerate (active schedule).
        expect(mockCancel).toHaveBeenCalledWith('pgms-1');
        expect(mockGenerate).toHaveBeenCalledWith('pgms-1');
    });

    test('inactive schedule: cancels but does NOT regenerate', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'pgms-1' }] });

        await sync.upsertFromFirestore('fs-sched-1', { ...FS_DATA, active: false });

        expect(mockCancel).toHaveBeenCalledWith('pgms-1');
        expect(mockGenerate).not.toHaveBeenCalled();
    });

    test('skips when the patient is not migrated', async () => {
        mockToProfileId.mockResolvedValue(null);
        const pgId = await sync.upsertFromFirestore('fs-sched-1', FS_DATA);
        expect(pgId).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('skips structurally invalid payloads without touching backends', async () => {
        expect(await sync.upsertFromFirestore('x', { medication: 'M' })).toBeNull();        // no patientId
        expect(await sync.upsertFromFirestore('x', { ...FS_DATA, times: 'oops' })).toBeNull(); // times not array
        expect(await sync.upsertFromFirestore(null, FS_DATA)).toBeNull();                   // no id
        expect(mockToProfileId).not.toHaveBeenCalled();
    });

    test('never throws on query failure', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockRejectedValue(new Error('boom'));
        await expect(sync.upsertFromFirestore('fs-sched-1', FS_DATA)).resolves.toBeNull();
    });
});

describe('removeByFirestoreId', () => {
    test('soft-deletes by client_uuid and cancels pending reminders', async () => {
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'pgms-1' }] });
        const pgId = await sync.removeByFirestoreId('fs-sched-1');
        expect(pgId).toBe('pgms-1');
        expect(mockQuery.mock.calls[0][0]).toMatch(/SET active = false, deleted_at = now\(\)/);
        expect(mockQuery.mock.calls[0][1][0]).toBe(deterministicUuid('medication_schedules', 'fs-sched-1'));
        expect(mockCancel).toHaveBeenCalledWith('pgms-1');
    });

    test('returns null when nothing matched (never mirrored)', async () => {
        mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
        expect(await sync.removeByFirestoreId('ghost')).toBeNull();
        expect(mockCancel).not.toHaveBeenCalled();
    });
});

describe('normalizeFrequency', () => {
    test('passes known values, defaults daily, coerces unknown to custom', () => {
        expect(sync.normalizeFrequency('weekly')).toBe('weekly');
        expect(sync.normalizeFrequency(null)).toBe('daily');
        expect(sync.normalizeFrequency('fortnightly')).toBe('custom');
    });
});
