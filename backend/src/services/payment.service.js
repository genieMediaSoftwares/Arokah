'use strict';

const crypto = require('crypto');
const paymentConfig = require('../config/payment');
const logger = require('../config/logger');
const bookingRepository = require('../repositories/booking.repository');
const eventRepository = require('../repositories/event.repository');
const paymentRepository = require('../repositories/payment.repository');
const emailService = require('./email.service');
const razorpay = require('./razorpay.client');
const ApiError = require('../utils/ApiError');

const { referencePrefix, receiptPrefix, maxTicketsPerBooking } = paymentConfig.booking;

const BOOKABLE_STATUSES = ['upcoming', 'live'];

function generateReference() {
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

function parsePrice(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Math.max(0, Math.round(raw));
  const digits = String(raw).replace(/[^\d.]/g, '');
  if (!digits) return 0;
  const parsed = Number.parseFloat(digits);
  return Number.isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed));
}

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

  const basePrice = parsePrice(event.price);

  const requested = new Set(extraKeys.map(String));
  const selected = (event.extras || []).filter((extra) => requested.has(String(extra.key)));

  if (selected.length !== requested.size) {
    throw ApiError.badRequest('One or more selected add-ons are not available for this event');
  }

  const bookedExtras = selected.map((extra) => ({
    key: extra.key,
    name: extra.name,
    category: extra.category,
    unitPrice: parsePrice(extra.price),
  }));

  const extrasPrice = bookedExtras.reduce((sum, extra) => sum + extra.unitPrice, 0);
  const pricePerTicket = basePrice + extrasPrice;
  const totalAmount = pricePerTicket * qty;

  return { event, quantity: qty, basePrice, bookedExtras, extrasPrice, pricePerTicket, totalAmount };
}

async function quote(input) {
  const priced = await priceOrder(input);
  return {
    eventId: String(priced.event._id || priced.event.id),
    quantity: priced.quantity,
    basePrice: priced.basePrice,
    extrasPrice: priced.extrasPrice,
    pricePerTicket: priced.pricePerTicket,
    totalAmount: priced.totalAmount,
    currency: paymentConfig.currency,
  };
}

async function createOrder(input, { user = null } = {}) {
  const priced = await priceOrder(input);
  const { event, quantity, basePrice, bookedExtras, extrasPrice, pricePerTicket, totalAmount } = priced;
  const eventId = event._id || event.id;

  const booking = await bookingRepository.create({
    reference: generateReference(),
    event: eventId,
    eventTitle: event.title,
    user: user?._id || user?.id || null,
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
    await bookingRepository.update(booking.id, { status: 'confirmed', confirmed_at: new Date() });
    const updatedBooking = await bookingRepository.findById(booking.id);
    emailService.sendBookingReceipt(updatedBooking, null).catch(() => {});

    return {
      free: true,
      booking: updatedBooking,
      bookingReference: updatedBooking.reference,
    };
  }

  if (!razorpay.isConfigured()) {
    await bookingRepository.deleteById(booking.id);
    throw ApiError.internal('Payments are not configured on this server', { code: 'PAYMENTS_UNAVAILABLE' });
  }

  let order;
  try {
    order = await razorpay.getClient().orders.create({
      amount: Math.round(totalAmount * 100),
      currency: paymentConfig.currency,
      receipt: booking.reference,
      notes: {
        bookingReference: booking.reference,
        eventId: String(eventId),
        eventTitle: event.title.slice(0, 100),
      },
    });
  } catch (err) {
    await bookingRepository.deleteById(booking.id);
    logger.error('Razorpay order creation failed', { error: err.message, bookingRef: booking.reference });
    throw ApiError.internal('Could not start the payment. Please try again.', { code: 'PAYMENT_INIT_FAILED' });
  }

  const payment = await paymentRepository.create({
    booking: booking.id,
    event: eventId,
    user: user?._id || user?.id || null,
    razorpayOrderId: order.id,
    amount: totalAmount,
    currency: paymentConfig.currency,
    status: 'created',
    receiptNumber: generateReceiptNumber(),
  });

  return {
    free: false,
    keyId: paymentConfig.razorpay.keyId,
    orderId: order.id,
    amount: order.amount,
    displayAmount: totalAmount,
    currency: order.currency,
    bookingId: String(booking.id),
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

async function verifyAndConfirm({ orderId, paymentId, signature }) {
  if (!razorpay.verifyPaymentSignature({ orderId, paymentId, signature })) {
    await markOrderFailed(orderId, 'Signature verification failed');
    throw ApiError.badRequest('Payment verification failed', { code: 'SIGNATURE_INVALID' });
  }

  const payment = await paymentRepository.findByRazorpayOrderId(orderId);
  if (!payment) throw ApiError.notFound('Payment record not found');

  const booking = await bookingRepository.findById(payment.booking);
  if (!booking) throw ApiError.notFound('Booking not found');

  if (payment.status === 'paid' && booking.status === 'confirmed') {
    return { booking, payment: payment.toJSON(), alreadyConfirmed: true };
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

  const customerUpdate = { ...booking.customer };
  if (!customerUpdate.email && remotePayment.email) customerUpdate.email = remotePayment.email;
  if (!customerUpdate.phone && remotePayment.contact) customerUpdate.phone = String(remotePayment.contact);

  await bookingRepository.update(booking.id, {
    status: 'confirmed',
    confirmed_at: new Date(),
    customer_email: customerUpdate.email,
    customer_phone: customerUpdate.phone,
  });
  const updatedBooking = await bookingRepository.findById(booking.id);

  emailService.sendBookingReceipt(updatedBooking, payment.toJSON()).catch(() => {});

  return { booking: updatedBooking, payment: payment.toJSON(), alreadyConfirmed: false };
}

async function markOrderFailed(orderId, reason) {
  const payment = await paymentRepository.findByRazorpayOrderId(orderId);
  if (!payment || payment.status === 'paid') return;

  payment.status = 'failed';
  payment.failureReason = reason;
  await payment.save();

  if (payment.booking) {
    await bookingRepository.update(payment.booking, { status: 'failed' });
  }
}

async function markAbandoned(orderId) {
  await markOrderFailed(orderId, 'Checkout dismissed by the customer');
  return { success: true };
}

async function handleWebhookEvent(event) {
  const type = event?.event;
  const entity = event?.payload?.payment?.entity;
  if (!type || !entity) return { handled: false };

  const payment = await paymentRepository.findByRazorpayOrderId(entity.order_id);
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

      const booking = await bookingRepository.findById(payment.booking);
      if (booking && booking.status !== 'confirmed') {
        const customerUpdate = { ...booking.customer };
        if (!customerUpdate.email && entity.email) customerUpdate.email = entity.email;
        if (!customerUpdate.phone && entity.contact) customerUpdate.phone = String(entity.contact);
        await bookingRepository.update(booking.id, {
          status: 'confirmed',
          confirmed_at: new Date(),
          customer_email: customerUpdate.email,
          customer_phone: customerUpdate.phone,
        });
        const updatedBooking = await bookingRepository.findById(booking.id);
        emailService.sendBookingReceipt(updatedBooking, payment.toJSON()).catch(() => {});
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

async function refundPayment(paymentDocId, { amount, reason = '' } = {}, actorId = null) {
  const payment = await paymentRepository.findById(paymentDocId);
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

  await paymentRepository.addRefund(payment.id, {
    razorpayRefundId: remoteRefund.id,
    amount: refundAmount,
    reason,
    createdBy: actorId,
  });

  payment.amountRefunded += refundAmount;
  payment.status = payment.amountRefunded >= payment.amount ? 'refunded' : 'partially_refunded';
  await payment.save();

  if (payment.status === 'refunded') {
    await bookingRepository.update(payment.booking, { status: 'refunded', cancelled_at: new Date() });
  }

  return paymentRepository.findById(payment.id);
}

async function listBookings({ status, search, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;

  const skip = (page - 1) * limit;
  const [bookings, total] = await Promise.all([
    bookingRepository.findAll({ filter, search, skip, limit }),
    bookingRepository.count(filter),
  ]);

  return {
    bookings: bookings.map(({ _id, ...rest }) => ({ id: String(_id || rest.id), ...rest })),
    total,
    page,
    limit,
  };
}

async function getBookingByReference(reference) {
  const booking = await bookingRepository.findByReference(reference);
  if (!booking) throw ApiError.notFound('Booking not found');
  const payment = await paymentRepository.findByBookingId(booking.id);
  const event = await eventRepository.findById(booking.eventId);
  return {
    ...booking,
    event: event ? { id: event.id, title: event.title, mainImage: event.mainImage, eventDate: event.eventDate, location: event.location, startTime12h: event.startTime12h, endTime12h: event.endTime12h } : null,
    payment: payment ? { razorpayPaymentId: payment.razorpayPaymentId, status: payment.status, method: payment.method, receiptNumber: payment.receiptNumber, paidAt: payment.paidAt, amount: payment.amount } : null,
  };
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
