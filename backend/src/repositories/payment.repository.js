'use strict';

const { query, queryOne } = require('../config/database');
const h = require('../db/helpers');

function toApi(row, refunds = []) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    booking: row.booking_id,
    event: row.event_id || null,
    user: row.user_id || null,
    provider: row.provider || 'razorpay',
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id || null,
    razorpaySignature: row.razorpay_signature || null,
    amount: h.toNumber(row.amount),
    amountRefunded: h.toNumber(row.amount_refunded),
    currency: row.currency || 'INR',
    status: row.status,
    method: row.method || '',
    receiptNumber: row.receipt_number || null,
    failureReason: row.failure_reason || '',
    providerResponse: h.parseJson(row.provider_response, null),
    paidAt: h.toIso(row.paid_at),
    refunds: refunds.map((r) => ({
      razorpayRefundId: r.razorpay_refund_id,
      amount: h.toNumber(r.amount),
      reason: r.reason || '',
      createdBy: r.created_by || null,
      createdAt: h.toIso(r.created_at),
    })),
    createdAt: h.toIso(row.created_at),
    updatedAt: h.toIso(row.updated_at),
    save: async function () {
      const updates = {
        razorpay_payment_id: this.razorpayPaymentId,
        razorpay_signature: this.razorpaySignature,
        status: this.status,
        method: this.method,
        failure_reason: this.failureReason,
        amount_refunded: this.amountRefunded,
        paid_at: this.paidAt ? new Date(this.paidAt) : null,
        provider_response: h.toJson(this.providerResponse),
      };
      const { clause, params, isEmpty } = h.buildUpdate(updates);
      if (!isEmpty) {
        await query(`UPDATE payments SET ${clause} WHERE id = ?`, [...params, this.id]);
      }
      return this;
    },
    toJSON: function () {
      const { save, toJSON, _id, ...rest } = this;
      return { id: String(_id), ...rest };
    },
  };
}

const paymentRepository = {
  toApi,

  async create({ booking, event, user, razorpayOrderId, amount, currency = 'INR', status = 'created', receiptNumber }) {
    const id = h.generateId();
    await query(
      `INSERT INTO payments (id, booking_id, event_id, user_id, razorpay_order_id, amount, currency, status, receipt_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, booking, event || null, user || null, razorpayOrderId, h.toNumber(amount), currency, status, receiptNumber || null]
    );
    return this.findById(id);
  },

  async findById(id) {
    if (!h.isValidId(id)) return null;
    const row = await queryOne('SELECT * FROM payments WHERE id = ?', [id]);
    if (!row) return null;
    const refunds = await query('SELECT * FROM payment_refunds WHERE payment_id = ? ORDER BY created_at ASC', [id]);
    return toApi(row, refunds);
  },

  async findByRazorpayOrderId(orderId) {
    const row = await queryOne('SELECT * FROM payments WHERE razorpay_order_id = ?', [orderId]);
    if (!row) return null;
    const refunds = await query('SELECT * FROM payment_refunds WHERE payment_id = ? ORDER BY created_at ASC', [row.id]);
    return toApi(row, refunds);
  },

  async findByBookingId(bookingId) {
    if (!h.isValidId(bookingId)) return null;
    const row = await queryOne('SELECT * FROM payments WHERE booking_id = ?', [bookingId]);
    if (!row) return null;
    const refunds = await query('SELECT * FROM payment_refunds WHERE payment_id = ? ORDER BY created_at ASC', [row.id]);
    return toApi(row, refunds);
  },

  async update(id, updates) {
    const { clause, params, isEmpty } = h.buildUpdate(updates);
    if (isEmpty) return this.findById(id);
    await query(`UPDATE payments SET ${clause} WHERE id = ?`, [...params, id]);
    return this.findById(id);
  },

  async addRefund(paymentId, { razorpayRefundId, amount, reason = '', createdBy = null }) {
    await query(
      `INSERT INTO payment_refunds (payment_id, razorpay_refund_id, amount, reason, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [paymentId, razorpayRefundId, h.toNumber(amount), reason || '', createdBy || null]
    );
  },
};

module.exports = paymentRepository;
