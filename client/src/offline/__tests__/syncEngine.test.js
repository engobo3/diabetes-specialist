import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../syncQueue', () => ({
    all: vi.fn(),
    size: vi.fn().mockResolvedValue(0),
    remove: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn().mockResolvedValue('cu')
}));

import * as queue from '../syncQueue';
import * as engine from '../syncEngine';

const getToken = vi.fn().mockResolvedValue('tok');

beforeEach(() => {
    vi.clearAllMocks();
    engine._resetState();
    queue.size.mockResolvedValue(0);
    queue.remove.mockResolvedValue(undefined);
    vi.stubEnv('VITE_OFFLINE_SYNC', 'on');
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('isEnabled', () => {
    it('reflects VITE_OFFLINE_SYNC', () => {
        vi.stubEnv('VITE_OFFLINE_SYNC', 'off');
        expect(engine.isEnabled()).toBe(false);
        vi.stubEnv('VITE_OFFLINE_SYNC', 'on');
        expect(engine.isEnabled()).toBe(true);
    });
});

describe('backoffMs', () => {
    it('grows, caps at 30s, stays within ±30%', () => {
        for (let a = 0; a < 12; a++) {
            const ms = engine.backoffMs(a);
            const capped = Math.min(30000, 1000 * 2 ** a);
            expect(ms).toBeGreaterThanOrEqual(Math.floor(capped * 0.7) - 1);
            expect(ms).toBeLessThanOrEqual(Math.ceil(capped * 1.3) + 1);
        }
    });
});

describe('flush', () => {
    it('no-ops when disabled', async () => {
        vi.stubEnv('VITE_OFFLINE_SYNC', 'off');
        const r = await engine.flush(getToken);
        expect(r).toEqual({ skipped: 'disabled' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('skips when offline', async () => {
        vi.stubGlobal('navigator', { onLine: false });
        const r = await engine.flush(getToken);
        expect(r).toEqual({ skipped: 'offline' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('returns empty when the queue is empty', async () => {
        queue.all.mockResolvedValue([]);
        const r = await engine.flush(getToken);
        expect(r).toEqual({ empty: true });
    });

    it('removes accepted+duplicate+rejected, keeps deferred, schedules retry', async () => {
        queue.all.mockResolvedValue([
            { client_uuid: 'a' }, { client_uuid: 'b' }, { client_uuid: 'c' }, { client_uuid: 'd' }
        ]);
        queue.size.mockResolvedValue(1);
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                results: [
                    { client_uuid: 'a', status: 'accepted' },
                    { client_uuid: 'b', status: 'duplicate' },
                    { client_uuid: 'c', status: 'rejected' },
                    { client_uuid: 'd', status: 'deferred' }
                ]
            })
        });
        const r = await engine.flush(getToken);
        expect(queue.remove).toHaveBeenCalledWith(['a', 'b', 'c']);
        expect(r).toMatchObject({ accepted: 1, duplicate: 1, rejected: 1, deferred: 1, remaining: 1 });
        expect(r.retryInMs).toBeGreaterThan(0);
    });

    it('resets retry when nothing deferred', async () => {
        queue.all.mockResolvedValue([{ client_uuid: 'a' }]);
        queue.size.mockResolvedValue(0);
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [{ client_uuid: 'a', status: 'accepted' }] })
        });
        const r = await engine.flush(getToken);
        expect(r.retryInMs).toBeNull();
        expect(r.remaining).toBe(0);
    });

    it('returns retryInMs on http error and does not touch the queue', async () => {
        queue.all.mockResolvedValue([{ client_uuid: 'a' }]);
        fetch.mockResolvedValue({ ok: false, status: 503 });
        const r = await engine.flush(getToken);
        expect(r).toMatchObject({ error: 'http', status: 503 });
        expect(r.retryInMs).toBeGreaterThan(0);
        expect(queue.remove).not.toHaveBeenCalled();
    });

    it('never throws on a network exception', async () => {
        queue.all.mockResolvedValue([{ client_uuid: 'a' }]);
        fetch.mockRejectedValue(new Error('network'));
        const r = await engine.flush(getToken);
        expect(r.error).toBe('exception');
        expect(r.retryInMs).toBeGreaterThan(0);
    });
});

describe('enqueueGlucose', () => {
    it('enqueues with type=glucose', async () => {
        await engine.enqueueGlucose({ client_uuid: 'cu', value_mg_dl: 100 });
        expect(queue.enqueue).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'glucose', client_uuid: 'cu', value_mg_dl: 100 })
        );
    });
});

describe('startAutoFlush', () => {
    it('returns a no-op when disabled', () => {
        vi.stubEnv('VITE_OFFLINE_SYNC', 'off');
        const stop = engine.startAutoFlush(getToken);
        expect(typeof stop).toBe('function');
        stop();
    });
});
