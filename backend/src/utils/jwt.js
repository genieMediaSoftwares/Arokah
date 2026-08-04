'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const ApiError = require('./ApiError');

const { ACCESS_TOKEN_TYPE, REFRESH_TOKEN_TYPE, accessToken, refreshToken } = jwtConfig;

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, type: ACCESS_TOKEN_TYPE },
    accessToken.secret,
    { expiresIn: accessToken.expiresIn }
  );
}

/**
 * Refresh tokens carry a random `jti` so an individual token can be revoked
 * server-side (see models/RefreshToken.js) without invalidating every session.
 */
function signRefreshToken(user) {
  const tokenId = crypto.randomUUID();
  const token = jwt.sign(
    { sub: String(user._id), role: user.role, jti: tokenId, type: REFRESH_TOKEN_TYPE },
    refreshToken.secret,
    { expiresIn: refreshToken.expiresIn }
  );
  const { exp } = jwt.decode(token);
  return { token, tokenId, expiresAt: new Date(exp * 1000) };
}

function verifyAccessToken(token) {
  return verify(token, accessToken.secret, ACCESS_TOKEN_TYPE);
}

function verifyRefreshToken(token) {
  return verify(token, refreshToken.secret, REFRESH_TOKEN_TYPE);
}

function verify(token, secret, expectedType) {
  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Session expired', { code: 'TOKEN_EXPIRED' });
    }
    throw ApiError.unauthorized('Invalid token', { code: 'TOKEN_INVALID' });
  }
  // A refresh token must never be accepted where an access token is expected.
  if (payload.type !== expectedType) {
    throw ApiError.unauthorized('Invalid token', { code: 'TOKEN_INVALID' });
  }
  return payload;
}

/** Refresh tokens are stored only as SHA-256 digests, never in plaintext. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
