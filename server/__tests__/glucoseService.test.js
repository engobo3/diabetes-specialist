/**
 * Unit tests for glucoseService (glucose cutover — expand/dual-write stage).
 * Mocks the Postgres pool and patientResolver. Synthetic data only.
 */

const mockQuery = jest.fn();
jest.mock('../db/client', () => ({ query: (...a) => mockQuery(...a) }));

const mockToProfileId = jest.fn();
jest.mock('../services/patientResolver', () => ({ toProfileId: (...a) => mockToProfileId(...a) }));

const glucose = require('../services/glucoseService');

beforeEach(() => {
    mockQuery.mockReset();
    mockToProfileId.mockReset();
});

describe('glucoseService — pure helpers', () => {
    test('isGlucoseVital: typed, untyped-legacy, and non-glucose', () => {
        expect(glucose.isGlucoseVital({ type: 'Glucose' })).toBe(true);
        expect(glucose.isGlucoseVital({ category: 'glucose' })).toBe(true);
        expect(glucose.isGlucoseVital({})).toBe(true);                 // untyped legacy = glucose
        expect(glucose.isGlucoseVital({ type: 'Blood Pressure' })).toBe(false);
        expect(glucose.isGlucoseVital(null)).toBe(false);
    });

    test('extractMgDl: number, numeric string, junk', () => {
        expect(glucose.extractMgDl({ glucose: 142 })).toBe(142);
        expect(glucose.extractMgDl({ value: '155.6' })).toBe(156);
        expect(glucose.extractMgDl({ value: 'HIGH' })).toBeNull();
        expect(glucose.extractMgDl({})).toBeNull();
    });

    test('normalizeContext maps spacing/case; unknown → unknown', () => {
        expect(glucose.normalizeContext('Fasting')).toBe('fasting');
        expect(glucose.normalizeContext('Post-meal')).toBe('post_meal');
        expect(glucose.normalizeContext('Pre meal')).toBe('pre_meal');
        expect(glucose.normalizeContext('weird')).toBe('unknown');
        expect(glucose.normalizeContext(null)).toBe('unknown');
    });
});

describe('glucoseService.dualWriteFromVital', () => {
    test('inserts when patient resolves and value is numeric', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'g-1' }] });

        const id = await glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', glucose: 142, date: '2026-03-01T08:00:00Z' }, 'v1');

        expect(id).toBe('g-1');
        const params = mockQuery.mock.calls[0][1];
        // recorded_at uses now() (not a bind param), so the 8 columns map to 7
        // params: [patient_id, value_mg_dl, measured_at, context, source, notes, client_uuid]
        expect(params[0]).toBe('pp-1');     // patient_id
        expect(params[1]).toBe(142);        // value_mg_dl
        expect(params[6]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); // deterministic client_uuid
    });

    test('derives a STABLE client_uuid for the same (patient, vital)', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'g-1' }] });

        await glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', glucose: 142 }, 'v1');
        await glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', glucose: 142 }, 'v1');

        expect(mockQuery.mock.calls[0][1][6]).toBe(mockQuery.mock.calls[1][1][6]);
    });

    test('prefers a client-supplied client_uuid', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'g-1' }] });
        await glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', glucose: 142, client_uuid: 'supplied' }, 'v1');
        expect(mockQuery.mock.calls[0][1][6]).toBe('supplied');
    });

    test('skips non-glucose vitals (no resolver, no query)', async () => {
        const id = await glucose.dualWriteFromVital('fs-pat', { type: 'Weight', value: '80' }, 'v1');
        expect(id).toBeNull();
        expect(mockToProfileId).not.toHaveBeenCalled();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('skips non-numeric glucose', async () => {
        const id = await glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', value: 'HIGH' }, 'v1');
        expect(id).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('skips out-of-range glucose', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        const id = await glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', glucose: 99999 }, 'v1');
        expect(id).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('skips when patient not migrated (resolver → null)', async () => {
        mockToProfileId.mockResolvedValue(null);
        const id = await glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', glucose: 142 }, 'v1');
        expect(id).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('returns null (no throw) when PG unavailable (_skipped)', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0, _skipped: true });
        const id = await glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', glucose: 142 }, 'v1');
        expect(id).toBeNull();
    });

    test('never throws on query error', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockRejectedValue(new Error('boom'));
        await expect(glucose.dualWriteFromVital('fs-pat', { type: 'Glucose', glucose: 142 }, 'v1')).resolves.toBeNull();
    });
});

describe('glucoseService.listByPatient', () => {
    test('returns postgres rows when resolved', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockResolvedValue({ rowCount: 2, rows: [{ id: 'g1' }, { id: 'g2' }] });
        const r = await glucose.listByPatient('fs-pat');
        expect(r.source).toBe('postgres');
        expect(r.readings).toHaveLength(2);
    });

    test('source=none when patient unresolved', async () => {
        mockToProfileId.mockResolvedValue(null);
        const r = await glucose.listByPatient('fs-pat');
        expect(r).toEqual({ source: 'none', readings: [] });
    });

    test('source=none when PG skipped', async () => {
        mockToProfileId.mockResolvedValue('pp-1');
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0, _skipped: true });
        const r = await glucose.listByPatient('fs-pat');
        expect(r.source).toBe('none');
    });
});
