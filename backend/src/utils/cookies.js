'use strict';

const { cookie } = require('../config/jwt');

/**
 * Refresh-cookie helpers. All flags and the cookie name come from config/jwt,
 * so the same rules apply everywhere the cookie is set, read, or cleared.
 */

function setRefreshCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  res.cookie(cookie.name, token, cookie.options(maxAge));
}

function clearRefreshCookie(res) {
  res.clearCookie(cookie.name, cookie.options());
}

function readRefreshCookie(req) {
  return req.signedCookies?.[cookie.name] || null;
}

module.exports = {
  REFRESH_COOKIE_NAME: cookie.name,
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
};
