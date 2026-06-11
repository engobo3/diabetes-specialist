/**
 * Tests for utils/timezone.js — pure functions, no mocks.
 *
 * Africa/Kinshasa is UTC+1 with no DST (the launch market). Europe/Paris is
 * included purely to prove the converter handles DST-observing zones, since
 * notification_preferences.timezone is general-purpose.
 */

const { localToUtc, isoDateInTz, DEFAULT_TZ } = require('../utils/timezone');

describe('localToUtc', () => {
    test('Africa/Kinshasa (UTC+1, no DST): 08:00 local = 07:00Z', () => {
        const d = localToUtc('2026-06-15', '08:00', 'Africa/Kinshasa');
        expect(d.toISOString()).toBe('2026-06-15T07:00:00.000Z');
    });

    test('Africa/Kinshasa: same offset in January (no DST)', () => {
        const d = localToUtc('2026-01-15', '20:00', 'Africa/Kinshasa');
        expect(d.toISOString()).toBe('2026-01-15T19:00:00.000Z');
    });

    test('Europe/Paris summer (UTC+2): 08:00 local = 06:00Z', () => {
        const d = localToUtc('2026-06-15', '08:00', 'Europe/Paris');
        expect(d.toISOString()).toBe('2026-06-15T06:00:00.000Z');
    });

    test('Europe/Paris winter (UTC+1): 08:00 local = 07:00Z', () => {
        const d = localToUtc('2026-01-15', '08:00', 'Europe/Paris');
        expect(d.toISOString()).toBe('2026-01-15T07:00:00.000Z');
    });

    test('DST spring-forward gap resolves to a valid Date (no crash)', () => {
        // 2026-03-29 02:30 does not exist in Europe/Paris (02:00 → 03:00).
        const d = localToUtc('2026-03-29', '02:30', 'Europe/Paris');
        expect(d).toBeInstanceOf(Date);
        expect(Number.isFinite(d.getTime())).toBe(true);
    });

    test('invalid date / time formats return null', () => {
        expect(localToUtc('2026-6-1', '08:00')).toBeNull();
        expect(localToUtc('not-a-date', '08:00')).toBeNull();
        expect(localToUtc('2026-06-15', '8:00')).toBeNull();
        expect(localToUtc('2026-06-15', '24:00')).toBeNull();
        expect(localToUtc(null, '08:00')).toBeNull();
        expect(localToUtc('2026-06-15', null)).toBeNull();
    });

    test('unknown timezone falls back to Africa/Kinshasa', () => {
        const bad = localToUtc('2026-06-15', '08:00', 'Mars/Olympus_Mons');
        const kin = localToUtc('2026-06-15', '08:00', 'Africa/Kinshasa');
        expect(bad.toISOString()).toBe(kin.toISOString());
    });

    test('default tz is Africa/Kinshasa', () => {
        expect(DEFAULT_TZ).toBe('Africa/Kinshasa');
        const d = localToUtc('2026-06-15', '08:00');
        expect(d.toISOString()).toBe('2026-06-15T07:00:00.000Z');
    });
});

describe('isoDateInTz', () => {
    test('rolls the calendar date forward across midnight in the target tz', () => {
        // 23:30Z is already 00:30 next day in Kinshasa (+1).
        expect(isoDateInTz(new Date('2026-06-15T23:30:00Z'), 'Africa/Kinshasa')).toBe('2026-06-16');
        expect(isoDateInTz(new Date('2026-06-15T10:00:00Z'), 'Africa/Kinshasa')).toBe('2026-06-15');
    });

    test('falls back to Kinshasa on a bad tz', () => {
        expect(isoDateInTz(new Date('2026-06-15T10:00:00Z'), 'Bad/Zone')).toBe('2026-06-15');
    });
});
