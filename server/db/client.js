/**
 * Postgres Pool — lazy, env-driven, TLS-required-in-prod.
 *
 * Phase 1: the application can run with this module loaded but
 * `DATABASE_URL_PG` unset. In that case `getPool()` returns null and
 * `query()` is a no-op that returns an empty result with `_skipped: true`.
 * This keeps Postgres strictly additive while we dual-write — Firestore
 * stays the source of truth until later phases.
 *
 * In production (NODE_ENV === 'production'), missing `DATABASE_URL_PG`
 * throws on first access so a misconfiguration is caught at boot rather
 * than silently disabling audit writes.
 *
 * Connection URL convention:
 *   DATABASE_URL_PG       — used by the running app (role: app_rw)
 *   DATABASE_URL_PG_DDL   — used by node-pg-migrate (role: app_ddl)
 *
 * Pool settings:
 *   PG_POOL_MAX           — default 10
 *   PG_SSL=disable        — opt out of TLS for local Docker only
 */

// Lazy-require pg so that the rest of the app can load even if the dependency
// isn't installed (e.g. on a CI box that hasn't done `npm install` yet, or
// during Phase 1 dev when Postgres is optional). The first call to getPool()
// triggers the require; if it throws, we set _initFailed and Postgres writes
// become no-ops via the `_skipped: true` return from query().
let _pgPool = null;
function loadPgPool() {
    if (_pgPool) return _pgPool;
    try {
        _pgPool = require('pg').Pool;
        return _pgPool;
    } catch (err) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('pg module is required in production but failed to load: ' + err.message);
        }
        return null;
    }
}

let _pool = null;
let _initFailed = false;

function getPool() {
    if (_pool) return _pool;
    if (_initFailed) return null;

    const connectionString = process.env.DATABASE_URL_PG;
    if (!connectionString) {
        if (process.env.NODE_ENV === 'production') {
            _initFailed = true;
            throw new Error(
                'DATABASE_URL_PG must be set in production (Phase 1 dual-write requires Postgres)'
            );
        }
        // Dev: Postgres is optional during early Phase 1.
        // Warn once and disable subsequent attempts to avoid log spam.
        if (!_initFailed) {
            console.warn(
                '[db] DATABASE_URL_PG not set — Postgres dual-write disabled (dev only).'
            );
            _initFailed = true;
        }
        return null;
    }

    const Pool = loadPgPool();
    if (!Pool) {
        _initFailed = true;
        console.warn('[db] pg module not installed — Postgres dual-write disabled (dev only).');
        return null;
    }

    try {
        _pool = new Pool({
            connectionString,
            // RDS af-south-1 enforces TLS. Local Docker can opt out via PG_SSL=disable.
            ssl: process.env.PG_SSL === 'disable'
                ? false
                : { rejectUnauthorized: true },
            max: parseInt(process.env.PG_POOL_MAX || '10', 10),
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
            statement_timeout: 10_000,        // protect against runaway queries
            query_timeout: 10_000,
            application_name: 'glucosoin-api'
        });

        // Background errors (idle client lost, network blip) — log and let the
        // pool reconnect on next query. Throwing here would crash the process.
        _pool.on('error', (err) => {
            console.error('[db] Pool background error:', err.code || err.name, err.message);
        });

        return _pool;
    } catch (err) {
        _initFailed = true;
        console.error('[db] Failed to initialize Postgres pool:', err.message);
        return null;
    }
}

/**
 * Parameterized query wrapper. Always-safe: returns an empty result with
 * `_skipped: true` when the pool isn't configured, so callers can dual-write
 * without branching.
 */
async function query(text, params = []) {
    const pool = getPool();
    if (!pool) {
        return { rows: [], rowCount: 0, _skipped: true };
    }
    return pool.query(text, params);
}

/**
 * Health check — returns { ok, latencyMs, ... } without throwing.
 * Used by /api/health/pg in a later phase.
 */
async function healthcheck() {
    const pool = getPool();
    if (!pool) return { ok: false, reason: 'pool_not_configured' };
    const start = Date.now();
    try {
        const r = await pool.query('SELECT 1 AS ok');
        return {
            ok: r.rows[0]?.ok === 1,
            latencyMs: Date.now() - start,
            totalClients: pool.totalCount,
            idleClients: pool.idleCount,
            waitingClients: pool.waitingCount
        };
    } catch (err) {
        return { ok: false, reason: err.code || err.name, latencyMs: Date.now() - start };
    }
}

async function shutdown() {
    if (_pool) {
        await _pool.end();
        _pool = null;
    }
}

module.exports = { getPool, query, healthcheck, shutdown };
