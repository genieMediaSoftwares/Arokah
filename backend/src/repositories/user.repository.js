'use strict';

const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/database');
const { bcrypt: bcryptConfig } = require('../config/jwt');
const h = require('../db/helpers');

/**
 * Users table access.
 *
 * Replaces models/User.js. Two behaviours the Mongoose schema provided
 * implicitly are now explicit here, because SQL has no equivalent hooks:
 *
 *   * password hashing, previously a pre('save') hook
 *   * `select: false` on the password column — every read helper omits it
 *     unless it is the one that exists to check a password
 */

const SAFE_COLUMNS = `
  id, name, email, phone, role, is_active, last_login_at,
  created_at, updated_at
`;

/** Row → the JSON shape the API has always returned. */
function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    role: row.role,
    isActive: h.toBool(row.is_active),
    lastLoginAt: h.toIso(row.last_login_at),
    createdAt: h.toIso(row.created_at),
    updatedAt: h.toIso(row.updated_at),
  };
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, bcryptConfig.saltRounds);
}

const userRepository = {
  toApi,
  hashPassword,

  findById(id) {
    if (!h.isValidId(id)) return Promise.resolve(null);
    return queryOne(`SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`, [id]);
  },

  findByEmail(email) {
    return queryOne(`SELECT ${SAFE_COLUMNS} FROM users WHERE email = ?`, [String(email).toLowerCase()]);
  },

  /**
   * Includes the password hash and `tokens_valid_from`. Used only by the login
   * and change-password flows — never by anything that returns a user.
   */
  findByEmailWithSecrets(email) {
    return queryOne(
      `SELECT ${SAFE_COLUMNS}, password, tokens_valid_from FROM users WHERE email = ?`,
      [String(email).toLowerCase()]
    );
  },

  findByIdWithSecrets(id) {
    if (!h.isValidId(id)) return Promise.resolve(null);
    return queryOne(
      `SELECT ${SAFE_COLUMNS}, password, tokens_valid_from FROM users WHERE id = ?`,
      [id]
    );
  },

  comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  },

  async create({ name, email, phone = null, password, role = 'customer', isActive = true, id }) {
    const userId = id || h.generateId();
    await query(
      `INSERT INTO users (id, name, email, phone, password, role, is_active, tokens_valid_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [userId, name, String(email).toLowerCase(), phone || null, await hashPassword(password), role, h.fromBool(isActive)]
    );
    return this.findById(userId);
  },

  async update(id, { name, phone, role, isActive }) {
    const { clause, params, isEmpty } = h.buildUpdate({
      name,
      phone: phone === undefined ? undefined : phone || null,
      role,
      is_active: isActive === undefined ? undefined : h.fromBool(isActive),
    });
    if (isEmpty) return this.findById(id);

    await query(`UPDATE users SET ${clause} WHERE id = ?`, [...params, id]);
    return this.findById(id);
  },

  /**
   * Changing a password also moves `tokens_valid_from` forward, which is what
   * invalidates every refresh token issued before this moment.
   */
  async updatePassword(id, plainPassword) {
    await query('UPDATE users SET password = ?, tokens_valid_from = NOW(3) WHERE id = ?', [
      await hashPassword(plainPassword),
      id,
    ]);
  },

  touchLastLogin(id) {
    return query('UPDATE users SET last_login_at = NOW(3) WHERE id = ?', [id]);
  },

  async list({ role, page = 1, limit = 20 } = {}) {
    const { limit: take, offset, page: current } = h.paginate({ page, limit });

    const where = [];
    const params = [];
    if (role && role !== 'all') {
      where.push('role = ?');
      params.push(role);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(
      `SELECT ${SAFE_COLUMNS} FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, take, offset]
    );
    const countRow = await queryOne(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);

    return { users: rows.map(toApi), total: h.toNumber(countRow?.total), page: current, limit: take };
  },

  async count(filter = {}) {
    const where = [];
    const params = [];
    if (filter.role) {
      where.push('role = ?');
      params.push(filter.role);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const row = await queryOne(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
    return h.toNumber(row?.total);
  },

  async existsByEmail(email) {
    const row = await queryOne('SELECT 1 AS found FROM users WHERE email = ? LIMIT 1', [
      String(email).toLowerCase(),
    ]);
    return Boolean(row);
  },

  deleteById(id) {
    return query('DELETE FROM users WHERE id = ?', [id]);
  },
};

module.exports = userRepository;
