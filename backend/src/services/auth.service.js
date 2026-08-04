'use strict';

const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../utils/jwt');

/** Issues an access/refresh pair and persists the refresh token's digest. */
async function issueTokens(user, { userAgent = '', ipAddress = '' } = {}) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, tokenId, expiresAt } = signRefreshToken(user);

  await RefreshToken.create({
    user: user._id,
    tokenId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    userAgent: String(userAgent).slice(0, 300),
    ipAddress,
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt };
}

async function register({ name, email, phone, password }, context = {}) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  // Role is never taken from the request body — self-service signup is always a
  // customer. Admins are created by scripts/seed-admin.js or by another admin.
  const user = await User.create({ name, email, phone, password, role: 'customer' });
  const tokens = await issueTokens(user, context);

  return { user: user.toJSON(), ...tokens };
}

async function login({ email, password }, context = {}) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Identical error for "no such user" and "wrong password" so the endpoint
  // cannot be used to enumerate registered email addresses.
  const invalid = ApiError.unauthorized('Invalid email or password');
  if (!user) throw invalid;

  const matches = await user.comparePassword(password);
  if (!matches) throw invalid;
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokens(user, context);
  return { user: user.toJSON(), ...tokens };
}

/**
 * Rotates a refresh token: the presented token is revoked and a fresh pair is
 * issued. If an already-revoked token is presented, we treat it as theft and
 * kill every session for that user.
 */
async function refresh(presentedToken, context = {}) {
  if (!presentedToken) throw ApiError.unauthorized('No refresh token provided');

  const payload = verifyRefreshToken(presentedToken);
  const stored = await RefreshToken.findOne({ tokenId: payload.jti });

  if (!stored) throw ApiError.unauthorized('Session not recognised', { code: 'TOKEN_INVALID' });

  if (stored.revokedAt) {
    logger.warn('Refresh token reuse detected — revoking all sessions', { userId: String(stored.user) });
    await RefreshToken.updateMany({ user: stored.user, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw ApiError.unauthorized('Session expired. Please sign in again.', { code: 'TOKEN_REUSED' });
  }

  if (stored.tokenHash !== hashToken(presentedToken)) {
    throw ApiError.unauthorized('Session not recognised', { code: 'TOKEN_INVALID' });
  }
  if (!stored.isActive()) throw ApiError.unauthorized('Session expired', { code: 'TOKEN_EXPIRED' });

  const user = await User.findById(stored.user);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account is no longer active');

  const tokens = await issueTokens(user, context);

  stored.revokedAt = new Date();
  stored.replacedBy = decodeJti(tokens.refreshToken);
  await stored.save();

  return { user: user.toJSON(), ...tokens };
}

async function logout(presentedToken) {
  if (!presentedToken) return;
  try {
    const payload = verifyRefreshToken(presentedToken);
    await RefreshToken.updateOne(
      { tokenId: payload.jti, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  } catch {
    // Logging out with an already-invalid token is a no-op, not an error.
  }
}

async function logoutAll(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('Account not found');

  const matches = await user.comparePassword(currentPassword);
  if (!matches) throw ApiError.unauthorized('Current password is incorrect');

  user.password = newPassword; // pre-save hook hashes it and bumps tokensValidFrom
  await user.save();

  // Every existing session is invalidated once the password changes.
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
