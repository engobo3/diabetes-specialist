/**
 * Timezone conversion helpers — no external dependencies (Intl-based).
 *
 * Why no library: schedule times are stored as LOCAL 'HH:MM' strings and must
 * be converted to UTC instants at reminder-generation time using the patient's
 * IANA timezone (brief requirement). luxon/date-fns-tz would do this, but npm
 * installs are unreliable on this machine and Node's Intl carries the full tz
 * database, so a 40-line converter avoids the dependency entirely.
 *
 * Algorithm (localToUtc): guess the UTC instant as if the wall time were UTC,
 * ask Intl what wall time the target tz shows at that instant, and correct by
 * the difference. One re-check handles DST transitions (Africa/Kinshasa has no
 * DST, but the patient timezone column is general-purpose).
 *
 * Nonexistent local times (inside a spring-forward gap) resolve deterministically
 * to a valid nearby instant rather than failing — acceptable for reminders.
 */

const DEFAULT_TZ = 'Africa/Kinshasa';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Offset in minutes such that localWallClock = utc + offset, at the given
 * UTC instant, in the given IANA timezone. Throws RangeError on a bad tz.
 */
function tzOffsetMinutes(utcMs, tz) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = {};
    for (const p of dtf.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
    const shownAsUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour) % 24,   // some ICU builds emit '24' at midnight
        Number(parts.minute),
        Number(parts.second)
    );
    return (shownAsUtc - utcMs) / 60000;
}

/**
 * Convert a LOCAL wall-clock (dateStr 'YYYY-MM-DD' + timeStr 'HH:MM') in `tz`
 * to a UTC Date. Returns null on malformed date/time. Falls back to
 * Africa/Kinshasa if the tz string is invalid.
 */
function localToUtc(dateStr, timeStr, tz = DEFAULT_TZ) {
    if (typeof dateStr !== 'string' || !DATE_RE.test(dateStr)) return null;
    if (typeof timeStr !== 'string' || !TIME_RE.test(timeStr)) return null;

    const [y, mo, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    const wallAsUtc = Date.UTC(y, mo - 1, d, hh, mm);

    let zone = tz || DEFAULT_TZ;
    let offset;
    try {
        offset = tzOffsetMinutes(wallAsUtc, zone);
    } catch (err) {
        zone = DEFAULT_TZ;
        offset = tzOffsetMinutes(wallAsUtc, zone);
    }

    let utcMs = wallAsUtc - offset * 60000;
    // Re-check once: if the first guess straddled a DST transition the offset
    // at the corrected instant may differ.
    const offset2 = tzOffsetMinutes(utcMs, zone);
    if (offset2 !== offset) {
        utcMs = wallAsUtc - offset2 * 60000;
    }
    return new Date(utcMs);
}

/**
 * The calendar date ('YYYY-MM-DD') that `date` falls on in `tz`.
 * Used by the generator to iterate "the patient's next N days".
 */
function isoDateInTz(date, tz = DEFAULT_TZ) {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(date);
    } catch (err) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(date);
    }
}

module.exports = { localToUtc, isoDateInTz, tzOffsetMinutes, DEFAULT_TZ, TIME_RE };
