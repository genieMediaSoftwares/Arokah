'use strict';

const { query, queryOne } = require('../config/database');
const h = require('../db/helpers');

function toApi(row) {
  if (!row) return null;
  const result = {
    id: row.id,
    actor: row.actor_id
      ? {
          _id: row.actor_id,
          id: row.actor_id,
          name: row.actor_name || '',
          email: row.actor_email || '',
          role: row.actor_role || '',
        }
      : null,
    actorEmail: row.actor_email || '',
    action: row.action,
    entityType: row.entity_type || '',
    entityId: row.entity_id || '',
    metadata: h.parseJson(row.metadata, {}),
    ipAddress: row.ip_address || '',
    createdAt: h.toIso(row.created_at),
  };
  return result;
}

const activityLogRepository = {
  toApi,

  async create({ actor, actorEmail, action, entityType, entityId, metadata, ipAddress }) {
    const id = h.generateId();
    await query(
      `INSERT INTO activity_logs (id, actor_id, actor_email, action, entity_type, entity_id, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        actor || null,
        actorEmail || '',
        action,
        entityType || '',
        entityId ? String(entityId) : '',
        h.toJson(metadata || {}),
        ipAddress || '',
      ]
    );
    return id;
  },

  async list({ skip = 0, limit = 50, filter = {} } = {}) {
    const where = [];
    const params = [];

    if (filter.action) {
      where.push('a.action = ?');
      params.push(filter.action);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(
      `SELECT a.*, u.name AS actor_name, u.role AS actor_role
       FROM activity_logs a
       LEFT JOIN users u ON a.actor_id = u.id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit) || 50, Number(skip) || 0]
    );

    return rows.map(toApi);
  },
};

module.exports = activityLogRepository;
