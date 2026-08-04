'use strict';

const { query, queryOne, transaction } = require('../config/database');
const h = require('../db/helpers');

function toApi(row, extras = [], paymentRow = null, eventRow = null) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    eventTitle: row.event_title,
    user: row.user_id || null,
    customer: {
      name: row.customer_name || '',
      email: row.customer_email || '',
      phone: row.customer_phone || '',
    },
    quantity: h.toNumber(row.quantity),
    basePrice: h.toNumber(row.base_price),
    extrasPrice: h.toNumber(row.extras_price),
    pricePerTicket: h.toNumber(row.price_per_ticket),
    totalAmount: h.toNumber(row.total_amount),
    currency: row.currency || 'INR',
    status: row.status,
    paymentMethod: row.payment_method || 'razorpay',
    confirmedAt: h.toIso(row.confirmed_at),
    cancelledAt: h.toIso(row.cancelled_at),
    notes: row.notes || null,
    legacyId: row.legacy_id || null,
    createdAt: h.toIso(row.created_at),
    updatedAt: h.toIso(row.updated_at),
    extras: extras.map((ex) => ({
      key: ex.extra_key,
      name: ex.name,
      category: ex.category,
      unitPrice: h.toNumber(ex.unit_price),
    })),
    event: eventRow
      ? {
          id: eventRow.id,
          title: eventRow.title,
          mainImage: eventRow.main_image,
          eventDate: h.toDateString(eventRow.event_date),
          status: eventRow.status,
          location: eventRow.location || '',
          startTime12h: eventRow.start_time_12h || '',
          endTime12h: eventRow.end_time_12h || '',
        }
      : undefined,
    payment: paymentRow
      ? {
          id: paymentRow.id,
          razorpayPaymentId: paymentRow.razorpay_payment_id || null,
          razorpayOrderId: paymentRow.razorpay_order_id,
          status: paymentRow.status,
          method: paymentRow.method || '',
          amount: h.toNumber(paymentRow.amount),
          receiptNumber: paymentRow.receipt_number || null,
          paidAt: h.toIso(paymentRow.paid_at),
        }
      : undefined,
    toJSON: function () {
      const { toJSON, _id, ...rest } = this;
      return { id: String(_id), ...rest };
    },
  };
}

const bookingRepository = {
  toApi,

  async create(payload) {
    const id = payload.id || h.generateId();
    await transaction(async (tx) => {
      await tx.query(
        `INSERT INTO bookings (id, reference, event_id, event_title, user_id, customer_name, customer_email, customer_phone, quantity, base_price, extras_price, price_per_ticket, total_amount, currency, status, payment_method, notes, legacy_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          payload.reference,
          payload.event,
          payload.eventTitle || '',
          payload.user || null,
          payload.customer?.name || '',
          payload.customer?.email || '',
          payload.customer?.phone || '',
          h.toNumber(payload.quantity),
          h.toNumber(payload.basePrice),
          h.toNumber(payload.extrasPrice),
          h.toNumber(payload.pricePerTicket),
          h.toNumber(payload.totalAmount),
          payload.currency || 'INR',
          payload.status || 'pending',
          payload.paymentMethod || 'razorpay',
          payload.notes || null,
          payload.legacyId || null,
        ]
      );

      if (Array.isArray(payload.extras) && payload.extras.length > 0) {
        for (let i = 0; i < payload.extras.length; i += 1) {
          const ex = payload.extras[i];
          await tx.query(
            `INSERT INTO booking_extras (booking_id, extra_key, name, category, unit_price, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, ex.key, ex.name || '', ex.category || 'other', h.toNumber(ex.unitPrice), i]
          );
        }
      }
    });

    return this.findById(id);
  },

  async findById(id) {
    if (!h.isValidId(id)) return null;
    const row = await queryOne('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!row) return null;

    const [extras, paymentRow, eventRow] = await Promise.all([
      query('SELECT * FROM booking_extras WHERE booking_id = ? ORDER BY sort_order ASC', [id]),
      queryOne('SELECT * FROM payments WHERE booking_id = ?', [id]),
      queryOne('SELECT * FROM events WHERE id = ?', [row.event_id]),
    ]);

    return toApi(row, extras, paymentRow, eventRow);
  },

  async findByReference(reference) {
    const row = await queryOne('SELECT * FROM bookings WHERE reference = ?', [reference]);
    if (!row) return null;

    const [extras, paymentRow, eventRow] = await Promise.all([
      query('SELECT * FROM booking_extras WHERE booking_id = ? ORDER BY sort_order ASC', [row.id]),
      queryOne('SELECT * FROM payments WHERE booking_id = ?', [row.id]),
      queryOne('SELECT * FROM events WHERE id = ?', [row.event_id]),
    ]);

    return toApi(row, extras, paymentRow, eventRow);
  },

  async update(id, updates) {
    const { clause, params, isEmpty } = h.buildUpdate(updates);
    if (isEmpty) return this.findById(id);
    await query(`UPDATE bookings SET ${clause} WHERE id = ?`, [...params, id]);
    return this.findById(id);
  },

  async deleteById(id) {
    if (!h.isValidId(id)) return;
    await query('DELETE FROM bookings WHERE id = ?', [id]);
  },

  async findAll({ filter = {}, search, sort = 'created_at DESC', skip = 0, limit = 20 } = {}) {
    const where = [];
    const params = [];

    if (filter.status && filter.status !== 'all') {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.user) {
      where.push('user_id = ?');
      params.push(filter.user);
    }

    if (search) {
      const like = `%${h.escapeLike(search)}%`;
      where.push('(reference LIKE ? OR event_title LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ?)');
      params.push(like, like, like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `SELECT * FROM bookings ${whereSql} ORDER BY ${sort} LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(skip));

    const rows = await query(sql, params);
    if (!rows.length) return [];

    const bookingIds = rows.map((r) => r.id);
    const eventIds = [...new Set(rows.map((r) => r.event_id))];

    const [extrasRows, paymentsRows, eventsRows] = await Promise.all([
      query(`SELECT * FROM booking_extras WHERE booking_id IN (${h.placeholders(bookingIds)}) ORDER BY sort_order ASC`, bookingIds),
      query(`SELECT * FROM payments WHERE booking_id IN (${h.placeholders(bookingIds)})`, bookingIds),
      query(`SELECT * FROM events WHERE id IN (${h.placeholders(eventIds)})`, eventIds),
    ]);

    const extrasMap = new Map();
    extrasRows.forEach((ex) => {
      if (!extrasMap.has(ex.booking_id)) extrasMap.set(ex.booking_id, []);
      extrasMap.get(ex.booking_id).push(ex);
    });

    const paymentsMap = new Map();
    paymentsRows.forEach((p) => paymentsMap.set(p.booking_id, p));

    const eventsMap = new Map();
    eventsRows.forEach((e) => eventsMap.set(e.id, e));

    return rows.map((row) => toApi(row, extrasMap.get(row.id) || [], paymentsMap.get(row.id) || null, eventsMap.get(row.event_id) || null));
  },

  async count(filter = {}) {
    const where = [];
    const params = [];
    if (filter.status && filter.status !== 'all') {
      where.push('status = ?');
      params.push(filter.status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const row = await queryOne(`SELECT COUNT(*) AS total FROM bookings ${whereSql}`, params);
    return h.toNumber(row?.total);
  },

  async revenueSummary() {
    const row = await queryOne(
      `SELECT SUM(total_amount) AS totalRevenue, SUM(quantity) AS totalTickets, COUNT(*) AS bookings
       FROM bookings WHERE status = 'confirmed'`
    );
    return {
      totalRevenue: h.toNumber(row?.totalRevenue),
      totalTickets: h.toNumber(row?.totalTickets),
      bookings: h.toNumber(row?.bookings),
    };
  },
};

module.exports = bookingRepository;
