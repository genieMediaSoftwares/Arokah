'use strict';

const { body, query } = require('express-validator');
const { CONTACT_STATUSES } = require('../models/ContactMessage');
const { paginationQuery, objectIdParam } = require('./common.validator');

// Mirrors exactly what the existing Contact.jsx form collects and requires.
const submitEnquiryRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .bail()
    .matches(/^[0-9+\-()\s]{6,20}$/)
    .withMessage('Enter a valid phone number'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('eventName').trim().notEmpty().withMessage('Event name is required').isLength({ max: 200 }),
  body('members').optional({ values: 'falsy' }).trim().isLength({ max: 50 }),
  body('message').optional({ values: 'falsy' }).trim().isLength({ max: 5000 }),
];

const listEnquiriesRules = [
  query('status').optional().isIn([...CONTACT_STATUSES, 'all']).withMessage('Invalid status filter'),
  ...paginationQuery(),
];

const updateEnquiryStatusRules = [
  objectIdParam('id'),
  body('status').isIn(CONTACT_STATUSES).withMessage(`status must be one of: ${CONTACT_STATUSES.join(', ')}`),
];

module.exports = { submitEnquiryRules, listEnquiriesRules, updateEnquiryStatusRules };
