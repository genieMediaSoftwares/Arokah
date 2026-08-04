'use strict';

const { query, queryOne } = require('../config/database');
const h = require('../db/helpers');

/**
 * Refresh token storage.
 *
 * Replaces models/RefreshToken.js. Only the SHA-256 digest of a token is
 * stored, so a database leak cannot be replayed as a session.
 *
 * MongoDB removed expired rows automatically via a TTL index. The equivalent
 * SQL event exists in the schema, but Hostinger runs with `event_scheduler=OFF`
 * and shared hosting will not let it be enabled — so `purgeExpired()` below is
 * the mechanism that actually keeps this table from growing without bound. It
 * is called on an interval from server.js.
 */
const refreshTokenRepository = {
  async create({ userId, tokenId, tokenHash, expiresAt, userAgent = '', ipAddress = '' }) {
    const id = h.generateId();
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_id, token_hash, expires_at, user_agent, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, tokenId, tokenHash, expiresAt, String(userAgent).slice(0, 300), ipAddress]
    );
    return id;
  },

  findByTokenId(tokenId) {
    return queryOne(
      `SELECT id, user_id, token_id, token_hash, expires_at, revoked_at, replaced_by
         FROM refresh_tokens WHERE token_id = ?`,
      [tokenId]
    );
  },

  /** Active means: not revoked and not past its expiry. */
  isActive(row) {
    if (!row || row.revoked_at) return false;
    return new Date(row.expires_at).getTime() > Date.now();
  },

  revoke(tokenId, replacedBy = null) {
    return query(
      `UPDATE refresh_tokens
          SET revoked_at = NOW(3), replaced_by = ?
        WHERE token_id = ? AND revoked_at IS NULL`,
      [replacedBy, tokenId]
    );
  },

  /** Used on "log out everywhere", on password change, and on reuse detection. */
  revokeAllForUser(userId) {
    return query(
      'UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    );
  },

  /**
   * Deletes expired tokens, and revoked ones older than the retention window.
   * Revoked rows are kept briefly so token-reuse detection still has something
   * to match against shortly after a rotation.
   */
  async purgeExpired({ revokedRetentionDays = 30 } = {}) {
    const result = await query(
      `DELETE FROM refresh_tokens
        WHERE expires_at < NOW()
           OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL ? DAY)`,
      [revokedRetentionDays]
    );
    return result.affectedRows || 0;
  },

  countForUser(userId) {
    return queryOne('SELECT COUNT(*) AS total FROM refresh_tokens WHERE user_id = ?', [userId]).then(
      (row) => h.toNumber(row?.total)
    );
  },
};

module.exports = refreshTokenRepository;
