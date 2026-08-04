'use strict';

const rateLimit = require('express-rate-limit');
const { rateLimit: limits } = require('../config/server');
const ApiError = require('../utils/ApiError');

function build({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(ApiError.tooMany(message)),
  });
}

/** Baseline limit applied to the whole /api surface. */
const apiLimiter = build({
  windowMs: limits.windowMs,
  max: limits.max,
  message: 'Too many requests. Please try again in a few minutes.',
});

/** Tight limit on credential endpoints to blunt password guessing. */
const authLimiter = build({
  windowMs: limits.windowMs,
  max: limits.authMax,
  message: 'Too many login attempts. Please try again later.',
});

/**
 * Token refresh gets its own, roomier budget.
 *
 * Refreshing is routine housekeeping, not a credential guess, and several tabs
 * can legitimately refresh at once. Sharing the login limiter meant a burst of
 * refreshes could exhaust it and lock a user out of signing in — a failure with
 * nothing to do with their password.
 */
const refreshLimiter = build({
  windowMs: limits.windowMs,
  max: limits.refreshMax,
  message: 'Too many session refreshes. Please sign in again.',
});

/** Public write endpoints (contact form) — abuse-prone, low legitimate volume. */
const publicWriteLimiter = build({
  windowMs: limits.publicWriteWindowMs,
  max: limits.publicWriteMax,
  message: 'Too many submissions. Please try again later.',
});

/** Payment order creation — prevents flooding the gateway with junk orders. */
const paymentLimiter = build({
  windowMs: limits.paymentWindowMs,
  max: limits.paymentMax,
  message: 'Too many payment attempts. Please try again shortly.',
});

module.exports = { apiLimiter, authLimiter, refreshLimiter, publicWriteLimiter, paymentLimiter };
