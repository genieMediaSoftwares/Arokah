'use strict';

const { query, queryOne } = require('../config/database');
const h = require('../db/helpers');

function toApi(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    eventName: row.event_name,
    members: row.members || '',
    message: row.message || '',
    status: row.status,
    adminNotified: h.toBool(row.admin_notified),
    customerNotified: h.toBool(row.customer_notified),
    createdAt: h.toIso(row.created_at),
    updatedAt: h.toIso(row.updated_at),
  };
}

const contactMessageRepository = {
  toApi,

  async create({ name, phone, email, eventName, members, message, ipAddress = '', userAgent = '' }) {
    const id = h.generateId();
    await query(
      `INSERT INTO contact_messages (id, name, phone, email, event_name, members, message, status, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
      [
        id,
        name,
        phone,
        email || '',
        eventName,
        members || '',
        message || '',
        ipAddress || '',
        String(userAgent || '').slice(0, 300),
      ]
    );
    return this.findById(id);
  },

  async findById(id) {
    if (!h.isValidId(id)) return null;
    const row = await queryOne('SELECT * FROM contact_messages WHERE id = ?', [id]);
    return toApi(row);
  },

  async updateNotifications(id, { adminNotified, customerNotified }) {
    const updates = [];
    const params = [];
    if (adminNotified !== undefined) {
      updates.push('admin_notified = ?');
      params.push(h.fromBool(adminNotified));
    }
    if (customerNotified !== undefined) {
      updates.push('customer_notified = ?');
      params.push(h.fromBool(customerNotified));
    }
    if (!updates.length) return this.findById(id);

    params.push(id);
    await query(`UPDATE contact_messages SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async updateStatus(id, status) {
    if (!h.isValidId(id)) return null;
    await query('UPDATE contact_messages SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id);
  },

  async list({ status, page = 1, limit = 20 } = {}) {
    const { limit: take, offset, page: current } = h.paginate({ page, limit });

    const where = [];
    const params = [];
    if (status && status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(
      `SELECT * FROM contact_messages ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, take, offset]
    );
    const countRow = await queryOne(`SELECT COUNT(*) AS total FROM contact_messages ${whereSql}`, params);

    return {
      messages: rows.map(toApi),
      total: h.toNumber(countRow?.total),
      page: current,
      limit: take,
    };
  },

  async count(filter = {}) {
    const where = [];
    const params = [];
    if (filter.status && filter.status !== 'all') {
      where.push('status = ?');
      params.push(filter.status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const row = await queryOne(`SELECT COUNT(*) AS total FROM contact_messages ${whereSql}`, params);
    return h.toNumber(row?.total);
  },
};

module.exports = contactMessageRepository;
