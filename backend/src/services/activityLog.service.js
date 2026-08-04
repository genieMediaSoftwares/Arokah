'use strict';

const activityLogRepository = require('../repositories/activityLog.repository');
const logger = require('../config/logger');

/**
 * Fire-and-forget audit write. Logging must never break the request that
 * triggered it, so failures are swallowed after being reported.
 */
function record({ req, action, entityType, entityId, metadata }) {
  const entry = {
    actor: req?.user?._id || req?.user?.id || null,
    actorEmail: req?.user?.email || '',
    action,
    entityType: entityType || '',
    entityId: entityId ? String(entityId) : '',
    metadata: metadata || {},
    ipAddress: req?.ip || '',
  };

  activityLogRepository.create(entry).catch((err) => {
    logger.warn('Failed to write activity log', { action, error: err.message });
  });
}

function list({ skip = 0, limit = 50, filter = {} } = {}) {
  return activityLogRepository.list({ skip, limit, filter });
}

module.exports = { record, list };
