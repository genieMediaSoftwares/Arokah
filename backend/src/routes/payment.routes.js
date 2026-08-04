'use strict';

const express = require('express');
const controller = require('../controllers/payment.controller');
const validate = require('../middleware/validate');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimit');
const {
  orderInputRules,
  createOrderRules,
  verifyPaymentRules,
  abandonRules,
  listBookingsRules,
  referenceParamRules,
  refundRules,
} = require('../validators/payment.validator');

const router = express.Router();

router.get('/config', controller.getConfig);

// Booking is open to guests — the existing UI never asked visitors to sign in,
// and `optionalAuth` links the booking to an account when one is present.
router.post('/quote', paymentLimiter, optionalAuth, validate(orderInputRules), controller.quote);
router.post('/orders', paymentLimiter, optionalAuth, validate(createOrderRules), controller.createOrder);
router.post('/verify', paymentLimiter, optionalAuth, validate(verifyPaymentRules), controller.verifyPayment);
router.post('/abandon', optionalAuth, validate(abandonRules), controller.abandonOrder);

// Reference codes are unguessable, so this doubles as the customer's receipt link.
router.get('/bookings/reference/:reference', validate(referenceParamRules), controller.getBookingByReference);

// Admin views and refunds.
router.get('/bookings', protect, authorize('admin', 'staff'), validate(listBookingsRules), controller.listBookings);
router.post('/:id/refund', protect, authorize('admin'), validate(refundRules), controller.refund);

module.exports = router;
