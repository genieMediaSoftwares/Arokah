'use strict';

const env = require('./env');
const logger = require('./logger');
const ApiError = require('../utils/ApiError');

/**
 * Reduces an entry to the bare scheme://host:port a browser puts in the Origin
 * header. Without this a configured value carrying a trailing slash or a path
 * ("https://site.com/") never matches the header ("https://site.com") and every
 * request from the real frontend is refused.
 */
function normalize(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, '');
  }
}

const allowlist = env.CORS_ORIGINS.map(normalize);

/**
 * CORS policy. The allowlist comes from CORS_ORIGINS; anything not on it is
 * refused rather than reflected back, so a hostile page cannot read authorised
 * responses from this API.
 */
const corsOptions = {
  origin(origin, callback) {
    // No Origin header: curl, server-to-server calls, health checks.
    if (!origin) return callback(null, true);
    if (allowlist.includes(normalize(origin))) return callback(null, true);

    // A rejected origin is a configuration or client problem, not a server
    // fault. Raising it as an ApiError makes it a clean 403 that names the
    // offending origin, instead of an opaque 500 that reports the API as broken
    // and (outside production) prints a stack trace.
    logger.warn('Blocked a cross-origin request', { origin, allowed: allowlist });
    return callback(
      ApiError.forbidden(
        `Origin ${origin} is not allowed by this API. Add it to CORS_ORIGINS.`,
        { code: 'CORS_ORIGIN_REJECTED' }
      )
    );
  },
  credentials: true, // required for the refresh cookie
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

/** True when `origin` is one we accept — used by the CSRF origin check. */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowlist.includes(normalize(origin));
}

module.exports = { corsOptions, isAllowedOrigin, allowedOrigins: allowlist };
