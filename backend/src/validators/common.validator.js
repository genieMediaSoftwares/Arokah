'use strict';

const { param, query } = require('express-validator');

/** Accepts a Mongo ObjectId or a legacy Firebase push key (e.g. -NxAbc123). */
const idParam = (name = 'id') =>
  param(name)
    .trim()
    .notEmpty()
    .withMessage('An id is required')
    .bail()
    .matches(/^[a-zA-Z0-9_-]{1,64}$/)
    .withMessage('Invalid id format');

const objectIdParam = (name = 'id') =>
  param(name).trim().isMongoId().withMessage('Invalid id format');

const paginationQuery = () => [
  query('page').optional().toInt().isInt({ min: 1, max: 10000 }).withMessage('page must be a positive integer'),
  query('limit').optional().toInt().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

/**
 * A managed upload path produced by /api/upload, e.g.
 *   /uploads/home/hero_1723363782_a1b2c3.webp
 * No traversal segments, no nested directories beyond folder/filename.
 */
const UPLOAD_PATH = /^\/uploads\/[a-z0-9_-]{1,40}\/[a-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$/i;

/**
 * Validates an image reference.
 *
 * Two forms are accepted, and both must stay valid:
 *   1. "/uploads/..."      — an image uploaded through this API (the new normal)
 *   2. "https://..."       — an external URL
 *
 * The second form exists because content migrated from Firebase points at
 * Google Drive, Imgur and similar hosts. Rejecting it would blank out every
 * image on the live site the moment an admin re-saved a page.
 *
 * Everything else is refused, which is what keeps `javascript:` and `data:`
 * payloads out of an <img src>.
 */
function isImageReference(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text.length > 2000) return false;
  if (UPLOAD_PATH.test(text)) return true;

  // Absolute http(s) URL — anything else (javascript:, data:, file:) is rejected.
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const IMAGE_MESSAGE =
  'Must be an uploaded image path (/uploads/...) or a valid http(s) URL';

const imageUrl = (chain, { required = false } = {}) => {
  const base = chain.trim();
  if (!required) {
    return base.optional({ values: 'falsy' }).custom(isImageReference).withMessage(IMAGE_MESSAGE);
  }
  return base
    .notEmpty()
    .withMessage('An image is required')
    .bail()
    .custom(isImageReference)
    .withMessage(IMAGE_MESSAGE);
};

module.exports = { idParam, objectIdParam, paginationQuery, imageUrl, isImageReference };
