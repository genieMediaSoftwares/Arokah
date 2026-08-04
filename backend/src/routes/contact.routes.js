'use strict';

const express = require('express');
const controller = require('../controllers/contact.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { publicWriteLimiter } = require('../middleware/rateLimit');
const {
  submitEnquiryRules,
  listEnquiriesRules,
  updateEnquiryStatusRules,
} = require('../validators/contact.validator');

const router = express.Router();

// Public form — rate limited because it triggers outbound email.
router.post('/', publicWriteLimiter, validate(submitEnquiryRules), controller.submitEnquiry);

router.get('/', protect, authorize('admin', 'staff'), validate(listEnquiriesRules), controller.listEnquiries);
router.patch('/:id/status', protect, authorize('admin', 'staff'), validate(updateEnquiryStatusRules), controller.updateEnquiryStatus);

module.exports = router;
