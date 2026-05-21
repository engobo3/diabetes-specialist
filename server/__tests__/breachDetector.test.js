const {
    detectBulkPatientAccess,
    detectMassExports,
    detectRbacDenialSpike,
    detectOffHoursAccess
} = require('../services/breachDetector');

function tsMinAgo(min) {
    return new Date(Date.now() - min * 60 * 1000).toISOString();
}

describe('breachDetector', () => {
    describe('detectBulkPatientAccess', () => {
        it('flags a user accessing > 50 distinct patients in 15 min', async () => {
            const logs = [];
            for (let i = 0; i < 60; i++) {
                logs.push({
                    eventType: 'data_access',
                    userId: 'bad_actor',
                    userRole: 'doctor',
                    resourceId: `patient_${i}`,
                    timestamp: tsMinAgo(5)
                });
            }
            const findings = await detectBulkPatientAccess(logs);
            expect(findings.length).toBe(1);
            expect(findings[0].pattern).toBe('bulk_patient_access');
            expect(findings[0].userId).toBe('bad_actor');
            expect(findings[0].severity).toBe('critical');
        });

        it('does not flag normal access (a few patients)', async () => {
            const logs = [];
            for (let i = 0; i < 5; i++) {
                logs.push({
                    eventType: 'data_access',
                    userId: 'normal_doc',
                    userRole: 'doctor',
                    resourceId: `patient_${i}`,
                    timestamp: tsMinAgo(2)
                });
            }
            const findings = await detectBulkPatientAccess(logs);
            expect(findings.length).toBe(0);
        });

        it('ignores accesses outside the window', async () => {
            const logs = [];
            for (let i = 0; i < 60; i++) {
                logs.push({
                    eventType: 'data_access',
                    userId: 'old_actor',
                    userRole: 'doctor',
                    resourceId: `patient_${i}`,
                    timestamp: tsMinAgo(30)  // outside 15-min window
                });
            }
            const findings = await detectBulkPatientAccess(logs);
            expect(findings.length).toBe(0);
        });
    });

    describe('detectMassExports', () => {
        it('flags a user exporting many dossiers', async () => {
            const logs = [];
            for (let i = 0; i < 25; i++) {
                logs.push({
                    action: 'export',
                    userId: 'exporter',
                    userRole: 'doctor',
                    resourceId: `patient_${i}`,
                    timestamp: tsMinAgo(60)
                });
            }
            const findings = await detectMassExports(logs);
            expect(findings.length).toBe(1);
            expect(findings[0].pattern).toBe('mass_export');
            expect(findings[0].metadata.exportCount).toBe(25);
        });

        it('does not flag normal export volume', async () => {
            const logs = [
                { action: 'export', userId: 'doc1', resourceId: 'p1', timestamp: tsMinAgo(60) },
                { action: 'export', userId: 'doc1', resourceId: 'p2', timestamp: tsMinAgo(45) }
            ];
            const findings = await detectMassExports(logs);
            expect(findings.length).toBe(0);
        });
    });

    describe('detectRbacDenialSpike', () => {
        it('flags a user with many denials in 1 hour', async () => {
            const logs = [];
            for (let i = 0; i < 15; i++) {
                logs.push({
                    eventType: 'rbac_denied',
                    userId: 'enumerator',
                    timestamp: tsMinAgo(30)
                });
            }
            const findings = await detectRbacDenialSpike(logs);
            expect(findings.length).toBe(1);
            expect(findings[0].pattern).toBe('rbac_denial_spike');
        });

        it('does not flag a single denial', async () => {
            const logs = [{ eventType: 'rbac_denied', userId: 'oops', timestamp: tsMinAgo(5) }];
            const findings = await detectRbacDenialSpike(logs);
            expect(findings.length).toBe(0);
        });
    });

    describe('detectOffHoursAccess', () => {
        it('skips admin users (expected to be on-call)', async () => {
            // Force a fake off-hours timestamp on the log
            const offHours = new Date();
            offHours.setHours(23, 0, 0);
            const logs = [];
            for (let i = 0; i < 15; i++) {
                logs.push({
                    eventType: 'data_access',
                    userId: 'admin1',
                    userRole: 'admin',
                    resourceId: `p${i}`,
                    timestamp: offHours.toISOString()
                });
            }
            const findings = await detectOffHoursAccess(logs);
            expect(findings.length).toBe(0);
        });
    });
});
