'use strict';

const path = require('path');
const dotenv = require('dotenv');

/**
 * The single point at which environment variables enter this application.
 *
 * Nothing else in the codebase reads `process.env` directly. Every module takes
 * its settings from one of the config/* files, which in turn read from here.
 * That means the full set of knobs is discoverable in one place, and a missing
 * or malformed value fails at boot rather than at the first request that needs
 * it.
 */

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const missing = [];
const invalid = [];

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

/**
 * Reads a variable. Omitting `fallback` makes it required: boot aborts with the
 * full list of what is missing instead of failing one variable at a time.
 */
function str(key, { fallback, required = false } = {}) {
  const value = process.env[key];
  if (value !== undefined && value.trim() !== '') return value.trim();
  if (required) {
    missing.push(key);
    return undefined;
  }
  return fallback;
}

function int(key, fallback, { min, max } = {}) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    invalid.push(`${key} must be a whole number (got "${raw}")`);
    return fallback;
  }
  if (min !== undefined && parsed < min) {
    invalid.push(`${key} must be at least ${min} (got ${parsed})`);
    return fallback;
  }
  if (max !== undefined && parsed > max) {
    invalid.push(`${key} must be at most ${max} (got ${parsed})`);
    return fallback;
  }
  return parsed;
}

function bool(key, fallback = false) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function list(key, fallback = []) {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const env = {
  // ── Runtime ────────────────────────────────────────────────────────────────
  NODE_ENV,
  isProduction,
  isDevelopment: NODE_ENV === 'development',
  isTest: NODE_ENV === 'test',

  PORT: int('PORT', 5000, { min: 1, max: 65535 }),
  HOST: str('HOST', { fallback: '0.0.0.0' }),
  TRUST_PROXY: int('TRUST_PROXY', 1, { min: 0 }),
  SHUTDOWN_TIMEOUT_MS: int('SHUTDOWN_TIMEOUT_MS', 10000, { min: 1000 }),

  // ── Identity ───────────────────────────────────────────────────────────────
  // Used in email templates, API metadata, and generated reference codes.
  APP_NAME: str('APP_NAME', { fallback: 'Events Platform' }),
  APP_VERSION: str('APP_VERSION', { fallback: '1.0.0' }),

  // ── URLs ───────────────────────────────────────────────────────────────────
  SERVER_URL: str('SERVER_URL', { fallback: `http://localhost:${int('PORT', 5000)}` }),
  CLIENT_URL: str('CLIENT_URL', { fallback: 'http://localhost:5173' }),
  CORS_ORIGINS: list('CORS_ORIGINS', ['http://localhost:5173']),

  // ── Database ───────────────────────────────────────────────────────────────
  // MySQL / MariaDB (Hostinger). Hostinger labels this "MySQL" in hPanel; the
  // engine it actually runs is MariaDB, which speaks the same wire protocol.
  DB_HOST: str('DB_HOST', { required: true }),
  DB_PORT: int('DB_PORT', 3306, { min: 1, max: 65535 }),
  DB_NAME: str('DB_NAME', { required: true }),
  DB_USER: str('DB_USER', { required: true }),
  DB_PASSWORD: str('DB_PASSWORD', { required: true }),

  // Shared hosting caps concurrent connections per user — keep the pool modest.
  DB_CONNECTION_LIMIT: int('DB_CONNECTION_LIMIT', 8, { min: 1, max: 100 }),
  // Idle sockets are what the server's short wait_timeout kills, so hold few.
  DB_MAX_IDLE: int('DB_MAX_IDLE', 2, { min: 0, max: 100 }),
  DB_CONNECT_TIMEOUT_MS: int('DB_CONNECT_TIMEOUT_MS', 15000, { min: 1000 }),
  DB_SSL: bool('DB_SSL', false),
  DB_SSL_REJECT_UNAUTHORIZED: bool('DB_SSL_REJECT_UNAUTHORIZED', true),

  // ── MongoDB (retired) ──────────────────────────────────────────────────────
  // Superseded by the MySQL settings above. The Mongoose implementation is kept
  // in backend/legacy-mongodb/ and MONGODB_URI is read only by the one-time
  // data migration script (scripts/migrate-mongo-to-mysql.js), which reads it
  // from process.env directly so the server never requires it.
  //
  // MONGODB_URI: str('MONGODB_URI', { required: true }),
  // DB_SERVER_SELECTION_TIMEOUT_MS: int('DB_SERVER_SELECTION_TIMEOUT_MS', 15000, { min: 1000 }),
  // DB_SOCKET_TIMEOUT_MS: int('DB_SOCKET_TIMEOUT_MS', 45000, { min: 1000 }),
  // DB_MAX_POOL_SIZE: int('DB_MAX_POOL_SIZE', 10, { min: 1 }),
  // DB_AUTO_INDEX: bool('DB_AUTO_INDEX', NODE_ENV !== 'production'),

  // ── Authentication ─────────────────────────────────────────────────────────
  JWT_SECRET: str('JWT_SECRET', { required: true }),
  JWT_EXPIRES_IN: str('JWT_EXPIRES_IN', { fallback: '15m' }),
  JWT_REFRESH_SECRET: str('JWT_REFRESH_SECRET', { required: true }),
  JWT_REFRESH_EXPIRES_IN: str('JWT_REFRESH_EXPIRES_IN', { fallback: '30d' }),
  COOKIE_SECRET: str('COOKIE_SECRET', { required: true }),
  REFRESH_COOKIE_NAME: str('REFRESH_COOKIE_NAME', { fallback: 'refreshToken' }),
  BCRYPT_SALT_ROUNDS: int('BCRYPT_SALT_ROUNDS', 12, { min: 10, max: 15 }),

  // ── Rate limiting ──────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
  RATE_LIMIT_MAX: int('RATE_LIMIT_MAX', 300, { min: 1 }),
  AUTH_RATE_LIMIT_MAX: int('AUTH_RATE_LIMIT_MAX', 10, { min: 1 }),
  REFRESH_RATE_LIMIT_MAX: int('REFRESH_RATE_LIMIT_MAX', 120, { min: 1 }),
  PUBLIC_WRITE_RATE_LIMIT_WINDOW_MS: int('PUBLIC_WRITE_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000, { min: 1000 }),
  PUBLIC_WRITE_RATE_LIMIT_MAX: int('PUBLIC_WRITE_RATE_LIMIT_MAX', 10, { min: 1 }),
  PAYMENT_RATE_LIMIT_WINDOW_MS: int('PAYMENT_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
  PAYMENT_RATE_LIMIT_MAX: int('PAYMENT_RATE_LIMIT_MAX', 20, { min: 1 }),

  // ── Request limits ─────────────────────────────────────────────────────────
  JSON_BODY_LIMIT: str('JSON_BODY_LIMIT', { fallback: '1mb' }),

  // ── Payments ───────────────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: str('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: str('RAZORPAY_KEY_SECRET'),
  RAZORPAY_WEBHOOK_SECRET: str('RAZORPAY_WEBHOOK_SECRET'),
  CURRENCY: str('CURRENCY', { fallback: 'INR' }),
  BOOKING_REFERENCE_PREFIX: str('BOOKING_REFERENCE_PREFIX', { fallback: 'BKG' }),
  RECEIPT_PREFIX: str('RECEIPT_PREFIX', { fallback: 'RCP' }),
  MAX_TICKETS_PER_BOOKING: int('MAX_TICKETS_PER_BOOKING', 50, { min: 1, max: 1000 }),

  // ── Email ──────────────────────────────────────────────────────────────────
  SMTP_HOST: str('SMTP_HOST', { fallback: 'smtp.gmail.com' }),
  SMTP_PORT: int('SMTP_PORT', 587, { min: 1, max: 65535 }),
  SMTP_SECURE: bool('SMTP_SECURE', false),
  EMAIL_USER: str('EMAIL_USER'),
  EMAIL_PASS: str('EMAIL_PASS'),
  EMAIL_FROM: str('EMAIL_FROM'),
  ADMIN_NOTIFY_EMAIL: str('ADMIN_NOTIFY_EMAIL'),

  // ── File storage ───────────────────────────────────────────────────────────
  // 'php'   images live in Hostinger's public_html/uploads and are written by
  //         upload.php; this API only ever stores and deletes their URLs
  // 'local' the retired on-disk driver — unusable on Render, whose filesystem is
  //         wiped on every redeploy, which is why 'php' exists
  STORAGE_DRIVER: str('STORAGE_DRIVER', { fallback: 'local' }),
  UPLOAD_DIR: str('UPLOAD_DIR', { fallback: path.resolve(__dirname, '../../uploads') }),
  MAX_UPLOAD_SIZE_MB: int('MAX_UPLOAD_SIZE_MB', 5, { min: 1, max: 100 }),
  MAX_UPLOAD_FILES: int('MAX_UPLOAD_FILES', 10, { min: 1, max: 50 }),
  UPLOAD_CACHE_MAX_AGE: str('UPLOAD_CACHE_MAX_AGE', { fallback: '365d' }),

  // The domain serving public_html/uploads — the prefix on every stored image
  // URL. Required when STORAGE_DRIVER=php; enforced below rather than here,
  // because it is only meaningful for that driver.
  UPLOAD_PUBLIC_BASE_URL: str('UPLOAD_PUBLIC_BASE_URL'),
  // Where upload.php / delete.php / list.php are reachable. Defaults to
  // UPLOAD_PUBLIC_BASE_URL, which is correct unless they have been split off.
  UPLOAD_PHP_ENDPOINT_URL: str('UPLOAD_PHP_ENDPOINT_URL'),

  S3_ENDPOINT: str('S3_ENDPOINT'),
  S3_REGION: str('S3_REGION', { fallback: 'auto' }),
  S3_BUCKET: str('S3_BUCKET'),
  S3_ACCESS_KEY_ID: str('S3_ACCESS_KEY_ID'),
  S3_SECRET_ACCESS_KEY: str('S3_SECRET_ACCESS_KEY'),
  S3_PUBLIC_BASE_URL: str('S3_PUBLIC_BASE_URL'),

  // ── Integrations ───────────────────────────────────────────────────────────
  AI_API_KEY: str('AI_API_KEY'),

  // ── Logging ────────────────────────────────────────────────────────────────
  LOG_LEVEL: str('LOG_LEVEL', { fallback: isProduction ? 'info' : 'debug' }),
  LOG_MAX_SIZE_BYTES: int('LOG_MAX_SIZE_BYTES', 5 * 1024 * 1024, { min: 1024 }),
  LOG_MAX_FILES: int('LOG_MAX_FILES', 5, { min: 1 }),
};

/** Rules that only apply once real traffic and real money are involved. */
/** Non-fatal advisories, printed once at boot. */
const warnings = [];

function productionChecks() {
  const problems = [];

  const shortSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'COOKIE_SECRET'].filter(
    (key) => (env[key] || '').length < 32
  );
  if (shortSecrets.length > 0) {
    problems.push(`These secrets must be at least 32 characters: ${shortSecrets.join(', ')}`);
  }

  // Reusing one secret for both token types means a refresh token would be
  // accepted wherever an access token is expected.
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
  }
  if (env.COOKIE_SECRET && env.COOKIE_SECRET === env.JWT_SECRET) {
    problems.push('COOKIE_SECRET must differ from JWT_SECRET');
  }

  // Deliberately not fatal: pointing a locally-run frontend at a deployed
  // staging backend is a legitimate workflow, and refusing to boot would block
  // it. Still worth saying out loud, because shipping to real production with
  // localhost allowed lets any page served from a developer machine call this
  // API with credentials.
  if (env.CORS_ORIGINS.some((origin) => origin.includes('localhost'))) {
    warnings.push('CORS_ORIGINS contains localhost — remove it once the frontend is deployed');
  }

  // The refresh cookie is Secure in production, so it is simply never sent over
  // plain HTTP and every session would silently fail to restore.
  if (!env.SERVER_URL.startsWith('https://')) {
    problems.push('SERVER_URL must use https:// in production (the refresh cookie is Secure)');
  }

  return problems;
}

/**
 * Storage rules. Checked in every environment, not just production: a missing
 * upload host does not fail at boot on its own, it fails the first time an admin
 * saves a page and the orphaned image is silently left behind. Far better to
 * refuse to start.
 */
function storageChecks() {
  const problems = [];
  if (env.STORAGE_DRIVER !== 'php') return problems;

  if (!env.UPLOAD_PUBLIC_BASE_URL) {
    problems.push(
      'STORAGE_DRIVER=php requires UPLOAD_PUBLIC_BASE_URL (the domain serving ' +
        'public_html/uploads, e.g. https://example.com)'
    );
    return problems;
  }

  for (const key of ['UPLOAD_PUBLIC_BASE_URL', 'UPLOAD_PHP_ENDPOINT_URL']) {
    const value = env[key];
    if (!value) continue;
    try {
      const { protocol } = new URL(value);
      if (protocol !== 'http:' && protocol !== 'https:') throw new Error('bad protocol');
    } catch {
      problems.push(`${key} must be an absolute http(s) URL (got "${value}")`);
    }
  }

  // These URLs are concatenated with "/uploads/..."; a trailing slash would
  // produce "//uploads/..." in every stored record.
  if (env.UPLOAD_PUBLIC_BASE_URL.endsWith('/')) {
    problems.push('UPLOAD_PUBLIC_BASE_URL must not end with a slash');
  }

  return problems;
}

const problems = [
  ...missing.map((key) => `Missing required variable: ${key}`),
  ...invalid,
  ...storageChecks(),
  ...(isProduction ? productionChecks() : []),
];

if (problems.length > 0) {
  // eslint-disable-next-line no-console -- the logger depends on this module.
  console.error(
    ['', 'Configuration error — the server cannot start:', '', ...problems.map((p) => `  - ${p}`), '',
      'Set these in backend/.env. Generate a secret with:',
      '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"', ''].join('\n')
  );
  process.exit(1);
}

// Surfaced by server.js once the logger is available — env.js runs before it.
env.configWarnings = warnings;

module.exports = env;
