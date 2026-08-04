'use strict';

const ActivityLog = require('../models/ActivityLog');
const logger = require('../config/logger');

/**
 * Fire-and-forget audit write. Logging must never break the request that
 * triggered it, so failures are swallowed after being reported.
 */
function record({ req, action, entityType, entityId, metadata }) {
  const entry = {
    actor: req?.user?._id || null,
    actorEmail: req?.user?.email || '',
    action,
    entityType: entityType || '',
    entityId: entityId ? String(entityId) : '',
    metadata: metadata || {},
    ipAddress: req?.ip || '',
  };

  ActivityLog.create(entry).catch((err) => {
    logger.warn('Failed to write activity log', { action, error: err.message });
  });
}

function list({ skip = 0, limit = 50, filter = {} } = {}) {
  return ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('actor', 'name email role')
    .lean();
}

module.exports = { record, list };
