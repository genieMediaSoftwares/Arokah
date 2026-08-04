'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/jwt');

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Requires a valid access token and loads the user onto `req.user`.
 * The DB lookup on every request is deliberate: it lets us revoke access
 * immediately when an account is deactivated or its password changes.
 */
const protect = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).select('+tokensValidFrom');

  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  // Tokens minted before the last password change are no longer honoured.
  const issuedAtMs = payload.iat * 1000;
  if (user.tokensValidFrom && issuedAtMs < user.tokensValidFrom.getTime() - 1000) {
    throw ApiError.unauthorized('Session expired', { code: 'TOKEN_EXPIRED' });
  }

  req.user = user;
  return next();
});

/** Attaches `req.user` when a valid token is present, but never rejects. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) req.user = user;
  } catch {
    // An unusable token is simply ignored on optional routes.
  }
  return next();
});

/** Role gate. Use after `protect`, e.g. router.use(protect, authorize('admin')). */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { protect, optionalAuth, authorize };
