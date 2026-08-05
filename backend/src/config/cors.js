'use strict';

const env = require('./env');
const logger = require('./logger');

/**
 * Origins that are always accepted, whatever CORS_ORIGINS says: the deployed
 * frontend (bare and www) and the two local dev servers.
 *
 * These live in code rather than only in the environment because a mistyped
 * CORS_ORIGINS took the live site down once already — a trailing slash on the
 * value meant it never matched the Origin header a browser actually sends, and
 * every request from the real frontend was refused. CORS_ORIGINS still works
 * and is merged in on top, so extra hosts stay configurable without a deploy.
 */
const BASE_ORIGINS = [
  'https://maroon-pig-939052.hostingersite.com',
  'https://www.arokah.kkdigitalgrowth.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

/**
 * Reduces an entry to the bare scheme://host:port a browser puts in the Origin
 * header, so a configured value carrying a trailing slash or a path
 * ("https://site.com/") still matches the header ("https://site.com").
 */
function normalize(value) {
  try {
    return new URL(value).origin;
  } catch {
    return String(value).trim().replace(/\/+$/, '');
  }
}

const allowedOrigins = [...new Set([...BASE_ORIGINS, ...env.CORS_ORIGINS].map(normalize))].filter(Boolean);

/**
 * CORS policy. Anything off the allowlist is refused rather than reflected
 * back, so a hostile page cannot read authorised responses from this API.
 */
const corsOptions = {
  origin(origin, callback) {
    // No Origin header: curl, Postman, server-to-server calls, health checks.
    // These are not browser requests, so CORS has no bearing on them.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(normalize(origin))) return callback(null, true);

    // Refuse by omitting the Access-Control-Allow-Origin header, NOT by raising
    // an error. Raising one turned every unknown origin into a 403 from the
    // global error handler, which made an ordinary CORS decision look like the
    // API was broken. Withholding the header is the actual CORS refusal: the
    // browser blocks the response on its own.
    logger.warn(`Blocked Origin: ${origin}`, { allowed: allowedOrigins });
    return callback(null, false);
  },
  credentials: true, // required for the refresh cookie
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

/** True when `origin` is one we accept — used by the CSRF origin check. */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins.includes(normalize(origin));
}

module.exports = { corsOptions, isAllowedOrigin, allowedOrigins };
