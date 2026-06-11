const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireAuthenticated } = require('../middleware/rbacMiddleware');
const { validateBody, validateParams, validateQuery } = require('../middleware/validationMiddleware');
const { IdParamSchema } = require('../schemas/common.schema');
const { AckSchema, SnoozeSchema, ReminderListQuerySchema } = require('../schemas/reminder.schema');
const { listMyReminders, ackReminder, snoozeReminder } = require('../controllers/reminderController');

// Patient-self-scoped: the controller resolves the patient_profile from the
// token. Staff roles get empty results — doctor-facing adherence views are a
// later feature on top of the same table.
router.use(verifyToken);

router.get('/',
    requireAuthenticated,
    validateQuery(ReminderListQuerySchema),
    listMyReminders
);

router.post('/:id/ack',
    requireAuthenticated,
    validateParams(IdParamSchema),
    validateBody(AckSchema),
    ackReminder
);

router.post('/:id/snooze',
    requireAuthenticated,
    validateParams(IdParamSchema),
    validateBody(SnoozeSchema),
    snoozeReminder
);

module.exports = router;
