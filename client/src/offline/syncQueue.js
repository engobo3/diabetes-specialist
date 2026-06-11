/**
 * Offline outbox — an IndexedDB-backed queue of append-only records waiting to
 * sync to the server. Uses idb-keyval (already a dependency, used for the React
 * Query cache).
 *
 * Items are deduped by client_uuid on enqueue, and removed by client_uuid once
 * the server confirms them (accepted | duplicate | rejected). `deferred` items
 * stay queued.
 *
 * Phase 4a: the queue + engine exist and are tested but inert by default — the
 * glucose entry form is not rewired to use them until VITE_OFFLINE_SYNC=on
 * (post read-cutover).
 */

import { get, set, del, update } from 'idb-keyval';

const QUEUE_KEY = 'glucocare:sync:outbox';
const WATERMARK_KEY = 'glucocare:sync:watermark';

/** Add an item if its client_uuid isn't already queued. Atomic via idb update(). */
export async function enqueue(item) {
    if (!item || !item.client_uuid) {
        throw new Error('enqueue requires an item with a client_uuid');
    }
    await update(QUEUE_KEY, (q = []) =>
        q.some(i => i.client_uuid === item.client_uuid) ? q : [...q, item]
    );
    return item.client_uuid;
}

export async function all() {
    return (await get(QUEUE_KEY)) || [];
}

export async function size() {
    return ((await get(QUEUE_KEY)) || []).length;
}

/** Remove every item whose client_uuid is in the given list. */
export async function remove(clientUuids) {
    if (!clientUuids || clientUuids.length === 0) return;
    const drop = new Set(clientUuids);
    await update(QUEUE_KEY, (q = []) => q.filter(i => !drop.has(i.client_uuid)));
}

export async function clear() {
    await del(QUEUE_KEY);
}

/** Server-clock high-water-mark for down-sync (never the device clock). */
export async function getWatermark() {
    return (await get(WATERMARK_KEY)) || null;
}

export async function setWatermark(watermark) {
    if (watermark) await set(WATERMARK_KEY, watermark);
}
