'use strict';

const userRepository = require('../repositories/user.repository');
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
 *
 * The lookup on every request is deliberate: it lets a deactivated account or a
 * password change take effect immediately, rather than waiting for the access
 * token to expire.
 *
 * `req.user` carries the API-shaped object plus `_id`, because controllers and
 * the activity log were written against the Mongoose document's `_id`.
 */
const protect = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  const payload = verifyAccessToken(token);
  const row = await userRepository.findByIdWithSecrets(payload.sub);

  if (!row) throw ApiError.unauthorized('Account no longer exists');
  if (!row.is_active) throw ApiError.forbidden('This account has been deactivated');

  // Tokens minted before the last password change are no longer honoured.
  const issuedAtMs = payload.iat * 1000;
  const validFrom = row.tokens_valid_from ? new Date(row.tokens_valid_from).getTime() : 0;
  if (validFrom && issuedAtMs < validFrom - 1000) {
    throw ApiError.unauthorized('Session expired', { code: 'TOKEN_EXPIRED' });
  }

  req.user = attachLegacyId(userRepository.toApi(row));
  return next();
});

/** Attaches `req.user` when a valid token is present, but never rejects. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const row = await userRepository.findById(payload.sub);
    if (row && row.is_active) req.user = attachLegacyId(userRepository.toApi(row));
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

/**
 * Mirrors `id` onto `_id`. Call sites across the app were written against
 * Mongoose documents; keeping both means the SQL swap does not ripple into
 * every controller.
 */
function attachLegacyId(user) {
  if (!user) return user;
  user._id = user.id;
  return user;
}

module.exports = { protect, optionalAuth, authorize };
