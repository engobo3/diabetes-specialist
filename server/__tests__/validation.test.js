const { validatePatient, validateDoctor } = require('../utils/validation');

describe('validatePatient', () => {
    const validPatient = {
        name: 'Jean Mbala',
        age: 45,
        type: 'Type 2',
        status: 'Stable',
        doctorId: '1'
    };

    it('accepts a valid patient with all required fields', () => {
        const result = validatePatient(validPatient);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
    });

    it('accepts patient with doctorIds array instead of doctorId', () => {
        const patient = { ...validPatient, doctorId: undefined, doctorIds: ['1', '2'] };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(true);
    });

    it('rejects missing name', () => {
        const patient = { ...validPatient, name: undefined };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Name/i);
    });

    it('rejects name shorter than 2 characters', () => {
        const patient = { ...validPatient, name: 'A' };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/at least 2/i);
    });

    it('rejects missing age', () => {
        const patient = { ...validPatient, age: undefined };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Age/i);
    });

    it('rejects age as string (typeof check)', () => {
        const patient = { ...validPatient, age: '45' };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Age/i);
    });

    it('rejects negative age', () => {
        const patient = { ...validPatient, age: -1 };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
    });

    it('rejects age over 120', () => {
        const patient = { ...validPatient, age: 121 };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
    });

    it('accepts boundary ages (0 and 120)', () => {
        expect(validatePatient({ ...validPatient, age: 0 }).isValid).toBe(true);
        expect(validatePatient({ ...validPatient, age: 120 }).isValid).toBe(true);
    });

    it('rejects invalid diabetes type', () => {
        const patient = { ...validPatient, type: 'Type 3' };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Type/);
    });

    it('accepts all valid diabetes types', () => {
        ['Type 1', 'Type 2', 'Gestational', 'Prediabetes'].forEach(type => {
            expect(validatePatient({ ...validPatient, type }).isValid).toBe(true);
        });
    });

    it('rejects invalid status', () => {
        const patient = { ...validPatient, status: 'Unknown' };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Status/);
    });

    it('accepts all valid statuses', () => {
        ['Stable', 'Attention Needed', 'Critical'].forEach(status => {
            expect(validatePatient({ ...validPatient, status }).isValid).toBe(true);
        });
    });

    it('rejects patient with neither doctorId nor doctorIds', () => {
        const patient = { ...validPatient, doctorId: undefined, doctorIds: undefined };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Doctor/i);
    });

    it('rejects empty doctorIds array', () => {
        const patient = { ...validPatient, doctorId: undefined, doctorIds: [] };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
    });

    it('accumulates multiple errors', () => {
        const patient = { name: '', age: 'bad', type: 'Invalid', status: 'Invalid' };
        const result = validatePatient(patient);
        expect(result.isValid).toBe(false);
        // Should contain multiple error messages joined
        expect(result.error).toMatch(/Name/i);
        expect(result.error).toMatch(/Age/i);
        expect(result.error).toMatch(/Type/);
        expect(result.error).toMatch(/Status/);
        expect(result.error).toMatch(/Doctor/i);
    });
});

describe('validateDoctor', () => {
    const validDoctor = {
        name: 'Dr. Kabongo',
        specialty: 'Endocrinologie',
        city: 'Kinshasa',
        contact: { email: 'doc@example.com' }
    };

    it('accepts a valid doctor with all required fields', () => {
        const result = validateDoctor(validDoctor);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
    });

    it('accepts doctor with optional education and languages arrays', () => {
        const doctor = { ...validDoctor, education: ['MD'], languages: ['fr', 'ln'] };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(true);
    });

    it('rejects missing name', () => {
        const doctor = { ...validDoctor, name: undefined };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Name/i);
    });

    it('rejects name shorter than 2 characters', () => {
        const doctor = { ...validDoctor, name: 'D' };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
    });

    it('rejects missing specialty', () => {
        const doctor = { ...validDoctor, specialty: undefined };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Specialty/i);
    });

    it('rejects missing city', () => {
        const doctor = { ...validDoctor, city: undefined };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/City/i);
    });

    it('rejects missing contact object', () => {
        const doctor = { ...validDoctor, contact: undefined };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Contact/i);
    });

    it('rejects contact without email', () => {
        const doctor = { ...validDoctor, contact: { phone: '+243991234567' } };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/email/i);
    });

    it('rejects invalid email (no @)', () => {
        const doctor = { ...validDoctor, contact: { email: 'invalid-email' } };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/email/i);
    });

    it('rejects non-array education', () => {
        const doctor = { ...validDoctor, education: 'MD' };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Education/i);
    });

    it('rejects non-array languages', () => {
        const doctor = { ...validDoctor, languages: 'French' };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Languages/i);
    });

    it('accumulates multiple errors', () => {
        const doctor = { name: '', specialty: undefined, city: undefined, contact: null };
        const result = validateDoctor(doctor);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Name/i);
        expect(result.error).toMatch(/Specialty/i);
        expect(result.error).toMatch(/City/i);
    });
});
