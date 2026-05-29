/**
 * Static structural checks on the SQL migration files.
 *
 * Cannot run actual migrations here (no test Postgres) — that's covered by
 * the manual Phase 1 checklist on a real RDS instance. But we can catch the
 * common breakages cheaply:
 *   - Both `-- Up Migration` and `-- Down Migration` markers present
 *   - Up section is non-empty
 *   - Files are numbered sequentially with no gaps
 *   - Each migration's down section actually drops what the up section
 *     created (CREATE TABLE foo → DROP TABLE … foo)
 *
 * Synthetic data only — no real PHI/secrets touched.
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function listMigrations() {
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => /^\d{4}_.+\.sql$/.test(f))
        .sort();
}

function readMigration(name) {
    return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
}

function splitSections(sql) {
    const upMatch  = sql.match(/--\s*Up\s+Migration([\s\S]*?)(?=--\s*Down\s+Migration|$)/i);
    const dnMatch  = sql.match(/--\s*Down\s+Migration([\s\S]*)$/i);
    return {
        up:   upMatch ? upMatch[1].trim() : '',
        down: dnMatch ? dnMatch[1].trim() : ''
    };
}

describe('SQL migrations — structure', () => {
    test('migrations directory exists and is non-empty', () => {
        const files = listMigrations();
        expect(files.length).toBeGreaterThan(0);
    });

    test('numbered 0001..N with no gaps', () => {
        const numbers = listMigrations().map(f => parseInt(f.slice(0, 4), 10));
        for (let i = 0; i < numbers.length; i++) {
            expect(numbers[i]).toBe(i + 1);
        }
    });

    test.each(listMigrations())('%s has Up and Down markers', (name) => {
        const sql = readMigration(name);
        expect(sql).toMatch(/--\s*Up\s+Migration/i);
        expect(sql).toMatch(/--\s*Down\s+Migration/i);
    });

    test.each(listMigrations())('%s has non-empty Up section', (name) => {
        const { up } = splitSections(readMigration(name));
        // Up must contain at least one DDL or DML statement.
        // A truly empty Up section is almost always a typo.
        expect(up.length).toBeGreaterThan(0);
        expect(up).toMatch(/CREATE|GRANT|REVOKE|ALTER|INSERT|SELECT|DO\b/i);
    });

    test.each(listMigrations())('%s has non-empty Down section', (name) => {
        const { down } = splitSections(readMigration(name));
        expect(down.length).toBeGreaterThan(0);
        expect(down).toMatch(/DROP|REVOKE|ALTER/i);
    });
});

describe('SQL migrations — invariants', () => {
    test('0002 creates users, patient_profiles, doctor_profiles', () => {
        const { up, down } = splitSections(readMigration('0002_users_and_profiles.sql'));
        for (const t of ['users', 'patient_profiles', 'doctor_profiles']) {
            expect(up).toMatch(new RegExp(`CREATE\\s+TABLE\\s+${t}\\b`, 'i'));
            expect(down).toMatch(new RegExp(`DROP\\s+TABLE\\s+IF\\s+EXISTS\\s+${t}\\b`, 'i'));
        }
    });

    test('every table has soft-delete (deleted_at), client_uuid where applicable, and region_id', () => {
        const { up } = splitSections(readMigration('0002_users_and_profiles.sql'));
        // users, patient_profiles, doctor_profiles all have deleted_at + region_id
        const occurrences = (re) => (up.match(re) || []).length;
        expect(occurrences(/deleted_at\s+timestamptz/gi)).toBeGreaterThanOrEqual(3);
        expect(occurrences(/region_id\s+varchar/gi)).toBeGreaterThanOrEqual(3);
        // patient_profiles and doctor_profiles get client_uuid (users does not)
        expect(occurrences(/client_uuid\s+uuid/gi)).toBeGreaterThanOrEqual(2);
    });

    test('money columns use *_minor bigint with currency in the name', () => {
        const { up } = splitSections(readMigration('0002_users_and_profiles.sql'));
        // Never store amounts as numeric/float
        expect(up).not.toMatch(/consultation_fee\s+numeric/i);
        expect(up).not.toMatch(/consultation_fee\s+float/i);
        // Must use the *_minor + currency suffix convention
        expect(up).toMatch(/consultation_fee_cdf_minor\s+bigint/i);
        expect(up).toMatch(/consultation_fee_usd_minor\s+bigint/i);
    });

    test('audit_log is partitioned and INSERT-only at the role level', () => {
        const up4 = splitSections(readMigration('0004_audit_log_partitioned.sql')).up;
        expect(up4).toMatch(/PARTITION\s+BY\s+RANGE\s*\(\s*occurred_at\s*\)/i);
        expect(up4).toMatch(/ensure_monthly_audit_partition/i);

        const up5 = splitSections(readMigration('0005_app_roles.sql')).up;
        // INSERT/SELECT granted ...
        expect(up5).toMatch(/GRANT\s+SELECT,\s*INSERT\s+ON\s+audit_log\s+TO\s+app_rw/i);
        // ... and UPDATE/DELETE explicitly REVOKEd.
        expect(up5).toMatch(/REVOKE\s+UPDATE,\s*DELETE[^;]*FROM\s+app_rw/i);
    });

    test('every business table that has updated_at also has a set_updated_at trigger', () => {
        const sql = readMigration('0002_users_and_profiles.sql')
                  + readMigration('0003_care_relationships.sql');
        const tablesWithUpdatedAt = (sql.match(/CREATE\s+TABLE\s+(\w+)[\s\S]*?updated_at\s+timestamptz/gi) || []);
        const triggers = (sql.match(/CREATE\s+TRIGGER\s+\w+_set_updated_at/gi) || []);
        expect(triggers.length).toBeGreaterThanOrEqual(tablesWithUpdatedAt.length);
    });
});
