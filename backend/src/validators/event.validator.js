'use strict';

const { body, query } = require('express-validator');
const { EVENT_STATUSES, EXTRA_CATEGORIES } = require('../models/Event');
const { imageUrl, paginationQuery } = require('./common.validator');

const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_12H = /^(1[0-2]|[1-9]):[0-5]\d\s?(AM|PM)$/i;

const optionalText = (field, max) =>
  body(field).optional({ values: 'null' }).trim().isLength({ max }).withMessage(`Must be at most ${max} characters`);

const extrasRules = [
  body('extras').optional().isArray({ max: 100 }).withMessage('extras must be an array'),
  body('extras.*.key').optional().trim().isLength({ max: 64 }),
  body('extras.*.id').optional().trim().isLength({ max: 64 }),
  body('extras.*.category').optional().isIn(EXTRA_CATEGORIES).withMessage('Invalid add-on category'),
  body('extras.*.name').optional({ values: 'null' }).trim().isLength({ max: 200 }),
  body('extras.*.description').optional({ values: 'null' }).trim().isLength({ max: 1000 }),
  body('extras.*.price').optional({ values: 'null' }).trim().isLength({ max: 50 }),
  imageUrl(body('extras.*.imageURL')),
];

const sharedEventRules = [
  optionalText('type', 100),
  // Free text so "Free", "₹499" and "1200 onwards" all keep working; the numeric
  // amount used for payments is derived server-side by Event.parsePrice.
  optionalText('price', 50),
  optionalText('phone', 20),
  optionalText('location', 300),
  optionalText('description', 10000),
  body('eventDate')
    .optional({ values: 'falsy' })
    .trim()
    .isISO8601()
    .withMessage('eventDate must be an ISO date (YYYY-MM-DD)'),
  body('startTime').optional({ values: 'falsy' }).trim().matches(TIME_24H).withMessage('startTime must be HH:mm'),
  body('endTime').optional({ values: 'falsy' }).trim().matches(TIME_24H).withMessage('endTime must be HH:mm'),
  body('startTime12h').optional({ values: 'falsy' }).trim().matches(TIME_12H).withMessage('startTime12h must look like 7:30 PM'),
  body('endTime12h').optional({ values: 'falsy' }).trim().matches(TIME_12H).withMessage('endTime12h must look like 9:00 PM'),
  body('status').optional().isIn(EVENT_STATUSES).withMessage(`status must be one of: ${EVENT_STATUSES.join(', ')}`),
  ...extrasRules,
];

const createEventRules = [
  body('title').trim().notEmpty().withMessage('Event title is required').isLength({ max: 200 }),
  imageUrl(body('mainImage'), { required: true }),
  ...sharedEventRules,
];

const updateEventRules = [
  body('title').optional().trim().notEmpty().withMessage('Event title cannot be empty').isLength({ max: 200 }),
  imageUrl(body('mainImage')),
  ...sharedEventRules,
];

const listEventsRules = [
  query('status').optional().isIn([...EVENT_STATUSES, 'all']).withMessage('Invalid status filter'),
  query('search').optional().trim().isLength({ max: 120 }),
  ...paginationQuery(),
];

module.exports = { createEventRules, updateEventRules, listEventsRules };
