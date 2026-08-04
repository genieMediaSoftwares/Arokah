'use strict';

const crypto = require('crypto');

/**
 * Shared plumbing for the SQL repositories.
 *
 * Two jobs matter most here:
 *
 *   1. Generating ids in MongoDB's ObjectId format, so ids created after the
 *      migration are indistinguishable from ids created before it. Existing
 *      URLs, receipts and API clients keep working, and there is no "old id" /
 *      "new id" split to reason about forever.
 *
 *   2. Translating between snake_case SQL columns and the camelCase JSON the
 *      API has always returned. The frontend contract does not change.
 */

// ── ObjectId-compatible id generation ───────────────────────────────────────
// Layout matches MongoDB's: 4-byte timestamp | 5-byte random per process |
// 3-byte counter. Being time-ordered keeps inserts append-friendly for the
// primary key index instead of scattering them.
const PROCESS_RANDOM = crypto.randomBytes(5);
let counter = crypto.randomBytes(3).readUIntBE(0, 3);

function generateId() {
  const buf = Buffer.alloc(12);
  buf.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
  PROCESS_RANDOM.copy(buf, 4);
  counter = (counter + 1) % 0xffffff;
  buf.writeUIntBE(counter, 9, 3);
  return buf.toString('hex');
}

/** True for a well-formed 24-character hex id. */
function isValidId(value) {
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
}

// ── Value coercion ──────────────────────────────────────────────────────────

/**
 * Parses a JSON column. MariaDB stores JSON as LONGTEXT, so the driver hands
 * back a string; MySQL 8 may hand back a parsed value. Handle both.
 */
function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Serialises a value for a JSON column, storing SQL NULL for empty input. */
function toJson(value) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/** MySQL TINYINT(1) → boolean. */
const toBool = (value) => value === 1 || value === true || value === '1';

/** boolean → TINYINT(1). */
const fromBool = (value) => (value ? 1 : 0);

/** Numeric column → JS number, tolerating the driver's string form. */
function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * DATETIME → ISO 8601 string, matching what the Mongo-backed API returned.
 * The pool is configured with `timezone: 'Z'`, so these are already UTC.
 */
function toIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * DATE → 'YYYY-MM-DD'.
 *
 * Event dates were stored as plain strings under Mongo and the frontend formats
 * them itself, so returning a full ISO timestamp here would change the rendered
 * date. Kept as a bare date string deliberately.
 */
function toDateString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** '' or an invalid date → SQL NULL, so blank input is not stored as 1970-01-01. */
function fromDateString(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

/** Undefined → default, for columns declared NOT NULL DEFAULT ''. */
const str = (value, fallback = '') => (value === undefined || value === null ? fallback : String(value));

// ── Query building ──────────────────────────────────────────────────────────

/** `IN (?, ?, ?)` — mysql2 cannot expand an array into an IN list itself. */
function placeholders(values) {
  return values.map(() => '?').join(', ');
}

/**
 * Escapes a user-supplied string for use inside a LIKE pattern, so a search for
 * "50%" does not become a wildcard.
 */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Builds `SET a = ?, b = ?` from an object, skipping undefined values so a
 * partial update touches only the fields it was given.
 */
function buildUpdate(fields) {
  const columns = [];
  const params = [];

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    columns.push(`${column} = ?`);
    params.push(value);
  }

  return { clause: columns.join(', '), params, isEmpty: columns.length === 0 };
}

/** Clamps pagination input to a sane window. */
function paginate({ page = 1, limit = 20 } = {}, maxLimit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), maxLimit);
  const safePage = Math.max(Number(page) || 1, 1);
  return { limit: safeLimit, page: safePage, offset: (safePage - 1) * safeLimit };
}

module.exports = {
  generateId,
  isValidId,
  parseJson,
  toJson,
  toBool,
  fromBool,
  toNumber,
  toIso,
  toDateString,
  fromDateString,
  str,
  placeholders,
  escapeLike,
  buildUpdate,
  paginate,
};
