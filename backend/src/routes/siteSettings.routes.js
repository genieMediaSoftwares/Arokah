'use strict';

const express = require('express');
const controller = require('../controllers/siteSettings.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { saveSiteSettingsRules } = require('../validators/siteSettings.validator');

const router = express.Router();

// Public read — the navbar, footer and contact page need these on every visit.
router.get('/', controller.getSettings);
router.put('/', protect, authorize('admin', 'staff'), validate(saveSiteSettingsRules), controller.saveSettings);

module.exports = router;
