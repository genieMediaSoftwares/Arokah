'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');
const logger = require('./logger');

/**
 * MySQL/MariaDB connection pool.
 *
 * Hostinger reports `wait_timeout = 20s`, meaning the server closes any
 * connection left idle for 20 seconds. A default pool would keep handing out
 * those dead sockets and the first request after a quiet period would fail with
 * PROTOCOL_CONNECTION_LOST or ECONNRESET. Three things guard against that:
 *
 *   1. `idleTimeout` is set BELOW the server's wait_timeout, so the pool retires
 *      a connection before the server can kill it.
 *   2. `maxIdle` is kept small — fewer idle sockets means fewer chances to race.
 *   3. `query()` retries once on a dropped-connection error, because a socket
 *      can still die between being handed out and being used.
 *
 * The previous MongoDB connection lived at src/config/db.js and is preserved in
 * legacy-mongodb/ if it is ever needed again.
 */

// Comfortably under the server's 20s wait_timeout.
const IDLE_TIMEOUT_MS = 10_000;

/** Errors that mean "the socket died"; safe to retry once on a fresh one. */
const RETRYABLE_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ER_CON_COUNT_ERROR',
  'PROTOCOL_SEQUENCE_TIMEOUT',
]);

let pool = null;

function createPool() {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,

    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    // Shared hosting caps concurrent connections per user; queueing is far
    // better than being refused with ER_CON_COUNT_ERROR.
    queueLimit: 0,

    maxIdle: env.DB_MAX_IDLE,
    idleTimeout: IDLE_TIMEOUT_MS,
    enableKeepAlive: true,
    keepAliveInitialDelay: 5_000,

    connectTimeout: env.DB_CONNECT_TIMEOUT_MS,

    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z', // store and read UTC; the app formats for display
    // Return DECIMAL/BIGINT as strings rather than lossy JS numbers, then
    // convert explicitly where a number is wanted.
    decimalNumbers: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: false,
    multipleStatements: false, // never allow stacked queries from a single call
    ...(env.DB_SSL ? { ssl: { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED } } : {}),
  });
}

function getPool() {
  if (!pool) pool = createPool();
  return pool;
}

/**
 * Runs a parameterised query, retrying once if the connection was dead.
 *
 * Always pass values via `params` — never interpolate into `sql`. mysql2 sends
 * these separately, which is what prevents SQL injection.
 */
async function query(sql, params = []) {
  try {
    const [rows] = await getPool().execute(sql, params);
    return rows;
  } catch (err) {
    if (!RETRYABLE_CODES.has(err.code)) throw err;

    logger.warn('Database connection dropped — retrying once', { code: err.code });
    const [rows] = await getPool().execute(sql, params);
    return rows;
  }
}

/** Convenience for queries expected to return at most one row. */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Runs `work` inside a transaction on a single dedicated connection.
 *
 * Anything that writes more than one table — creating a booking with its extras
 * and its payment row, for example — must go through here so a mid-way failure
 * cannot leave a half-written booking behind.
 *
 *   await transaction(async (tx) => {
 *     await tx.query('INSERT INTO bookings ...', [...]);
 *     await tx.query('INSERT INTO booking_extras ...', [...]);
 *   });
 */
async function transaction(work) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const tx = {
      async query(sql, params = []) {
        const [rows] = await connection.execute(sql, params);
        return rows;
      },
      async queryOne(sql, params = []) {
        const [rows] = await connection.execute(sql, params);
        return rows[0] || null;
      },
      connection,
    };

    const result = await work(tx);
    await connection.commit();
    return result;
  } catch (err) {
    // Rolling back can itself fail if the socket died; the original error is
    // the useful one, so don't let a rollback failure mask it.
    await connection.rollback().catch((rollbackErr) => {
      logger.error('Rollback failed', { error: rollbackErr.message });
    });
    throw err;
  } finally {
    connection.release();
  }
}

/** Verifies credentials and reachability at boot, so failures surface early. */
async function connectDatabase() {
  const active = getPool();
  const connection = await active.getConnection();

  try {
    const [[info]] = await connection.query(
      'SELECT VERSION() AS version, DATABASE() AS db, @@wait_timeout AS waitTimeout'
    );
    logger.info(`Database connected: ${info.db} (${info.version})`);

    // The pool is tuned against this value; warn loudly if the host changes it.
    if (Number(info.waitTimeout) <= IDLE_TIMEOUT_MS / 1000) {
      logger.warn(
        `Server wait_timeout (${info.waitTimeout}s) is at or below the pool idle timeout ` +
          `(${IDLE_TIMEOUT_MS / 1000}s) — lower DB_MAX_IDLE or expect dropped connections`
      );
    }
  } finally {
    connection.release();
  }

  return active;
}

async function disconnectDatabase() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

/** Used by the /api/health probe. */
async function isConnected() {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds `IN (?, ?, ?)` with matching placeholders.
 * mysql2 cannot expand an array into an IN list on its own.
 */
function inClause(values) {
  return values.map(() => '?').join(', ');
}

module.exports = {
  getPool,
  query,
  queryOne,
  transaction,
  connectDatabase,
  disconnectDatabase,
  isConnected,
  inClause,
};
