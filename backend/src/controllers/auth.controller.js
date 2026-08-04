'use strict';

const authService = require('../services/auth.service');
const activityLog = require('../services/activityLog.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');
const { setRefreshCookie, clearRefreshCookie, readRefreshCookie } = require('../utils/cookies');

const requestContext = (req) => ({ userAgent: req.get('user-agent') || '', ipAddress: req.ip });

/**
 * The access token is returned in the body for the frontend to put in an
 * Authorization header; the refresh token goes into an httpOnly cookie so
 * JavaScript — and therefore any XSS payload — can never read it.
 */
function respondWithSession(res, statusCode, message, result) {
  setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
  const payload = { user: result.user, accessToken: result.accessToken };
  return statusCode === 201
    ? sendCreated(res, { message, data: payload })
    : sendSuccess(res, { statusCode, message, data: payload });
}

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, requestContext(req));
  activityLog.record({ req, action: 'auth.registered', entityType: 'User', entityId: result.user.id });
  return respondWithSession(res, 201, 'Account created', result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, requestContext(req));
  // `protect` has not run on this route, so build the actor context by hand
  // rather than spreading the Express request object.
  activityLog.record({
    req: { user: { _id: result.user.id, email: result.user.email }, ip: req.ip },
    action: 'auth.login',
    entityType: 'User',
    entityId: result.user.id,
  });
  return respondWithSession(res, 200, 'Signed in successfully', result);
});

const refresh = asyncHandler(async (req, res) => {
  const token = readRefreshCookie(req);
  const result = await authService.refresh(token, requestContext(req));
  return respondWithSession(res, 200, 'Session refreshed', result);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Signed out' });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user._id);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Signed out of all devices' });
});

const me = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Current user', data: { user: req.user.toJSON() } })
);

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body);
  clearRefreshCookie(res);
  activityLog.record({ req, action: 'auth.password_changed', entityType: 'User', entityId: req.user._id });
  return sendSuccess(res, { message: 'Password changed. Please sign in again.' });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  return sendSuccess(res, { message: 'Profile updated', data: { user: req.user.toJSON() } });
});

module.exports = { register, login, refresh, logout, logoutAll, me, changePassword, updateProfile };
