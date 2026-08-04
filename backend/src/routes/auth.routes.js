'use strict';

const express = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimit');
const { verifyOrigin } = require('../middleware/csrf');
const {
  registerRules,
  loginRules,
  changePasswordRules,
  updateProfileRules,
} = require('../validators/auth.validator');

const router = express.Router();

router.post('/register', authLimiter, validate(registerRules), controller.register);
router.post('/login', authLimiter, validate(loginRules), controller.login);

// Cookie-backed routes: origin-checked because a cookie travels automatically.
// Refresh uses its own limiter so it can never starve /login of budget.
router.post('/refresh', refreshLimiter, verifyOrigin, controller.refresh);
router.post('/logout', verifyOrigin, controller.logout);

router.get('/me', protect, controller.me);
router.patch('/me', protect, validate(updateProfileRules), controller.updateProfile);
router.post('/logout-all', protect, verifyOrigin, controller.logoutAll);
router.post('/change-password', protect, authLimiter, validate(changePasswordRules), controller.changePassword);

module.exports = router;
