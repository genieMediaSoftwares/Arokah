'use strict';

const { isAllowedOrigin } = require('../config/cors');
const ApiError = require('../utils/ApiError');

/**
 * CSRF defence for the one flow that relies on a cookie: POST /api/auth/refresh.
 *
 * Every other authenticated route reads a Bearer token from the Authorization
 * header, which a cross-site form or image tag cannot set — so those routes are
 * not CSRF-reachable by construction. The refresh cookie is additionally scoped
 * to /api/auth and marked SameSite, and this middleware adds origin checking on
 * top so a request forged from another site is rejected outright.
 */
function verifyOrigin(req, _res, next) {
  const origin = req.get('origin') || req.get('referer');

  // Non-browser callers (curl, server-to-server) send no Origin and also carry
  // no ambient cookies, so there is nothing to forge.
  if (!origin) return next();

  if (!isAllowedOrigin(origin)) {
    return next(ApiError.forbidden('Request origin is not allowed', { code: 'ORIGIN_REJECTED' }));
  }
  return next();
}

module.exports = { verifyOrigin };
