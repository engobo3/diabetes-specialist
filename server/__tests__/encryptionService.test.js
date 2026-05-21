const {
    encryptField,
    decryptField,
    encryptFields,
    decryptFields,
    ENCRYPTED_PATIENT_FIELDS
} = require('../services/encryptionService');

describe('encryptionService', () => {
    describe('encryptField / decryptField', () => {
        it('round-trips a string value', () => {
            const blob = encryptField('123-45-6789');
            expect(typeof blob).toBe('string');
            expect(blob).not.toContain('123-45-6789');
            expect(blob.startsWith('v1:')).toBe(true);
            expect(decryptField(blob)).toBe('123-45-6789');
        });

        it('round-trips unicode and special characters', () => {
            const samples = [
                'patient@example.com',
                'María Núñez',
                '🏥 hospital data',
                'multi\nline\nstring',
                '0123456789abcdef',
            ];
            for (const s of samples) {
                expect(decryptField(encryptField(s))).toBe(s);
            }
        });

        it('produces a different ciphertext each time for the same input', () => {
            const a = encryptField('same input');
            const b = encryptField('same input');
            expect(a).not.toBe(b);                  // distinct IVs
            expect(decryptField(a)).toBe('same input');
            expect(decryptField(b)).toBe('same input');
        });

        it('returns null on tampered ciphertext (auth tag check)', () => {
            const blob = encryptField('sensitive');
            const parts = blob.split(':');
            // Flip a bit in the ciphertext
            const ct = Buffer.from(parts[3], 'base64');
            ct[0] = ct[0] ^ 0xff;
            parts[3] = ct.toString('base64');
            const tampered = parts.join(':');
            expect(decryptField(tampered)).toBeNull();
        });

        it('passes through null, undefined, empty string', () => {
            expect(encryptField(null)).toBeNull();
            expect(encryptField(undefined)).toBeUndefined();
            expect(encryptField('')).toBe('');
            expect(decryptField(null)).toBeNull();
            expect(decryptField('')).toBe('');
        });

        it('returns a non-v1 blob as-is (backwards compatible)', () => {
            // Legacy unencrypted records should not crash on decrypt
            expect(decryptField('plain text legacy value')).toBe('plain text legacy value');
        });

        it('does not double-encrypt already-encrypted blobs in encryptFields', () => {
            const obj = { socialSecurityNumber: '111-22-3333' };
            encryptFields(obj, ['socialSecurityNumber']);
            const firstBlob = obj.socialSecurityNumber;
            encryptFields(obj, ['socialSecurityNumber']);
            // Should be unchanged because already encrypted
            expect(obj.socialSecurityNumber).toBe(firstBlob);
            expect(decryptField(obj.socialSecurityNumber)).toBe('111-22-3333');
        });
    });

    describe('encryptFields / decryptFields', () => {
        it('encrypts and decrypts the configured fields on a patient-like object', () => {
            const patient = {
                name: 'Jane Doe',
                socialSecurityNumber: '123-45-6789',
                governmentId: 'CD-998877',
                insurancePolicyNumber: 'POL-12345',
                phone: '+243-...-...'
            };
            encryptFields(patient, ENCRYPTED_PATIENT_FIELDS);

            // Listed fields are now encrypted, others untouched
            expect(patient.socialSecurityNumber).not.toBe('123-45-6789');
            expect(patient.socialSecurityNumber.startsWith('v1:')).toBe(true);
            expect(patient.governmentId.startsWith('v1:')).toBe(true);
            expect(patient.insurancePolicyNumber.startsWith('v1:')).toBe(true);
            expect(patient.name).toBe('Jane Doe');
            expect(patient.phone).toBe('+243-...-...');

            decryptFields(patient, ENCRYPTED_PATIENT_FIELDS);
            expect(patient.socialSecurityNumber).toBe('123-45-6789');
            expect(patient.governmentId).toBe('CD-998877');
            expect(patient.insurancePolicyNumber).toBe('POL-12345');
        });

        it('handles missing fields gracefully', () => {
            const obj = { name: 'Alice' };
            encryptFields(obj, ENCRYPTED_PATIENT_FIELDS);
            decryptFields(obj, ENCRYPTED_PATIENT_FIELDS);
            expect(obj).toEqual({ name: 'Alice' });
        });
    });
});
