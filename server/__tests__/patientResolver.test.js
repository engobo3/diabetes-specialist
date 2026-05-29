/**
 * Unit tests for patientResolver. Mocks Postgres pool + Firestore.
 * Synthetic data only.
 */

const mockQuery = jest.fn();
jest.mock('../db/client', () => ({ query: (...a) => mockQuery(...a) }));

const mockGet = jest.fn();
jest.mock('../config/firebaseConfig', () => ({
    db: { collection: () => ({ doc: () => ({ get: mockGet }) }) }
}));

const resolver = require('../services/patientResolver');

beforeEach(() => {
    mockQuery.mockReset();
    mockGet.mockReset();
    resolver._clearCache();
});

describe('patientResolver.toProfileId', () => {
    test('resolves Firestore patient id → uid → profile id', async () => {
        mockGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'fb-1' }) });
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'pp-1' }] });
        expect(await resolver.toProfileId('fs-pat')).toBe('pp-1');
    });

    test('caches successful resolution (one FS read + one PG query for repeats)', async () => {
        mockGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'fb-1' }) });
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'pp-1' }] });
        await resolver.toProfileId('fs-pat');
        await resolver.toProfileId('fs-pat');
        expect(mockGet).toHaveBeenCalledTimes(1);
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('does NOT cache null — re-checks an unmigrated patient', async () => {
        mockGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'fb-1' }) });
        mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
        await resolver.toProfileId('fs-pat');
        await resolver.toProfileId('fs-pat');
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    test('null when Firestore patient doc missing (no PG query)', async () => {
        mockGet.mockResolvedValue({ exists: false });
        expect(await resolver.toProfileId('ghost')).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('null when patient has no uid', async () => {
        mockGet.mockResolvedValue({ exists: true, data: () => ({}) });
        expect(await resolver.toProfileId('fs-pat')).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('null (no throw) when PG skipped', async () => {
        mockGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'fb-1' }) });
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0, _skipped: true });
        expect(await resolver.toProfileId('fs-pat')).toBeNull();
    });

    test('null (no throw) when Firestore read errors', async () => {
        mockGet.mockRejectedValue(new Error('fs down'));
        expect(await resolver.toProfileId('fs-pat')).toBeNull();
    });

    test('null/undefined input → null, no backend calls', async () => {
        expect(await resolver.toProfileId(null)).toBeNull();
        expect(await resolver.toProfileId(undefined)).toBeNull();
        expect(mockGet).not.toHaveBeenCalled();
        expect(mockQuery).not.toHaveBeenCalled();
    });
});
