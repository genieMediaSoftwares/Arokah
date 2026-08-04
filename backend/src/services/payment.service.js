'use strict';

const crypto = require('crypto');
const paymentConfig = require('../config/payment');
const logger = require('../config/logger');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const bookingRepository = require('../repositories/booking.repository');
const eventRepository = require('../repositories/event.repository');
const emailService = require('./email.service');
const razorpay = require('./razorpay.client');
const ApiError = require('../utils/ApiError');

const { referencePrefix, receiptPrefix, maxTicketsPerBooking } = paymentConfig.booking;

const BOOKABLE_STATUSES = ['upcoming', 'live'];

function generateReference() {
  // Crockford-ish alphabet: no I/O/0/1, so references are safe to read aloud.
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(6);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `${referencePrefix}-${code}`;
}

function generateReceiptNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `${receiptPrefix}-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Recomputes the order total from the stored event — never from the request.
 *
 * This is the single most important rule in this file: the client sends only
 * *which* event, *how many* tickets, and *which* extras. Every rupee is derived
 * here from database values, so a tampered request cannot change the price.
 */
async function priceOrder({ eventId, quantity, extraKeys = [] }) {
  const event = await eventRepository.findByIdOrLegacyId(eventId);
  if (!event) throw ApiError.notFound('Event not found');
  if (!BOOKABLE_STATUSES.includes(event.status)) {
    throw ApiError.badRequest('This event is not open for booking');
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > maxTicketsPerBooking) {
    throw ApiError.badRequest(`Quantity must be between 1 and ${maxTicketsPerBooking}`);
  }

  const basePrice = Event.parsePrice(event.price);

  const requested = new Set(extraKeys.map(String));
  const selected = event.extras.filter((extra) => requested.has(String(extra.key)));

  // An extra key that does not belong to this event is a client bug or an
  // attack — either way, refuse rather than silently ignoring it.
  if (selected.length !== requested.size) {
    throw ApiError.badRequest('One or more selected add-ons are not available for this event');
  }

  const bookedExtras = selected.map((extra) => ({
    key: extra.key,
    name: extra.name,
    category: extra.category,
    unitPrice: Event.parsePrice(extra.price),
  }));

  const extrasPrice = bookedExtras.reduce((sum, extra) => sum + extra.unitPrice, 0);
  const pricePerTicket = basePrice + extrasPrice;
  const totalAmount = pricePerTicket * qty;

  return { event, quantity: qty, basePrice, bookedExtras, extrasPrice, pricePerTicket, totalAmount };
}

/** Quote endpoint: lets the UI show a server-authoritative total before paying. */
async function quote(input) {
  const priced = await priceOrder(input);
  return {
    eventId: String(priced.event._id),
    quantity: priced.quantity,
    basePrice: priced.basePrice,
    extrasPrice: priced.extrasPrice,
    pricePerTicket: priced.pricePerTicket,
    totalAmount: priced.totalAmount,
    currency: paymentConfig.currency,
  };
}

/**
 * Creates a pending booking plus a Razorpay order. Free bookings (total 0) skip
 * Razorpay entirely and are confirmed on the spot.
 */
async function createOrder(input, { user = null } = {}) {
  const priced = await priceOrder(input);
  const { event, quantity, basePrice, bookedExtras, extrasPrice, pricePerTicket, totalAmount } = priced;

  const booking = await bookingRepository.create({
    reference: generateReference(),
    event: event._id,
    eventTitle: event.title,
    user: user?._id || null,
    customer: {
      name: input.customer?.name || user?.name || '',
      email: input.customer?.email || user?.email || '',
      phone: input.customer?.phone || user?.phone || '',
    },
    quantity,
    basePrice,
    extras: bookedExtras,
    extrasPrice,
    pricePerTicket,
    totalAmount,
    currency: paymentConfig.currency,
    status: 'pending',
    paymentMethod: totalAmount > 0 ? 'razorpay' : 'free',
  });

  if (totalAmount <= 0) {
    booking.status = 'confirmed';
    booking.confirmedAt = new Date();
    await booking.save();
    emailService.sendBookingReceipt(booking, null).catch(() => {});

    return {
      free: true,
      booking: booking.toJSON(),
      bookingReference: booking.reference,
    };
  }

  if (!razorpay.isConfigured()) {
    await booking.deleteOne();
    throw ApiError.internal('Payments are not configured on this server', { code: 'PAYMENTS_UNAVAILABLE' });
  }

  let order;
  try {
    order = await razorpay.getClient().orders.create({
      // Razorpay works in the smallest currency unit (paise).
      amount: Math.round(totalAmount * 100),
      currency: paymentConfig.currency,
      receipt: booking.reference,
      notes: {
        bookingReference: booking.reference,
        eventId: String(event._id),
        eventTitle: event.title.slice(0, 100),
      },
    });
  } catch (err) {
    await booking.deleteOne();
    logger.error('Razorpay order creation failed', { error: err.message, bookingRef: booking.reference });
    throw ApiError.internal('Could not start the payment. Please try again.', { code: 'PAYMENT_INIT_FAILED' });
  }

  const payment = await Payment.create({
    booking: booking._id,
    event: event._id,
    user: user?._id || null,
    razorpayOrderId: order.id,
    amount: totalAmount,
    currency: paymentConfig.currency,
    status: 'created',
    receiptNumber: generateReceiptNumber(),
  });

  booking.payment = payment._id;
  await booking.save();

  // Only the PUBLIC key id is ever sent to the browser; the secret stays here.
  return {
    free: false,
    keyId: paymentConfig.razorpay.keyId,
    orderId: order.id,
    amount: order.amount, // paise, for Razorpay Checkout
    displayAmount: totalAmount, // rupees, for the UI
    currency: order.currency,
    bookingId: String(booking._id),
    bookingReference: booking.reference,
    eventTitle: event.title,
    eventImage: event.mainImage,
    prefill: {
      name: booking.customer.name,
      email: booking.customer.email,
      contact: booking.customer.phone,
    },
  };
}

/**
 * Verifies a completed Checkout and confirms the booking.
 *
 * Two independent checks run here: the HMAC signature proves the callback came
 * from Razorpay, and a server-side fetch of the payment confirms it was actually
 * captured for the right amount. Signature alone is not enough — it says nothing
 * about whether the money moved.
 */
async function verifyAndConfirm({ orderId, paymentId, signature }) {
  if (!razorpay.verifyPaymentSignature({ orderId, paymentId, signature })) {
    await markOrderFailed(orderId, 'Signature verification failed');
    throw ApiError.badRequest('Payment verification failed', { code: 'SIGNATURE_INVALID' });
  }

  const payment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!payment) throw ApiError.notFound('Payment record not found');

  const booking = await Booking.findById(payment.booking);
  if (!booking) throw ApiError.notFound('Booking not found');

  // Replaying an already-verified callback is harmless — return the same result.
  if (payment.status === 'paid' && booking.status === 'confirmed') {
    return { booking: booking.toJSON(), payment: payment.toJSON(), alreadyConfirmed: true };
  }

  let remotePayment;
  try {
    remotePayment = await razorpay.getClient().payments.fetch(paymentId);
  } catch (err) {
    logger.error('Could not fetch payment from Razorpay', { paymentId, error: err.message });
    throw ApiError.internal('Could not confirm the payment. Please contact support.', {
      code: 'PAYMENT_FETCH_FAILED',
    });
  }

  const expectedPaise = Math.round(payment.amount * 100);
  if (remotePayment.order_id !== orderId) {
    throw ApiError.badRequest('Payment does not belong to this order', { code: 'ORDER_MISMATCH' });
  }
  if (Number(remotePayment.amount) !== expectedPaise) {
    logger.error('Payment amount mismatch', { paymentId, expected: expectedPaise, got: remotePayment.amount });
    throw ApiError.badRequest('Payment amount does not match the order', { code: 'AMOUNT_MISMATCH' });
  }
  if (!['captured', 'authorized'].includes(remotePayment.status)) {
    await markOrderFailed(orderId, `Payment status is '${remotePayment.status}'`);
    throw ApiError.badRequest('Payment was not completed', { code: 'PAYMENT_NOT_CAPTURED' });
  }

  payment.razorpayPaymentId = paymentId;
  payment.razorpaySignature = signature;
  payment.status = remotePayment.status === 'captured' ? 'paid' : 'authorized';
  payment.method = remotePayment.method || '';
  payment.providerResponse = remotePayment;
  payment.paidAt = new Date();
  await payment.save();

  // Razorpay Checkout collects contact details itself; adopt them when the
  // booking has none, so receipts and the admin list are never blank.
  if (!booking.customer.email && remotePayment.email) booking.customer.email = remotePayment.email;
  if (!booking.customer.phone && remotePayment.contact) booking.customer.phone = String(remotePayment.contact);

  booking.status = 'confirmed';
  booking.confirmedAt = new Date();
  await booking.save();

  emailService.sendBookingReceipt(booking, payment).catch(() => {});

  return { booking: booking.toJSON(), payment: payment.toJSON(), alreadyConfirmed: false };
}

async function markOrderFailed(orderId, reason) {
  const payment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!payment || payment.status === 'paid') return;

  payment.status = 'failed';
  payment.failureReason = reason;
  await payment.save();

  await Booking.updateOne(
    { _id: payment.booking, status: { $ne: 'confirmed' } },
    { $set: { status: 'failed' } }
  );
}

/** Records a client-reported abandonment. Never trusted for money decisions. */
async function markAbandoned(orderId) {
  await markOrderFailed(orderId, 'Checkout dismissed by the customer');
  return { success: true };
}

/**
 * Webhook handler. Razorpay retries these independently of the browser, so this
 * is what confirms a booking when the customer closes the tab mid-redirect.
 */
async function handleWebhookEvent(event) {
  const type = event?.event;
  const entity = event?.payload?.payment?.entity;
  if (!type || !entity) return { handled: false };

  const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
  if (!payment) {
    logger.warn('Webhook for an unknown order', { orderId: entity.order_id, type });
    return { handled: false };
  }

  if (type === 'payment.captured') {
    if (payment.status !== 'paid') {
      payment.razorpayPaymentId = entity.id;
      payment.status = 'paid';
      payment.method = entity.method || '';
      payment.providerResponse = entity;
      payment.paidAt = new Date();
      await payment.save();

      const booking = await Booking.findById(payment.booking);
      if (booking && booking.status !== 'confirmed') {
        if (!booking.customer.email && entity.email) booking.customer.email = entity.email;
        if (!booking.customer.phone && entity.contact) booking.customer.phone = String(entity.contact);
        booking.status = 'confirmed';
        booking.confirmedAt = new Date();
        await booking.save();
        emailService.sendBookingReceipt(booking, payment).catch(() => {});
      }
    }
    return { handled: true };
  }

  if (type === 'payment.failed') {
    await markOrderFailed(entity.order_id, entity.error_description || 'Payment failed at the gateway');
    return { handled: true };
  }

  return { handled: false };
}

/** Admin-initiated refund. Amount is in rupees; omit it for a full refund. */
async function refundPayment(paymentDocId, { amount, reason = '' } = {}, actorId = null) {
  const payment = await Payment.findById(paymentDocId);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status !== 'paid') throw ApiError.badRequest('Only a captured payment can be refunded');

  const refundable = payment.amount - payment.amountRefunded;
  const refundAmount = amount === undefined || amount === null ? refundable : Number(amount);

  if (!(refundAmount > 0) || refundAmount > refundable) {
    throw ApiError.badRequest(`Refund amount must be between 0 and ${refundable}`);
  }

  let remoteRefund;
  try {
    remoteRefund = await razorpay.getClient().payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(refundAmount * 100),
      notes: { reason: String(reason).slice(0, 200) },
    });
  } catch (err) {
    logger.error('Razorpay refund failed', { paymentId: payment.razorpayPaymentId, error: err.message });
    throw ApiError.internal('Refund could not be processed', { code: 'REFUND_FAILED' });
  }

  payment.refunds.push({
    razorpayRefundId: remoteRefund.id,
    amount: refundAmount,
    reason,
    createdBy: actorId,
  });
  payment.amountRefunded += refundAmount;
  payment.status = payment.amountRefunded >= payment.amount ? 'refunded' : 'partially_refunded';
  await payment.save();

  if (payment.status === 'refunded') {
    await Booking.updateOne(
      { _id: payment.booking },
      { $set: { status: 'refunded', cancelledAt: new Date() } }
    );
  }

  return payment.toJSON();
}

async function listBookings({ status, search, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;

  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [
      { reference: rx },
      { eventTitle: rx },
      { 'customer.name': rx },
      { 'customer.email': rx },
      { 'customer.phone': rx },
    ];
  }

  const skip = (page - 1) * limit;
  const [bookings, total] = await Promise.all([
    bookingRepository.findAll({ filter, skip, limit }),
    bookingRepository.count(filter),
  ]);

  return {
    bookings: bookings.map(({ _id, ...rest }) => ({ id: String(_id), ...rest })),
    total,
    page,
    limit,
  };
}

async function getBookingByReference(reference) {
  const booking = await Booking.findOne({ reference })
    .populate('event', 'title mainImage eventDate location startTime12h endTime12h')
    .populate('payment', 'razorpayPaymentId status method receiptNumber paidAt amount');

  if (!booking) throw ApiError.notFound('Booking not found');
  return booking.toJSON();
}

module.exports = {
  quote,
  createOrder,
  verifyAndConfirm,
  markAbandoned,
  handleWebhookEvent,
  refundPayment,
  listBookings,
  getBookingByReference,
  priceOrder,
};
