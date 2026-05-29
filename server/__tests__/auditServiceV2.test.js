/**
 * Unit tests for auditServiceV2.
 *
 * Mocks both the Postgres pool (`../db/client`) and the legacy Firestore
 * audit logger so we can assert dual-write behavior, PHI redaction, and
 * never-throws contract without needing a real database.
 *
 * Synthetic data only.
 */

const mockQuery = jest.fn();
jest.mock('../db/client', () => ({
    query: (...args) => mockQuery(...args)
}));

const mockLegacyLog = jest.fn();
jest.mock('../services/auditLogger', () => ({
    log: (...args) => mockLegacyLog(...args)
}));

const audit = require('../services/auditServiceV2');

beforeEach(() => {
    mockQuery.mockReset();
    mockLegacyLog.mockReset();
    // Default: both writes succeed
    mockQuery.mockResolvedValue({ rows: [{ id: 'pg-row-1' }], rowCount: 1 });
    mockLegacyLog.mockResolvedValue({ id: 'fs-row-1' });
});

describe('auditServiceV2.log — dual-write', () => {
    test('writes to both Firestore (legacy) and Postgres on a normal event', async () => {
        await audit.log({
            action: 'patient_profile.read',
            resource_type: 'patient_profile',
            resource_id: 'patient-uuid-1',
            actor_firebase_uid: 'firebase-uid-1',
            actor_role: 'doctor',
            patient_id: 'patient-uuid-1',
            metadata: { reason: 'consultation' }
        });

        expect(mockLegacyLog).toHaveBeenCalledTimes(1);
        expect(mockQuery).toHaveBeenCalledTimes(1);
        // Postgres call passes the INSERT with the right action
        expect(mockQuery.mock.calls[0][1][0]).toBe('patient_profile.read');
    });

    test('Postgres failure does not break the legacy write or throw', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection refused'));

        await expect(audit.log({
            action: 'glucose_reading.create',
            resource_type: 'glucose_reading',
            actor_firebase_uid: 'firebase-uid-1',
            actor_role: 'patient',
            metadata: {}
        })).resolves.not.toThrow();

        expect(mockLegacyLog).toHaveBeenCalledTimes(1);
    });

    test('legacy failure does not break the Postgres write or throw', async () => {
        mockLegacyLog.mockRejectedValueOnce(new Error('firestore unavailable'));

        await expect(audit.log({
            action: 'patient_profile.read',
            resource_type: 'patient_profile',
            actor_firebase_uid: 'firebase-uid-1',
            actor_role: 'doctor',
            metadata: {}
        })).resolves.not.toThrow();

        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('returns null when pool is unconfigured (_skipped result)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, _skipped: true });

        const id = await audit.log({
            action: 'patient_profile.read',
            resource_type: 'patient_profile',
            actor_firebase_uid: 'firebase-uid-1',
            actor_role: 'doctor'
        });

        expect(id).toBeNull();
        // Legacy still called even when Postgres is unconfigured
        expect(mockLegacyLog).toHaveBeenCalledTimes(1);
    });
});

describe('auditServiceV2.log — PHI redaction', () => {
    test('redacts sensitive keys in metadata before INSERT', async () => {
        await audit.log({
            action: 'patient_profile.read',
            resource_type: 'patient_profile',
            actor_firebase_uid: 'firebase-uid-1',
            actor_role: 'doctor',
            metadata: {
                name: 'Jean Mbala',
                phone: '+243812345678',
                glucose: 142,
                fieldsAccessed: ['name', 'glucose'],
                token: 'eyJsecret...',
                reason: 'consultation'   // not sensitive — should pass through
            }
        });

        // The 13th positional param is the JSON-stringified metadata
        const metadataJson = mockQuery.mock.calls[0][1][12];
        const stored = JSON.parse(metadataJson);
        expect(stored.name).toBe('[REDACTED]');
        expect(stored.phone).toBe('[REDACTED]');
        expect(stored.glucose).toBe('[REDACTED]');
        expect(stored.token).toBe('[REDACTED]');
        expect(stored.reason).toBe('consultation');           // preserved
        expect(stored.fieldsAccessed).toEqual(['name', 'glucose']); // array of plain strings, not sensitive
    });

    test('redacts nested sensitive keys', async () => {
        await audit.log({
            action: 'patient_profile.update',
            resource_type: 'patient_profile',
            actor_firebase_uid: 'firebase-uid-1',
            actor_role: 'doctor',
            metadata: {
                changes: {
                    emergency_contact: { phone: '+243812345678', name: 'spouse' },
                    address: '15 rue de Gombe'
                }
            }
        });

        const stored = JSON.parse(mockQuery.mock.calls[0][1][12]);
        expect(stored.changes.emergency_contact.phone).toBe('[REDACTED]');
        expect(stored.changes.emergency_contact.name).toBe('[REDACTED]');
        expect(stored.changes.address).toBe('[REDACTED]');
    });

    test('handles undefined / null / empty metadata safely', async () => {
        await expect(audit.log({
            action: 'system.heartbeat',
            resource_type: 'system',
            actor_role: 'admin'
        })).resolves.not.toThrow();

        const stored = JSON.parse(mockQuery.mock.calls[0][1][12]);
        expect(stored).toEqual({});
    });
});

describe('auditServiceV2.log — defensive', () => {
    test('returns null and does not throw when action is missing', async () => {
        const result = await audit.log({
            resource_type: 'patient_profile',
            actor_firebase_uid: 'firebase-uid-1'
        });
        expect(result).toBeNull();
        // Neither write should have fired
        expect(mockQuery).not.toHaveBeenCalled();
        expect(mockLegacyLog).not.toHaveBeenCalled();
    });

    test('returns null and does not throw when resource_type is missing', async () => {
        const result = await audit.log({
            action: 'patient_profile.read',
            actor_firebase_uid: 'firebase-uid-1'
        });
        expect(result).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('infers legacy eventType from action and severity', async () => {
        // DATA_MODIFICATION for *.create/*.update/*.delete actions
        await audit.log({
            action: 'patient_profile.update',
            resource_type: 'patient_profile',
            actor_firebase_uid: 'u1',
            actor_role: 'doctor'
        });
        expect(mockLegacyLog.mock.calls[0][0].eventType).toBe('DATA_MODIFICATION');

        // SECURITY for severity=warning regardless of action
        await audit.log({
            action: 'patient_profile.read',
            resource_type: 'patient_profile',
            actor_firebase_uid: 'u1',
            actor_role: 'doctor',
            severity: 'warning'
        });
        expect(mockLegacyLog.mock.calls[1][0].eventType).toBe('SECURITY');

        // SECURITY for success=false regardless of action
        await audit.log({
            action: 'patient_profile.read',
            resource_type: 'patient_profile',
            actor_firebase_uid: 'u1',
            actor_role: 'doctor',
            success: false
        });
        expect(mockLegacyLog.mock.calls[2][0].eventType).toBe('SECURITY');

        // DATA_ACCESS otherwise
        await audit.log({
            action: 'patient_profile.read',
            resource_type: 'patient_profile',
            actor_firebase_uid: 'u1',
            actor_role: 'doctor'
        });
        expect(mockLegacyLog.mock.calls[3][0].eventType).toBe('DATA_ACCESS');
    });

    test('coerces resource_id to string', async () => {
        await audit.log({
            action: 'patient_profile.read',
            resource_type: 'patient_profile',
            resource_id: 12345,                  // numeric legacy id
            actor_firebase_uid: 'u1',
            actor_role: 'doctor'
        });
        // 3rd positional param is resource_id
        expect(mockQuery.mock.calls[0][1][2]).toBe('12345');
    });
});
