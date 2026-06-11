import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory idb-keyval mock.
let store = {};
vi.mock('idb-keyval', () => ({
    get: vi.fn(async (k) => store[k]),
    set: vi.fn(async (k, v) => { store[k] = v; }),
    del: vi.fn(async (k) => { delete store[k]; }),
    update: vi.fn(async (k, fn) => { store[k] = fn(store[k]); })
}));

import * as queue from '../syncQueue';

beforeEach(() => { store = {}; });

describe('syncQueue', () => {
    it('enqueues items and dedupes by client_uuid', async () => {
        await queue.enqueue({ client_uuid: 'a', value_mg_dl: 100 });
        await queue.enqueue({ client_uuid: 'a', value_mg_dl: 100 }); // duplicate — ignored
        await queue.enqueue({ client_uuid: 'b', value_mg_dl: 120 });
        expect(await queue.size()).toBe(2);
    });

    it('throws when enqueuing without client_uuid', async () => {
        await expect(queue.enqueue({ value_mg_dl: 100 })).rejects.toThrow(/client_uuid/);
    });

    it('removes by client_uuid list', async () => {
        await queue.enqueue({ client_uuid: 'a' });
        await queue.enqueue({ client_uuid: 'b' });
        await queue.enqueue({ client_uuid: 'c' });
        await queue.remove(['a', 'c']);
        const remaining = (await queue.all()).map(i => i.client_uuid);
        expect(remaining).toEqual(['b']);
    });

    it('remove with empty list is a no-op', async () => {
        await queue.enqueue({ client_uuid: 'a' });
        await queue.remove([]);
        expect(await queue.size()).toBe(1);
    });

    it('clear empties the queue', async () => {
        await queue.enqueue({ client_uuid: 'a' });
        await queue.clear();
        expect(await queue.size()).toBe(0);
    });

    it('watermark round-trips; ignores empty set', async () => {
        expect(await queue.getWatermark()).toBeNull();
        await queue.setWatermark('2026-03-01T10:00:00Z');
        expect(await queue.getWatermark()).toBe('2026-03-01T10:00:00Z');
        await queue.setWatermark(null); // ignored
        expect(await queue.getWatermark()).toBe('2026-03-01T10:00:00Z');
    });
});
