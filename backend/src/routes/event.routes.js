'use strict';

const express = require('express');
const controller = require('../controllers/event.controller');
const validate = require('../middleware/validate');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { idParam } = require('../validators/common.validator');
const { createEventRules, updateEventRules, listEventsRules } = require('../validators/event.validator');

const router = express.Router();

// Public reads. `optionalAuth` only changes visibility (staff also see
// cancelled/completed events); anonymous visitors still get the live listing.
router.get('/', optionalAuth, validate(listEventsRules), controller.listEvents);
router.get('/stats', protect, authorize('admin', 'staff'), controller.getStats);
router.get('/:id', optionalAuth, validate([idParam('id')]), controller.getEvent);

// Writes are admin-only.
router.post('/', protect, authorize('admin', 'staff'), validate(createEventRules), controller.createEvent);
router.put('/:id', protect, authorize('admin', 'staff'), validate([idParam('id'), ...updateEventRules]), controller.updateEvent);
router.patch('/:id', protect, authorize('admin', 'staff'), validate([idParam('id'), ...updateEventRules]), controller.updateEvent);
router.delete('/:id', protect, authorize('admin'), validate([idParam('id')]), controller.deleteEvent);

module.exports = router;
