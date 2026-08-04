'use strict';

const paymentService = require('../services/payment.service');
const activityLog = require('../services/activityLog.service');
const razorpay = require('../services/razorpay.client');
const logger = require('../config/logger');
const paymentConfig = require('../config/payment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendCreated, buildPaginationMeta } = require('../utils/apiResponse');

/** Public config the browser is allowed to know: the key id, never the secret. */
const getConfig = asyncHandler(async (_req, res) =>
  sendSuccess(res, {
    message: 'Payment configuration',
    data: {
      enabled: razorpay.isConfigured(),
      keyId: razorpay.isConfigured() ? paymentConfig.razorpay.keyId : null,
      currency: paymentConfig.currency,
    },
  })
);

const quote = asyncHandler(async (req, res) => {
  const result = await paymentService.quote(req.body);
  return sendSuccess(res, { message: 'Order quote', data: result });
});

const createOrder = asyncHandler(async (req, res) => {
  const result = await paymentService.createOrder(req.body, { user: req.user || null });
  return sendCreated(res, { message: 'Order created', data: result });
});

const verifyPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyAndConfirm({
    orderId: req.body.razorpay_order_id,
    paymentId: req.body.razorpay_payment_id,
    signature: req.body.razorpay_signature,
  });

  activityLog.record({
    req,
    action: 'payment.verified',
    entityType: 'Booking',
    entityId: result.booking.id,
    metadata: { reference: result.booking.reference, amount: result.booking.totalAmount },
  });

  return sendSuccess(res, {
    message: 'Payment verified and booking confirmed',
    data: {
      booking: result.booking,
      payment: result.payment,
      alreadyConfirmed: result.alreadyConfirmed,
    },
  });
});

const abandonOrder = asyncHandler(async (req, res) => {
  await paymentService.markAbandoned(req.body.razorpay_order_id);
  return sendSuccess(res, { message: 'Order marked as abandoned' });
});

/**
 * Razorpay webhook. Mounted with a raw body parser so the signature can be
 * verified against the exact bytes Razorpay signed — re-serialising parsed JSON
 * would change the payload and break the HMAC.
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  const rawBody = req.body; // Buffer, courtesy of express.raw()

  if (!razorpay.verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Rejected a webhook with an invalid signature');
    throw ApiError.unauthorized('Invalid webhook signature');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw ApiError.badRequest('Webhook payload is not valid JSON');
  }

  const result = await paymentService.handleWebhookEvent(event);
  logger.info('Processed Razorpay webhook', { type: event.event, handled: result.handled });

  // Always 200 — a non-2xx makes Razorpay retry an event we have already seen.
  return sendSuccess(res, { message: 'Webhook received', data: result });
});

const getBookingByReference = asyncHandler(async (req, res) => {
  const booking = await paymentService.getBookingByReference(req.params.reference);
  return sendSuccess(res, { message: 'Booking fetched', data: { booking } });
});

const listBookings = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.validated?.query || {};
  const result = await paymentService.listBookings({ status, search, page, limit });
  return sendSuccess(res, {
    message: 'Bookings fetched',
    data: { bookings: result.bookings },
    meta: buildPaginationMeta({ page: result.page, limit: result.limit, total: result.total }),
  });
});

const refund = asyncHandler(async (req, res) => {
  const payment = await paymentService.refundPayment(
    req.params.id,
    { amount: req.body.amount, reason: req.body.reason },
    req.user._id
  );
  activityLog.record({
    req,
    action: 'payment.refunded',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { amount: req.body.amount ?? 'full' },
  });
  return sendSuccess(res, { message: 'Refund processed', data: { payment } });
});

module.exports = {
  getConfig,
  quote,
  createOrder,
  verifyPayment,
  abandonOrder,
  handleWebhook,
  getBookingByReference,
  listBookings,
  refund,
};
