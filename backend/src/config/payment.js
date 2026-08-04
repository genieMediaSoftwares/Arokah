'use strict';

const env = require('./env');

/**
 * Razorpay and booking settings.
 *
 * `keyId` is public — it is sent to the browser so Checkout can open. `keySecret`
 * and `webhookSecret` never leave the server; they exist only to sign and verify.
 */
module.exports = {
  isConfigured: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),

  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  },

  currency: env.CURRENCY,

  booking: {
    referencePrefix: env.BOOKING_REFERENCE_PREFIX,
    receiptPrefix: env.RECEIPT_PREFIX,
    maxTicketsPerBooking: env.MAX_TICKETS_PER_BOOKING,
  },
};
