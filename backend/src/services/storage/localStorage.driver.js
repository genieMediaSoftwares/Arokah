'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const uploadConfig = require('../../config/upload');
const logger = require('../../config/logger');

/**
 * Exactly `<folder>/<filename>.<ext>` — one level deep, no traversal segments,
 * only the characters buildKey() can produce.
 */
const VALID_KEY = /^[a-z0-9_-]{1,40}\/[a-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$/i;

/**
 * Writes uploads to backend/uploads/ and serves them back through the Express
 * static mount at /uploads.
 *
 * Public locations are returned as ROOT-RELATIVE paths ("/uploads/home/x.webp")
 * rather than absolute URLs. That is what gets stored in MongoDB, so moving the
 * API to a new domain does not invalidate every image reference in the database.
 * The frontend prepends the API origin at render time.
 */
class LocalStorageDriver {
  constructor() {
    this.name = 'local';
    this.root = uploadConfig.directory;
  }

  /**
   * Builds `<folder>/<prefix>_<timestamp>_<random><ext>`.
   *
   * The random suffix is what guarantees an upload can never overwrite an
   * existing file: two images submitted in the same millisecond still land on
   * different names.
   */
  buildKey(folder, { prefix = 'img', extension = '.jpg' } = {}) {
    const safeFolder = sanitizeSegment(folder);
    const safePrefix = sanitizeSegment(prefix, 24);
    const stamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    return `${safeFolder}/${safePrefix}_${stamp}_${random}${extension}`;
  }

  /** Resolves a storage key to an absolute path, refusing to escape the root. */
  resolvePath(key) {
    const normalized = String(key).replace(/^\/+/, '').split('/').filter(Boolean);

    // Reject traversal segments outright rather than relying on normalisation.
    if (normalized.some((segment) => segment === '..' || segment === '.')) {
      throw new Error('Invalid storage key');
    }

    const target = path.resolve(this.root, ...normalized);
    const root = path.resolve(this.root);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error('Resolved upload path escapes the upload directory');
    }
    return target;
  }

  async save({ buffer, folder = 'general', prefix, extension }) {
    const key = this.buildKey(folder, { prefix, extension });
    const target = this.resolvePath(key);

    await fs.mkdir(path.dirname(target), { recursive: true });
    // `wx` fails instead of truncating if the name somehow already exists.
    await fs.writeFile(target, buffer, { flag: 'wx' });

    return { key, driver: this.name };
  }

  async delete(key) {
    try {
      await fs.unlink(this.resolvePath(key));
      return true;
    } catch (err) {
      // A file that is already gone is an acceptable outcome for a delete.
      if (err.code === 'ENOENT') {
        logger.warn('Tried to delete a file that no longer exists', { key });
        return false;
      }
      throw err;
    }
  }

  async exists(key) {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Root-relative public path, e.g. "/uploads/home/hero_1723363782_a1b2c3.webp". */
  getPublicUrl(key) {
    return `/uploads/${String(key).replace(/^\/+/, '')}`;
  }

  /**
   * Inverse of getPublicUrl: "/uploads/home/x.webp" -> "home/x.webp".
   *
   * Returns null for anything that is not exactly a well-formed key we could
   * have issued. Shape-checking here rather than only at the filesystem layer
   * means a crafted path like "/uploads/../../.env" is classified as
   * "not one of ours" and rejected with a 400, instead of being passed along
   * and failing later as an opaque error.
   */
  toStorageKey(publicPath) {
    const value = String(publicPath || '').trim();
    if (!value.startsWith('/uploads/')) return null;

    const key = value.slice('/uploads/'.length);
    return VALID_KEY.test(key) ? key : null;
  }

  async ensureReady() {
    await fs.mkdir(this.root, { recursive: true });
  }
}

function sanitizeSegment(segment, maxLength = 40) {
  const cleaned = String(segment || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
  return cleaned || 'general';
}

module.exports = LocalStorageDriver;
