'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const controller = require('../controllers/admin.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { objectIdParam, paginationQuery } = require('../validators/common.validator');
const { ROLES } = require('../models/User');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/dashboard', controller.getDashboard);

router.get(
  '/users',
  validate([query('role').optional().isIn([...ROLES, 'all']), ...paginationQuery()]),
  controller.listUsers
);

router.patch(
  '/users/:id/active',
  validate([objectIdParam('id'), body('isActive').isBoolean().toBoolean()]),
  controller.setUserActive
);

router.get('/activity', validate(paginationQuery()), controller.listActivity);

module.exports = router;
