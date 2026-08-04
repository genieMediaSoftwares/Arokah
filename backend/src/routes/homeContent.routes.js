'use strict';

const express = require('express');
const controller = require('../controllers/homeContent.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { saveHomeContentRules } = require('../validators/homeContent.validator');

const router = express.Router();

// The homepage is public; editing it is not.
router.get('/', controller.getHomeContent);
router.put('/', protect, authorize('admin', 'staff'), validate(saveHomeContentRules), controller.saveHomeContent);
router.delete('/', protect, authorize('admin'), controller.clearHomeContent);

module.exports = router;
