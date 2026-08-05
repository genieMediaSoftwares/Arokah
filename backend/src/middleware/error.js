'use strict';

const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

/** Catch-all for unmatched routes — runs just before the error handler. */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

/** Translates library-specific errors into our ApiError shape. */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Mongoose: bad ObjectId in a path parameter.
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for '${err.path}'`);
  }

  // Mongoose: schema validation.
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiError.unprocessable('Validation failed', { details });
  }

  // MongoDB: unique index violation.
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`A record with this ${field} already exists`);
  }

  // A MulterError branch used to live here. It is gone with the rest of the
  // upload path: this API never receives a file any more. Images go straight
  // from the admin panel to upload.php on Hostinger, and only the resulting URL
  // is sent here — see php-upload-api/README.md.

  // Malformed JSON body.
  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return ApiError.badRequest('Request body is too large');
  }

  return null;
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
function errorHandler(err, req, res, _next) {
  const normalized = normalizeError(err);
  const isKnown = Boolean(normalized);
  const finalError = normalized || ApiError.internal();

  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    statusCode: finalError.statusCode,
    userId: req.user ? String(req.user._id) : undefined,
  };

  if (finalError.statusCode >= 500) {
    logger.error(err.message, { ...logPayload, stack: err.stack });
  } else {
    logger.warn(finalError.message, logPayload);
  }

  const body = {
    success: false,
    message: finalError.message,
    code: finalError.code,
  };

  if (finalError.details) body.errors = finalError.details;

  // Unknown 500s never leak internals to the client in production.
  if (!env.isProduction && (!isKnown || finalError.statusCode >= 500)) {
    body.stack = err.stack;
  }

  return res.status(finalError.statusCode).json(body);
}

module.exports = { notFound, errorHandler };
