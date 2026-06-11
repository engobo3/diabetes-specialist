/**
 * Schemas for the offline-sync endpoints (Phase 4a).
 *
 * The client batches append-only records into POST /api/sync/batch. For v1
 * only glucose readings are syncable (append-only, no merge conflicts per the
 * brief). The discriminated union makes adding `message` etc. later a one-line
 * change.
 */

const { z } = require('zod');

const GlucoseSyncItemSchema = z.object({
    type: z.literal('glucose'),
    // Client-generated idempotency key (uuid v4 from the device).
    client_uuid: z.string().uuid('client_uuid must be a UUID'),
    value_mg_dl: z.coerce.number().int().min(0).max(2000),
    measured_at: z.string().min(1),                 // ISO timestamp (device-stated)
    context: z.enum(['fasting', 'pre_meal', 'post_meal', 'bedtime', 'random', 'unknown']).optional(),
    source: z.enum(['manual', 'glucometer', 'cgm']).optional(),
    notes: z.string().max(2000).optional()
});

// Discriminated union — extend with message/vital item types in later phases.
const SyncItemSchema = z.discriminatedUnion('type', [GlucoseSyncItemSchema]);

const SyncBatchSchema = z.object({
    items: z.array(SyncItemSchema).min(1, 'batch must contain at least one item').max(500, 'batch too large')
});

const SyncChangesQuerySchema = z.object({
    // Server-clock high-water-mark (ISO). Absent → full pull.
    since: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    type: z.enum(['glucose']).optional()
});

module.exports = {
    GlucoseSyncItemSchema,
    SyncItemSchema,
    SyncBatchSchema,
    SyncChangesQuerySchema
};
