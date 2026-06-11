const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireAuthenticated } = require('../middleware/rbacMiddleware');
const { validateBody, validateQuery } = require('../middleware/validationMiddleware');
const { SyncBatchSchema, SyncChangesQuerySchema } = require('../schemas/sync.schema');
const { syncBatch, getChanges } = require('../controllers/syncController');

// All sync endpoints are patient-self-scoped: the controller resolves the
// patient_profile from the token, never from the request body.
router.use(verifyToken);

router.post('/batch',
    requireAuthenticated,
    validateBody(SyncBatchSchema),
    syncBatch
);

router.get('/changes',
    requireAuthenticated,
    validateQuery(SyncChangesQuerySchema),
    getChanges
);

module.exports = router;
