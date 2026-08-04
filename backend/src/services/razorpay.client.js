'use strict';

const crypto = require('crypto');
const Razorpay = require('razorpay');
const paymentConfig = require('../config/payment');
const ApiError = require('../utils/ApiError');

let client = null;

function isConfigured() {
  return paymentConfig.isConfigured;
}

function getClient() {
  if (!isConfigured()) {
    throw ApiError.internal('Payments are not configured on this server', { code: 'PAYMENTS_UNAVAILABLE' });
  }
  if (!client) {
    client = new Razorpay({
      key_id: paymentConfig.razorpay.keyId,
      key_secret: paymentConfig.razorpay.keySecret,
    });
  }
  return client;
}

/**
 * Verifies the Checkout handler signature: HMAC-SHA256(order_id|payment_id).
 * Compared with a timing-safe equality check so the secret cannot be recovered
 * by measuring response times.
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;

  const expected = crypto
    .createHmac('sha256', paymentConfig.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return timingSafeEqual(expected, signature);
}

/** Verifies the `x-razorpay-signature` header on a webhook delivery. */
function verifyWebhookSignature(rawBody, signature) {
  const secret = paymentConfig.razorpay.webhookSecret;
  if (!secret || !signature || !rawBody) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  // timingSafeEqual throws on length mismatch, so check that separately.
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { getClient, isConfigured, verifyPaymentSignature, verifyWebhookSignature };
