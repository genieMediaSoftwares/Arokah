'use strict';

const env = require('./env');
const logger = require('./logger');

/**
 * CORS policy. The allowlist comes from CORS_ORIGINS; anything not on it is
 * refused rather than reflected back, so a hostile page cannot read authorised
 * responses from this API.
 */
const corsOptions = {
  origin(origin, callback) {
    // No Origin header: curl, server-to-server calls, health checks.
    if (!origin) return callback(null, true);
    if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);

    logger.warn('Blocked a cross-origin request', { origin });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // required for the refresh cookie
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

/** True when `origin` is one we accept — used by the CSRF origin check. */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  return env.CORS_ORIGINS.some((candidate) => {
    try {
      return new URL(origin).origin === new URL(candidate).origin;
    } catch {
      return false;
    }
  });
}

module.exports = { corsOptions, isAllowedOrigin, allowedOrigins: env.CORS_ORIGINS };
