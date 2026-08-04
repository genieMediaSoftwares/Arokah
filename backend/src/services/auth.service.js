'use strict';

const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../utils/jwt');

/** Issues an access/refresh pair and persists the refresh token's digest. */
async function issueTokens(user, { userAgent = '', ipAddress = '' } = {}) {
  const accessToken = signAccessToken({ _id: user.id, role: user.role });
  const { token: refreshToken, tokenId, expiresAt } = signRefreshToken({ _id: user.id, role: user.role });

  await refreshTokenRepository.create({
    userId: user.id,
    tokenId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    userAgent,
    ipAddress,
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt };
}

async function register({ name, email, phone, password }, context = {}) {
  if (await userRepository.existsByEmail(email)) {
    throw ApiError.conflict('An account with this email already exists');
  }

  // Role is never taken from the request body — self-service signup is always a
  // customer. Admins are created by scripts/seed-admin.js or by another admin.
  const row = await userRepository.create({ name, email, phone, password, role: 'customer' });
  const user = userRepository.toApi(row);

  const tokens = await issueTokens(user, context);
  return { user, ...tokens };
}

async function login({ email, password }, context = {}) {
  const row = await userRepository.findByEmailWithSecrets(email);

  // Identical error for "no such user" and "wrong password" so the endpoint
  // cannot be used to enumerate registered email addresses.
  const invalid = ApiError.unauthorized('Invalid email or password');
  if (!row) throw invalid;

  const matches = await userRepository.comparePassword(password, row.password);
  if (!matches) throw invalid;
  if (!row.is_active) throw ApiError.forbidden('This account has been deactivated');

  await userRepository.touchLastLogin(row.id);

  const user = userRepository.toApi(row);
  const tokens = await issueTokens(user, context);
  return { user, ...tokens };
}

/**
 * Rotates a refresh token: the presented token is revoked and a fresh pair is
 * issued. If an already-revoked token is presented, we treat it as theft and
 * kill every session for that user.
 */
async function refresh(presentedToken, context = {}) {
  if (!presentedToken) throw ApiError.unauthorized('No refresh token provided');

  const payload = verifyRefreshToken(presentedToken);
  const stored = await refreshTokenRepository.findByTokenId(payload.jti);

  if (!stored) throw ApiError.unauthorized('Session not recognised', { code: 'TOKEN_INVALID' });

  if (stored.revoked_at) {
    logger.warn('Refresh token reuse detected — revoking all sessions', { userId: stored.user_id });
    await refreshTokenRepository.revokeAllForUser(stored.user_id);
    throw ApiError.unauthorized('Session expired. Please sign in again.', { code: 'TOKEN_REUSED' });
  }

  if (stored.token_hash !== hashToken(presentedToken)) {
    throw ApiError.unauthorized('Session not recognised', { code: 'TOKEN_INVALID' });
  }
  if (!refreshTokenRepository.isActive(stored)) {
    throw ApiError.unauthorized('Session expired', { code: 'TOKEN_EXPIRED' });
  }

  const row = await userRepository.findById(stored.user_id);
  if (!row || !row.is_active) throw ApiError.unauthorized('Account is no longer active');

  const user = userRepository.toApi(row);
  const tokens = await issueTokens(user, context);

  await refreshTokenRepository.revoke(payload.jti, decodeJti(tokens.refreshToken));

  return { user, ...tokens };
}

async function logout(presentedToken) {
  if (!presentedToken) return;
  try {
    const payload = verifyRefreshToken(presentedToken);
    await refreshTokenRepository.revoke(payload.jti);
  } catch {
    // Logging out with an already-invalid token is a no-op, not an error.
  }
}

async function logoutAll(userId) {
  await refreshTokenRepository.revokeAllForUser(userId);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const row = await userRepository.findByIdWithSecrets(userId);
  if (!row) throw ApiError.notFound('Account not found');

  const matches = await userRepository.comparePassword(currentPassword, row.password);
  if (!matches) throw ApiError.unauthorized('Current password is incorrect');

  // Also advances tokens_valid_from, so tokens minted earlier stop working.
  await userRepository.updatePassword(userId, newPassword);
  await logoutAll(userId);

  return { success: true };
}

function decodeJti(token) {
  const [, body] = token.split('.');
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')).jti || null;
  } catch {
    return null;
  }
}

module.exports = { register, login, refresh, logout, logoutAll, changePassword, issueTokens };
