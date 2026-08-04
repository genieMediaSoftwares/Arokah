'use strict';

const { body, param, query } = require('express-validator');
const { BOOKING_STATUSES } = require('../models/Booking');
const { paginationQuery } = require('./common.validator');

// Note what is NOT accepted here: no amount, no price, no total. Those are all
// computed server-side in payment.service.priceOrder().
const orderInputRules = [
  body('eventId').trim().notEmpty().withMessage('eventId is required').isLength({ max: 64 }),
  body('quantity').toInt().isInt({ min: 1, max: 50 }).withMessage('Quantity must be between 1 and 50'),
  body('extraKeys').optional().isArray({ max: 100 }).withMessage('extraKeys must be an array'),
  body('extraKeys.*').trim().isLength({ min: 1, max: 64 }).withMessage('Invalid add-on key'),
];

const createOrderRules = [
  ...orderInputRules,
  body('customer').optional().isObject(),
  body('customer.name').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('customer.email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('customer.phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
];

const verifyPaymentRules = [
  body('razorpay_order_id').trim().notEmpty().withMessage('razorpay_order_id is required').isLength({ max: 64 }),
  body('razorpay_payment_id').trim().notEmpty().withMessage('razorpay_payment_id is required').isLength({ max: 64 }),
  body('razorpay_signature').trim().notEmpty().withMessage('razorpay_signature is required').isLength({ max: 256 }),
];

const abandonRules = [
  body('razorpay_order_id').trim().notEmpty().withMessage('razorpay_order_id is required').isLength({ max: 64 }),
];

const listBookingsRules = [
  query('status').optional().isIn([...BOOKING_STATUSES, 'all']).withMessage('Invalid status filter'),
  query('search').optional().trim().isLength({ max: 120 }),
  ...paginationQuery(),
];

const referenceParamRules = [
  param('reference').trim().matches(/^ARK-[A-Z0-9]{4,16}$/).withMessage('Invalid booking reference'),
];

const refundRules = [
  param('id').trim().isMongoId().withMessage('Invalid payment id'),
  body('amount').optional().toFloat().isFloat({ min: 1 }).withMessage('Refund amount must be a positive number'),
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
];

module.exports = {
  orderInputRules,
  createOrderRules,
  verifyPaymentRules,
  abandonRules,
  listBookingsRules,
  referenceParamRules,
  refundRules,
};
