/**
 * Sync engine — flushes the offline outbox to POST /api/sync/batch with
 * exponential backoff + jitter, and exposes a down-sync helper.
 *
 * Gated by VITE_OFFLINE_SYNC (default unset → 'off'). When disabled, flush()
 * and startAutoFlush() are no-ops, so this is completely inert until we flip
 * the flag after the glucose read-cutover.
 *
 * Server response statuses (see syncController):
 *   accepted | duplicate → synced, remove from queue
 *   rejected             → permanently bad, remove (server logged it)
 *   deferred             → keep queued, retry with backoff
 */

import * as queue from './syncQueue';

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const MAX_ATTEMPTS = 8;

let _flushing = false;
let _attempt = 0;

export function isEnabled() {
    return import.meta.env.VITE_OFFLINE_SYNC === 'on';
}

/** Exponential backoff with ±30% jitter, capped at MAX_BACKOFF_MS. */
export function backoffMs(attempt) {
    const capped = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
    const jitter = capped * 0.3 * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(capped + jitter));
}

/** Queue a glucose reading for sync. `reading` needs a client_uuid. */
export async function enqueueGlucose(reading) {
    return queue.enqueue({ type: 'glucose', ...reading });
}

/**
 * Flush the outbox once.
 * @param {() => Promise<string>} getToken  returns a fresh Firebase ID token
 * @returns {Promise<object>} a result summary (never throws)
 */
export async function flush(getToken) {
    if (!isEnabled()) return { skipped: 'disabled' };
    if (_flushing) return { skipped: 'busy' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { skipped: 'offline' };
    }

    _flushing = true;
    try {
        const items = await queue.all();
        if (items.length === 0) {
            _attempt = 0;
            return { empty: true };
        }

        const token = await getToken();
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/sync/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ items })
        });

        if (!res.ok) {
            _attempt = Math.min(MAX_ATTEMPTS, _attempt + 1);
            return { error: 'http', status: res.status, retryInMs: backoffMs(_attempt) };
        }

        const body = await res.json();
        const results = Array.isArray(body.results) ? body.results : [];

        const byStatus = { accepted: [], duplicate: [], rejected: [], deferred: [] };
        for (const r of results) {
            if (byStatus[r.status]) byStatus[r.status].push(r.client_uuid);
        }

        // accepted + duplicate are synced; rejected is permanently bad (drop, it's
        // logged server-side). deferred stays queued for the next attempt.
        const toRemove = [...byStatus.accepted, ...byStatus.duplicate, ...byStatus.rejected];
        if (toRemove.length) await queue.remove(toRemove);

        // Reset backoff only when nothing is left deferred.
        _attempt = byStatus.deferred.length ? Math.min(MAX_ATTEMPTS, _attempt + 1) : 0;

        return {
            accepted: byStatus.accepted.length,
            duplicate: byStatus.duplicate.length,
            rejected: byStatus.rejected.length,
            deferred: byStatus.deferred.length,
            remaining: await queue.size(),
            retryInMs: byStatus.deferred.length ? backoffMs(_attempt) : null
        };
    } catch (err) {
        _attempt = Math.min(MAX_ATTEMPTS, _attempt + 1);
        return { error: 'exception', retryInMs: backoffMs(_attempt) };
    } finally {
        _flushing = false;
    }
}

/**
 * Start auto-flushing: on `online` events and on an interval. Returns a cleanup
 * function. No-op (returns a no-op cleanup) when sync is disabled.
 */
export function startAutoFlush(getToken, { intervalMs = 60000 } = {}) {
    if (!isEnabled()) return () => {};

    const onOnline = () => { flush(getToken); };
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
    const timer = setInterval(() => flush(getToken), intervalMs);

    // Kick an immediate attempt.
    flush(getToken);

    return () => {
        if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
        clearInterval(timer);
    };
}

/** Test seam: reset internal backoff/flush state. */
export function _resetState() {
    _flushing = false;
    _attempt = 0;
}
