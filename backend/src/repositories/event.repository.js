'use strict';

const { query, queryOne, transaction } = require('../config/database');
const h = require('../db/helpers');

function parsePriceAmount(raw) {
  if (!raw) return 0;
  if (typeof raw === 'number') return Math.max(0, Math.round(raw));
  const digits = String(raw).replace(/[^\d.]/g, '');
  if (!digits) return 0;
  const parsed = Number.parseFloat(digits);
  return Number.isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed));
}

function toApi(row, extras = []) {
  if (!row) return null;
  const result = {
    _id: row.id,
    id: row.id,
    title: row.title,
    type: row.type || '',
    price: row.price || '',
    priceAmount: h.toNumber(row.price_amount),
    phone: row.phone || '',
    location: row.location || '',
    eventDate: h.toDateString(row.event_date),
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    startTime12h: row.start_time_12h || '',
    endTime12h: row.end_time_12h || '',
    description: row.description || '',
    mainImage: row.main_image,
    status: row.status,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    legacyId: row.legacy_id || null,
    createdAt: h.toIso(row.created_at),
    updatedAt: h.toIso(row.updated_at),
    extras: extras.map((ex) => ({
      key: ex.extra_key,
      category: ex.category,
      name: ex.name,
      description: ex.description,
      price: ex.price,
      imageURL: ex.image_url,
    })),
    toObject: function () {
      return { ...this };
    },
    toJSON: function () {
      const { toObject, toJSON, save, deleteOne, _id, ...rest } = this;
      return { id: String(_id), ...rest };
    },
    save: async function () {
      await eventRepository.update(this.id, {
        title: this.title,
        type: this.type,
        price: this.price,
        phone: this.phone,
        location: this.location,
        eventDate: this.eventDate,
        startTime: this.startTime,
        endTime: this.endTime,
        startTime12h: this.startTime12h,
        endTime12h: this.endTime12h,
        description: this.description,
        mainImage: this.mainImage,
        status: this.status,
        extras: this.extras,
        updatedBy: this.updatedBy,
      });
      return this;
    },
    deleteOne: async function () {
      await eventRepository.deleteById(this.id);
    },
  };
  return result;
}

const eventRepository = {
  toApi,

  async findById(id) {
    if (!h.isValidId(id)) return null;
    const row = await queryOne('SELECT * FROM events WHERE id = ?', [id]);
    if (!row) return null;
    const extras = await query('SELECT * FROM event_extras WHERE event_id = ? ORDER BY sort_order ASC', [id]);
    return toApi(row, extras);
  },

  async findByIdOrLegacyId(id) {
    if (h.isValidId(id)) {
      const res = await this.findById(id);
      if (res) return res;
    }
    const row = await queryOne('SELECT * FROM events WHERE legacy_id = ?', [id]);
    if (!row) return null;
    const extras = await query('SELECT * FROM event_extras WHERE event_id = ? ORDER BY sort_order ASC', [row.id]);
    return toApi(row, extras);
  },

  async findAll({ filter = {}, search, sort = 'created_at DESC', skip = 0, limit = 0 } = {}) {
    const where = [];
    const params = [];

    if (filter.status) {
      if (typeof filter.status === 'object' && Array.isArray(filter.status.$in)) {
        where.push(`status IN (${h.placeholders(filter.status.$in)})`);
        params.push(...filter.status.$in);
      } else if (typeof filter.status === 'string' && filter.status !== 'all') {
        where.push('status = ?');
        params.push(filter.status);
      }
    }

    if (search) {
      const like = `%${h.escapeLike(search)}%`;
      where.push('(title LIKE ? OR type LIKE ? OR location LIKE ?)');
      params.push(like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    let sql = `SELECT * FROM events ${whereSql} ORDER BY ${sort}`;
    if (limit > 0) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(skip));
    }

    const rows = await query(sql, params);
    if (!rows.length) return [];

    const eventIds = rows.map((r) => r.id);
    const extrasRows = await query(
      `SELECT * FROM event_extras WHERE event_id IN (${h.placeholders(eventIds)}) ORDER BY sort_order ASC`,
      eventIds
    );

    const extrasMap = new Map();
    extrasRows.forEach((ex) => {
      if (!extrasMap.has(ex.event_id)) extrasMap.set(ex.event_id, []);
      extrasMap.get(ex.event_id).push(ex);
    });

    return rows.map((row) => toApi(row, extrasMap.get(row.id) || []));
  },

  async findAllByStatusPriority({ filter = {}, skip = 0, limit = 50 } = {}) {
    return this.findAll({
      filter,
      sort: `CASE status WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END ASC, created_at DESC`,
      skip,
      limit,
    });
  },

  async count(filter = {}) {
    const where = [];
    const params = [];

    if (filter.status) {
      if (typeof filter.status === 'object' && Array.isArray(filter.status.$in)) {
        where.push(`status IN (${h.placeholders(filter.status.$in)})`);
        params.push(...filter.status.$in);
      } else if (typeof filter.status === 'string' && filter.status !== 'all') {
        where.push('status = ?');
        params.push(filter.status);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const row = await queryOne(`SELECT COUNT(*) AS total FROM events ${whereSql}`, params);
    return h.toNumber(row?.total);
  },

  async create(payload) {
    const id = payload.id || h.generateId();
    const priceAmount = parsePriceAmount(payload.price);

    await transaction(async (tx) => {
      await tx.query(
        `INSERT INTO events (id, title, type, price, price_amount, phone, location, event_date, start_time, end_time, start_time_12h, end_time_12h, description, main_image, status, created_by, updated_by, legacy_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          payload.title,
          payload.type || '',
          payload.price || '',
          priceAmount,
          payload.phone || '',
          payload.location || '',
          h.fromDateString(payload.eventDate),
          payload.startTime || '',
          payload.endTime || '',
          payload.startTime12h || '',
          payload.endTime12h || '',
          payload.description || '',
          payload.mainImage,
          payload.status || 'upcoming',
          payload.createdBy || null,
          payload.updatedBy || null,
          payload.legacyId || null,
        ]
      );

      if (Array.isArray(payload.extras) && payload.extras.length > 0) {
        for (let i = 0; i < payload.extras.length; i += 1) {
          const ex = payload.extras[i];
          await tx.query(
            `INSERT INTO event_extras (event_id, extra_key, category, name, description, price, image_url, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, ex.key, ex.category || 'other', ex.name || '', ex.description || '', ex.price || '', ex.imageURL || '', i]
          );
        }
      }
    });

    return this.findById(id);
  },

  async update(id, payload) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const priceAmount = payload.price !== undefined ? parsePriceAmount(payload.price) : undefined;

    await transaction(async (tx) => {
      const { clause, params, isEmpty } = h.buildUpdate({
        title: payload.title,
        type: payload.type,
        price: payload.price,
        price_amount: priceAmount,
        phone: payload.phone,
        location: payload.location,
        event_date: payload.eventDate !== undefined ? h.fromDateString(payload.eventDate) : undefined,
        start_time: payload.startTime,
        end_time: payload.endTime,
        start_time_12h: payload.startTime12h,
        end_time_12h: payload.endTime12h,
        description: payload.description,
        main_image: payload.mainImage,
        status: payload.status,
        updated_by: payload.updatedBy,
      });

      if (!isEmpty) {
        await tx.query(`UPDATE events SET ${clause} WHERE id = ?`, [...params, id]);
      }

      if (Array.isArray(payload.extras)) {
        await tx.query('DELETE FROM event_extras WHERE event_id = ?', [id]);
        for (let i = 0; i < payload.extras.length; i += 1) {
          const ex = payload.extras[i];
          await tx.query(
            `INSERT INTO event_extras (event_id, extra_key, category, name, description, price, image_url, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, ex.key, ex.category || 'other', ex.name || '', ex.description || '', ex.price || '', ex.imageURL || '', i]
          );
        }
      }
    });

    return this.findById(id);
  },

  async deleteById(id) {
    if (!h.isValidId(id)) return;
    await query('DELETE FROM events WHERE id = ?', [id]);
  },

  async statusCounts() {
    const rows = await query('SELECT status, COUNT(*) AS count FROM events GROUP BY status');
    const acc = { total: 0, live: 0, upcoming: 0, completed: 0, cancelled: 0 };
    rows.forEach((r) => {
      const cnt = h.toNumber(r.count);
      acc[r.status] = cnt;
      acc.total += cnt;
    });
    return acc;
  },
};

module.exports = eventRepository;
