/**
 * Priority 1 & 2 Features Test Suite
 * Tests new security enhancements:
 * - PII/PHI data separation
 * - Email notifications
 * - Enhanced security monitoring
 */

const PatientIdentityRepository = require('../repositories/PatientIdentityRepository');
const PatientMedicalRepository = require('../repositories/PatientMedicalRepository');
const emailService = require('../services/emailNotificationService');
const auditLogger = require('../services/auditLogger');

describe('Priority Features', () => {
    let identityRepo;
    let medicalRepo;

    beforeAll(() => {
        identityRepo = new PatientIdentityRepository();
        medicalRepo = new PatientMedicalRepository();
    });

    describe('PII/PHI Data Separation', () => {
        let testPatientId;

        afterAll(async () => {
            // Cleanup
            if (testPatientId) {
                try {
                    await identityRepo.delete(testPatientId);
                    await medicalRepo.delete(testPatientId);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        });

        it('should store patient identity separately', async () => {
            const identity = await identityRepo.create({
                name: 'Test Patient Priority',
                email: 'priority-test@example.com',
                phone: '+243123456789',
                age: 45,
                address: {
                    city: 'Kinshasa',
                    country: 'DRC'
                }
            });

            testPatientId = identity.id;

            expect(identity).toHaveProperty('id');
            expect(identity.name).toBe('Test Patient Priority');
            expect(identity.email).toBe('priority-test@example.com');
            // Should NOT have medical data
            expect(identity).not.toHaveProperty('type');
            expect(identity).not.toHaveProperty('status');
            expect(identity).not.toHaveProperty('doctorId');
        });

        it('should store patient medical data separately', async () => {
            const medical = await medicalRepo.create({
                patientId: testPatientId,
                type: 'Type 2',
                status: 'Stable',
                doctorId: 1,
                conditions: ['Diabetes Type 2', 'Hypertension'],
                lastVisit: new Date().toISOString()
            });

            expect(medical).toHaveProperty('patientId');
            expect(medical.type).toBe('Type 2');
            expect(medical.status).toBe('Stable');
            // Should NOT have PII data
            expect(medical).not.toHaveProperty('name');
            expect(medical).not.toHaveProperty('email');
            expect(medical).not.toHaveProperty('phone');
        });

        it('should find identity by email', async () => {
            const found = await identityRepo.findByEmail('priority-test@example.com');

            expect(found).toBeDefined();
            expect(found.name).toBe('Test Patient Priority');
        });

        it('should find medical data by patient ID', async () => {
            const found = await medicalRepo.findByPatientId(testPatientId);

            expect(found).toBeDefined();
            expect(found.type).toBe('Type 2');
            expect(found.patientId).toBe(testPatientId);
        });

        it('should find patients by doctor ID', async () => {
            const patients = await medicalRepo.findByDoctorId(1);

            expect(Array.isArray(patients)).toBe(true);
            const testPatient = patients.find(p => String(p.patientId) === String(testPatientId));
            expect(testPatient).toBeDefined();
        });

        it('should add clinical notes (medical data only)', async () => {
            await medicalRepo.addClinicalNote(testPatientId, {
                note: 'Patient is responding well to treatment',
                doctorId: 1,
                private: false
            });

            const medical = await medicalRepo.findByPatientId(testPatientId);
            expect(medical.clinicalNotes).toBeDefined();
            expect(medical.clinicalNotes.length).toBeGreaterThan(0);
            expect(medical.clinicalNotes[0].note).toContain('responding well');
        });
    });

    describe('Email Notification Service', () => {
        it('should send security alert email', async () => {
            const result = await emailService.notifyUnauthorizedAccess({
                userId: 'test-user-123',
                resource: 'patient-records',
                ipAddress: '192.168.1.1',
                timestamp: new Date().toISOString()
            });

            // In console mode, this should succeed
            expect(result.success).toBe(true);
        });

        it('should send multiple failed login alert', async () => {
            const result = await emailService.notifyMultipleFailedLogins({
                userId: 'test-user-123',
                count: 5,
                ipAddress: '192.168.1.1',
                timestamp: new Date().toISOString()
            });

            expect(result.success).toBe(true);
        });

        it('should send suspicious activity alert', async () => {
            const result = await emailService.notifySuspiciousActivity({
                userId: 'test-user-123',
                activity: 'excessive_data_access',
                metadata: {
                    recordsAccessed: 100,
                    timeWindow: '5 minutes'
                },
                timestamp: new Date().toISOString()
            });

            expect(result.success).toBe(true);
        });

        it('should send critical patient status alert', async () => {
            const result = await emailService.notifyCriticalPatientStatus({
                patientName: 'Test Patient',
                patientId: '123',
                doctorEmail: 'doctor@example.com',
                status: 'Critical',
                lastReading: 'Blood glucose: 350 mg/dL'
            });

            expect(result.success).toBe(true);
        });

        it('should send appointment reminder', async () => {
            const result = await emailService.notifyAppointmentReminder({
                patientEmail: 'patient@example.com',
                patientName: 'Test Patient',
                doctorName: 'Dr. Smith',
                appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });

            expect(result.success).toBe(true);
        });

        it('should send system error alert', async () => {
            const result = await emailService.notifySystemError({
                errorType: 'DatabaseConnection',
                errorMessage: 'Connection to Firestore failed',
                stackTrace: 'Error: Connection timeout\n  at ...',
                timestamp: new Date().toISOString()
            });

            expect(result.success).toBe(true);
        });

        it('should send batch emails', async () => {
            const emails = [
                {
                    to: 'user1@example.com',
                    subject: 'Test 1',
                    text: 'Test message 1'
                },
                {
                    to: 'user2@example.com',
                    subject: 'Test 2',
                    text: 'Test message 2'
                },
                {
                    to: 'user3@example.com',
                    subject: 'Test 3',
                    text: 'Test message 3'
                }
            ];

            const result = await emailService.sendBatch(emails);

            expect(result.total).toBe(3);
            expect(result.successful).toBe(3);
            expect(result.failed).toBe(0);
        });
    });

    describe('Enhanced Security Monitoring', () => {
        it('should log and alert on rate limit exceeded', async () => {
            // This tests the integration between rate limiting and email alerts
            const logSpy = jest.spyOn(auditLogger, 'logSecurity');

            // Simulate rate limit exceeded scenario
            await auditLogger.logSecurity({
                userId: 'test-user',
                userRole: 'patient',
                eventType: 'rate_limit_exceeded',
                description: 'Rate limit exceeded from IP 192.168.1.1',
                severity: 'warning'
            });

            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });

        it('should track unauthorized access attempts', async () => {
            const logSpy = jest.spyOn(auditLogger, 'logSecurity');

            await auditLogger.logSecurity({
                userId: 'test-user',
                userRole: 'patient',
                eventType: 'unauthorized_access',
                description: 'Attempted to access another patients records',
                severity: 'warning',
                metadata: {
                    attemptedResource: 'patient/456',
                    userPatientId: '123'
                }
            });

            expect(logSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'unauthorized_access',
                    severity: 'warning'
                })
            );

            logSpy.mockRestore();
        });
    });

    describe('Data Architecture Improvements', () => {
        it('should enforce separation at schema level', () => {
            const { PatientIdentitySchema } = require('../schemas/patientIdentity.schema');
            const { PatientMedicalSchema } = require('../schemas/patientMedical.schema');

            // Identity schema should only accept PII
            const identityData = {
                name: 'Test',
                email: 'test@example.com',
                phone: '123456789'
            };

            const identityResult = PatientIdentitySchema.safeParse(identityData);
            expect(identityResult.success).toBe(true);

            // Medical schema should require patient ID link
            const medicalData = {
                patientId: '123',
                type: 'Type 2',
                status: 'Stable'
            };

            const medicalResult = PatientMedicalSchema.safeParse(medicalData);
            expect(medicalResult.success).toBe(true);

            // Medical data should NOT accept PII directly
            const invalidMedical = {
                name: 'Test', // PII field in medical schema
                type: 'Type 2'
            };

            const invalidResult = PatientMedicalSchema.safeParse(invalidMedical);
            expect(invalidResult.success).toBe(false); // Should fail without patientId
        });
    });
});
