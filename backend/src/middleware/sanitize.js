'use strict';

/**
 * In-house request sanitisation. The usual packages for this (express-mongo-
 * sanitize, xss-clean) are unmaintained and break on modern Express, so the two
 * protections we actually need are implemented directly here.
 */

const MAX_DEPTH = 8;

/**
 * NoSQL injection guard: drops keys that MongoDB would interpret as operators.
 * Without this, `{"email": {"$ne": null}}` in a JSON body becomes a query
 * operator instead of a value.
 */
function stripOperatorKeys(value, depth = 0) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => stripOperatorKeys(item, depth + 1));
  }

  const clean = {};
  for (const [key, val] of Object.entries(value)) {
    // `$` starts an operator; `.` lets an attacker reach into nested paths.
    if (key.startsWith('$') || key.includes('.')) continue;
    clean[key] = stripOperatorKeys(val, depth + 1);
  }
  return clean;
}

const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const DANGEROUS_TAG = /<\/?(?:script|iframe|object|embed|link|style|base|form|svg)\b[^>]*>/gi;
const JS_PROTOCOL = /javascript\s*:/gi;
const DATA_HTML_PROTOCOL = /data\s*:\s*text\/html/gi;
const INLINE_HANDLER = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
// C0/C1 control characters, deliberately keeping tab, newline and carriage return.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Strips the payloads that actually execute, rather than HTML-escaping every
 * string — event descriptions are plain text rendered by React (which escapes
 * on its own), so blanket escaping would corrupt legitimate content like "A & B".
 */
function sanitizeString(input) {
  return input
    .replace(CONTROL_CHARS, '')
    .replace(SCRIPT_BLOCK, '')
    .replace(DANGEROUS_TAG, '')
    .replace(INLINE_HANDLER, '')
    .replace(JS_PROTOCOL, '')
    .replace(DATA_HTML_PROTOCOL, '');
}

function sanitizeDeep(value, depth = 0) {
  if (depth > MAX_DEPTH) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeDeep(item, depth + 1));
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) out[key] = sanitizeDeep(val, depth + 1);
    return out;
  }
  return value;
}

function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeep(stripOperatorKeys(req.body));
  }
  if (req.params && typeof req.params === 'object') {
    const cleanParams = sanitizeDeep(stripOperatorKeys(req.params));
    for (const key of Object.keys(req.params)) delete req.params[key];
    Object.assign(req.params, cleanParams);
  }
  if (req.query && typeof req.query === 'object') {
    const cleanQuery = sanitizeDeep(stripOperatorKeys(req.query));
    // Express 4 exposes req.query as a plain writable property.
    for (const key of Object.keys(req.query)) delete req.query[key];
    Object.assign(req.query, cleanQuery);
  }
  return next();
}

module.exports = sanitizeRequest;
module.exports.sanitizeString = sanitizeString;
module.exports.stripOperatorKeys = stripOperatorKeys;
