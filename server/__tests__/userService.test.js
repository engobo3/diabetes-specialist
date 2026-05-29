/**
 * Unit tests for userService.lookupUserByFirebaseUid.
 *
 * Mocks both the Postgres pool (`../db/client`) and Firestore
 * (`../config/firebaseConfig`) so we can assert Postgres-first /
 * Firestore-fallback semantics without booting either dependency.
 *
 * Synthetic data only.
 */

const mockQuery = jest.fn();
jest.mock('../db/client', () => ({
    query: (...args) => mockQuery(...args)
}));

// Firestore mock: a chainable .collection().doc().get() that returns whatever
// mockFirestoreDoc is set to.
let mockFirestoreDoc = null;
const mockFirestoreGet = jest.fn();
jest.mock('../config/firebaseConfig', () => ({
    db: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: mockFirestoreGet
            }))
        }))
    }
}));

const userService = require('../services/userService');

beforeEach(() => {
    mockQuery.mockReset();
    mockFirestoreGet.mockReset();
    mockFirestoreDoc = null;
    userService._resetFirestoreCache();
});

describe('userService.lookupUserByFirebaseUid — happy paths', () => {
    test('returns Postgres result when row exists', async () => {
        mockQuery.mockResolvedValueOnce({
            rowCount: 1,
            rows: [{
                user_id: 'pg-user-uuid',
                firebase_uid: 'firebase-uid-1',
                role: 'doctor',
                preferred_language: 'fr',
                region_id: 'cd-kinshasa',
                patient_profile_id: null,
                doctor_profile_id: 'pg-doctor-uuid'
            }]
        });

        const result = await userService.lookupUserByFirebaseUid('firebase-uid-1');

        expect(result).toEqual({
            source: 'postgres',
            id: 'pg-user-uuid',
            firebaseUid: 'firebase-uid-1',
            role: 'doctor',
            patientId: null,
            doctorId: 'pg-doctor-uuid',
            preferredLanguage: 'fr',
            regionId: 'cd-kinshasa'
        });
        // Firestore should NOT have been hit
        expect(mockFirestoreGet).not.toHaveBeenCalled();
    });

    test('falls back to Firestore when Postgres has no row', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
        mockFirestoreGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({
                role: 'patient',
                patientId: 42,           // legacy numeric id — should be stringified
                preferredLanguage: 'ln'
            })
        });

        const result = await userService.lookupUserByFirebaseUid('firebase-uid-2');

        expect(result).toEqual({
            source: 'firestore',
            id: null,
            firebaseUid: 'firebase-uid-2',
            role: 'patient',
            patientId: '42',
            doctorId: null,
            preferredLanguage: 'ln',
            regionId: 'cd-kinshasa'
        });
    });

    test('returns null when neither Postgres nor Firestore has the user', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
        mockFirestoreGet.mockResolvedValueOnce({ exists: false });

        const result = await userService.lookupUserByFirebaseUid('firebase-uid-3');
        expect(result).toBeNull();
    });
});

describe('userService.lookupUserByFirebaseUid — degraded paths', () => {
    test('Postgres failure falls back to Firestore (does not throw)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection refused'));
        mockFirestoreGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ role: 'doctor', doctorId: 'd-1' })
        });

        const result = await userService.lookupUserByFirebaseUid('firebase-uid-4');

        expect(result.source).toBe('firestore');
        expect(result.role).toBe('doctor');
        expect(result.doctorId).toBe('d-1');
    });

    test('Postgres _skipped (pool unconfigured) falls back to Firestore', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [], _skipped: true });
        mockFirestoreGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ role: 'admin' })
        });

        const result = await userService.lookupUserByFirebaseUid('firebase-uid-5');
        expect(result.source).toBe('firestore');
        expect(result.role).toBe('admin');
    });

    test('Firestore failure during fallback returns null (does not throw)', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
        mockFirestoreGet.mockRejectedValueOnce(new Error('firestore unavailable'));

        const result = await userService.lookupUserByFirebaseUid('firebase-uid-6');
        expect(result).toBeNull();
    });

    test('rejects empty / non-string uid without hitting either backend', async () => {
        expect(await userService.lookupUserByFirebaseUid('')).toBeNull();
        expect(await userService.lookupUserByFirebaseUid(null)).toBeNull();
        expect(await userService.lookupUserByFirebaseUid(undefined)).toBeNull();
        expect(await userService.lookupUserByFirebaseUid(12345)).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
        expect(mockFirestoreGet).not.toHaveBeenCalled();
    });
});

describe('userService.lookupUserByFirebaseUid — defaults', () => {
    test('Firestore fallback defaults preferred_language to fr', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
        mockFirestoreGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ role: 'patient' })   // no preferredLanguage
        });

        const result = await userService.lookupUserByFirebaseUid('firebase-uid-7');
        expect(result.preferredLanguage).toBe('fr');
    });

    test('Postgres result uses NULL-as-null (not "null" string) for missing profile ids', async () => {
        mockQuery.mockResolvedValueOnce({
            rowCount: 1,
            rows: [{
                user_id: 'pg-1',
                firebase_uid: 'fb-1',
                role: 'caregiver',
                preferred_language: 'fr',
                region_id: 'cd-kinshasa',
                patient_profile_id: null,
                doctor_profile_id: null
            }]
        });

        const result = await userService.lookupUserByFirebaseUid('fb-1');
        expect(result.patientId).toBeNull();
        expect(result.doctorId).toBeNull();
        expect(result.role).toBe('caregiver');
    });
});
