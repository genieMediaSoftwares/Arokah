'use strict';

const env = require('./env');

/**
 * Token and cookie policy in one place, so the auth utilities never carry their
 * own copies of a lifetime or a cookie flag.
 */

const ACCESS_TOKEN_TYPE = 'access';
const REFRESH_TOKEN_TYPE = 'refresh';

/**
 * The refresh cookie is scoped to the auth routes only, so it is never attached
 * to ordinary API calls — that is what keeps CSRF exposure limited to /api/auth.
 */
const REFRESH_COOKIE_PATH = '/api/auth';

module.exports = {
  ACCESS_TOKEN_TYPE,
  REFRESH_TOKEN_TYPE,

  accessToken: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },

  refreshToken: {
    secret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  cookie: {
    name: env.REFRESH_COOKIE_NAME,
    path: REFRESH_COOKIE_PATH,
    secret: env.COOKIE_SECRET,
    /** Options for res.cookie / res.clearCookie. */
    options(maxAgeMs) {
      return {
        httpOnly: true,
        secure: env.isProduction,
        // Frontend and API sit on different hosts in production, so the cookie
        // has to be SameSite=None there; locally they share localhost.
        sameSite: env.isProduction ? 'none' : 'lax',
        path: REFRESH_COOKIE_PATH,
        signed: true,
        ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
      };
    },
  },

  bcrypt: {
    saltRounds: env.BCRYPT_SALT_ROUNDS,
  },
};
