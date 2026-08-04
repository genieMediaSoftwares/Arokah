'use strict';

/**
 * Every successful response from this API has the same envelope:
 *   { success: true, message, data, meta? }
 * Every failure (see middleware/error.js) has:
 *   { success: false, message, code, errors? }
 * The frontend relies on this shape in services/api.js.
 */
function sendSuccess(res, { statusCode = 200, message = 'OK', data = null, meta } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function sendCreated(res, { message = 'Created', data = null, meta } = {}) {
  return sendSuccess(res, { statusCode: 201, message, data, meta });
}

function sendNoContent(res) {
  return res.status(204).send();
}

/** Builds the `meta` block for paginated list endpoints. */
function buildPaginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

module.exports = { sendSuccess, sendCreated, sendNoContent, buildPaginationMeta };
