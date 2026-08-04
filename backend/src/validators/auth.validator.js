'use strict';

const { body } = require('express-validator');

const passwordRules = (field) =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .bail()
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain a number');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  passwordRules('password'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  // No complexity rules on login — an old password that predates the current
  // policy must still be able to sign in.
  body('password').isString().notEmpty().withMessage('Password is required'),
];

const changePasswordRules = [
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  passwordRules('newPassword'),
];

const updateProfileRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 120 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
];

module.exports = { registerRules, loginRules, changePasswordRules, updateProfileRules };
